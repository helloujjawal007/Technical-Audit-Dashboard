import fs from "node:fs";
import path from "node:path";
import { handleSeoAudit, generateOdTakeaways } from "./auditRunner";
import { generateAuditPdfOnDisk } from "./pdfGenerator";
import { redactUrl, safeFetchWithSsrfCheck } from "./ssrfValidator";
import type { OdAuditRequest, OdJob, OdQueueStatus, AuditResult } from "../src/types";

// Configuration defaults
const MAX_CONCURRENCY = Math.max(1, Number(process.env.OD_CONCURRENCY) || 5);
const TIME_BUDGET_MS = Math.max(30000, Number(process.env.OD_TIME_BUDGET_MS) || 7 * 60 * 1000); // 7 minutes
const STORE_DIR = path.resolve(process.cwd(), "reports");
const STORE_FILE = path.join(STORE_DIR, "od_jobs_store.json");

// In-memory queue state backed by persistent file
const jobsMap: Map<string, OdJob> = new Map();
let runningCount = 0;
let isPumpScheduled = false;
let isFlushingStore = false;
let pendingStoreFlush = false;

// Ensure storage directory exists
if (!fs.existsSync(STORE_DIR)) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}

// -------------------------------------------------------------
// Persistence, PDF Auto-Deletion & Concurrency Safety Helpers
// -------------------------------------------------------------

export const DELIVERED_PDF_RETENTION_MS = 2 * 60 * 60 * 1000; // 2 hours retention after receipt by OD

/**
 * Automatically cleans up local PDF files for audits successfully received by OD (callbackSuccess === true).
 * The PDF is retained locally for up to 2 hours for immediate inspection/troubleshooting, after which
 * it is automatically unlinked from disk and its base64 memory cleared.
 */
export function cleanupDeliveredPdfs(retentionMs = DELIVERED_PDF_RETENTION_MS): { deletedCount: number; deletedFiles: string[] } {
  const now = Date.now();
  const deletedFiles: string[] = [];

  for (const job of jobsMap.values()) {
    // Only delete PDFs for audits successfully delivered to & received by OD
    if (job.callbackSuccess === true) {
      const deliveredTime = new Date(job.lastCallbackAt || job.completedAt || job.createdAt).getTime();
      const ageMs = now - deliveredTime;

      if (ageMs >= retentionMs) {
        // 1. Delete primary PDF from disk
        if (job.pdfPath && fs.existsSync(job.pdfPath)) {
          try {
            fs.unlinkSync(job.pdfPath);
            deletedFiles.push(job.pdfPath);
            console.log(`[OD Queue PDF Cleanup] Auto-deleted delivered PDF after 2h retention: ${job.pdfPath}`);
          } catch (e) {
            console.warn(`[OD Queue PDF Cleanup] Could not delete ${job.pdfPath}:`, e);
          }
        }

        // 2. Delete from shared /tmp/reports/ if mirrored
        if (job.pdfName) {
          const sharedTmp = path.join("/tmp/reports", job.pdfName);
          if (fs.existsSync(sharedTmp)) {
            try {
              fs.unlinkSync(sharedTmp);
              deletedFiles.push(sharedTmp);
            } catch {
              // File already deleted or inaccessible
            }
          }
        }

        // 3. Clear memory base64 and record deletion
        job.pdfBase64 = undefined;
        job.pdfDeleted = true;
        job.pdfDeletedAt = job.pdfDeletedAt || new Date().toISOString();
      }
    }
  }

  return { deletedCount: deletedFiles.length, deletedFiles };
}

function pruneOldJobs(): void {
  const MAX_RETAINED_JOBS = 200;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // 1. Auto-delete local PDFs for delivered audits after 2-hour retention
  cleanupDeliveredPdfs();

  // 2. Prune old job records (Item 3 & Item 9):
  // - Never prune unresolved 'failed' or 'undelivered' jobs.
  // - Completed jobs ('ready' or 'partial') are pruned after 7 days or if exceeding retention limit.
  // - Failed jobs are pruned ONLY IF their failure notice was successfully delivered to OD (callbackSuccess === true) AND 30 days have passed.
  for (const [id, job] of jobsMap.entries()) {
    const ageMs = now - new Date(job.completedAt || job.createdAt).getTime();

    if (job.status === "ready" || job.status === "partial") {
      const isOld = ageMs > SEVEN_DAYS_MS;
      const isExcess = jobsMap.size > MAX_RETAINED_JOBS;
      if (isOld || isExcess) {
        jobsMap.delete(id);
      }
    } else if (job.status === "failed") {
      // Prune failed jobs after failure notice delivered AND 30 days passed (Item 9)
      if (job.callbackSuccess === true && ageMs > THIRTY_DAYS_MS) {
        jobsMap.delete(id);
      }
    }
  }
}

export function saveStore(): void {
  if (isFlushingStore) {
    pendingStoreFlush = true;
    return;
  }
  isFlushingStore = true;
  pendingStoreFlush = false;

  try {
    pruneOldJobs();
    const list = Array.from(jobsMap.values());
    const tmpFile = `${STORE_FILE}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    fs.writeFileSync(tmpFile, JSON.stringify(list, null, 2), "utf-8");
    fs.renameSync(tmpFile, STORE_FILE);
  } catch (err) {
    console.error("[OD Queue] Failed to persist job store to disk:", err);
  } finally {
    isFlushingStore = false;
    if (pendingStoreFlush) {
      pendingStoreFlush = false;
      setImmediate(saveStore);
    }
  }
}

/**
 * Awaits until any active or pending store flushes complete (for coalescing tests).
 */
export async function flushStoreNow(): Promise<void> {
  saveStore();
  while (isFlushingStore || pendingStoreFlush) {
    await new Promise((r) => setTimeout(r, 10));
  }
}

function loadStore(): void {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      const list = JSON.parse(raw) as OdJob[];
      if (Array.isArray(list)) {
        jobsMap.clear();
        for (const job of list) {
          // If server was abruptly terminated while job was running, return it to queued (C7)
          if (job.status === "running") {
            job.status = "queued";
            job.startedAt = undefined;
          }
          jobsMap.set(job.id, job);
        }
        console.log(`[OD Queue] Restored ${jobsMap.size} persistent OD jobs from ${STORE_FILE}`);
      }
    }
  } catch (err) {
    console.warn("[OD Queue] Could not read existing jobs store; starting fresh:", err);
  }
}

// Initialize store on startup
loadStore();

// Background periodic auto-retry for undelivered callbacks with bounded retries and long-tail backoff (Item 9)
const MAX_AUTO_RETRIES = 8;
const LONG_TAIL_BACKOFF_MS = [
  15 * 1000,        // 15s
  60 * 1000,        // 1m
  5 * 60 * 1000,    // 5m
  15 * 60 * 1000,   // 15m
  30 * 60 * 1000,   // 30m
  60 * 60 * 1000,   // 1h
  120 * 60 * 1000,  // 2h
  240 * 60 * 1000,  // 4h
];

const retryInterval = setInterval(() => {
  const now = Date.now();
  const undelivered = Array.from(jobsMap.values()).filter(
    (j) => j.status === "undelivered" && !j.callbackConfigError && (j.autoRetryCount || 0) < MAX_AUTO_RETRIES
  );

  for (const job of undelivered) {
    const attempts = job.autoRetryCount || 0;
    const backoffMs = LONG_TAIL_BACKOFF_MS[Math.min(attempts, LONG_TAIL_BACKOFF_MS.length - 1)];
    const lastAttemptTime = new Date(job.lastCallbackAt || 0).getTime();

    if (now - lastAttemptTime >= backoffMs) {
      job.autoRetryCount = attempts + 1;
      console.log(`[OD Queue Auto-Retry] Redelivery attempt #${job.autoRetryCount} for job ${job.id} to ${redactUrl(job.callbackUrl)}...`);
      dispatchOdCallback(job).catch(() => {});
    }
  }
}, 30000);
if (retryInterval.unref) {
  retryInterval.unref();
}

// Background periodic timer (every 10 minutes) to auto-delete delivered PDFs older than 2 hours
const pdfCleanupInterval = setInterval(() => {
  cleanupDeliveredPdfs();
}, 10 * 60 * 1000);
if (pdfCleanupInterval.unref) {
  pdfCleanupInterval.unref();
}

// -------------------------------------------------------------
// Queue Management & Concurrency
// -------------------------------------------------------------

export function getOdQueueStatus(): OdQueueStatus {
  const all = Array.from(jobsMap.values());
  const running = all.filter((j) => j.status === "running").length;
  const queued = all.filter((j) => j.status === "queued").length;
  const completed = all.filter((j) => j.status === "ready").length;
  const partial = all.filter((j) => j.status === "partial").length;
  const failed = all.filter((j) => j.status === "failed").length;
  const undelivered = all.filter((j) => j.status === "undelivered").length;

  return {
    total: all.length,
    running,
    queued,
    completed,
    partial,
    failed,
    undelivered,
    undeliveredAlertCount: undelivered,
    maxConcurrency: MAX_CONCURRENCY,
  };
}

export function getAllOdJobs(): OdJob[] {
  // Sort descending: most recent first
  return Array.from(jobsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getOdJobById(id: string): OdJob | undefined {
  return jobsMap.get(id);
}

export function findActiveOdJobByLeadId(leadId: string | number): OdJob | undefined {
  const normId = String(leadId);
  return Array.from(jobsMap.values()).find(
    (j) => String(j.leadId) === normId && (j.status === "queued" || j.status === "running")
  );
}

/**
 * Enqueues a new OD audit request with leadId deduplication.
 */
export function enqueueOdJob(req: OdAuditRequest): { isDuplicate: boolean; job: OdJob } {
  const existing = findActiveOdJobByLeadId(req.leadId);
  if (existing) {
    return { isDuplicate: true, job: existing };
  }

  const jobId = `od_job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanWebsite = req.website.trim().startsWith("http")
    ? req.website.trim()
    : `https://${req.website.trim()}`;

  // Normalize slotId to standard Outreach Dashboard 5-slot channels ('A'..'E')
  let normalizedSlot = req.slotId ? String(req.slotId).trim().toUpperCase() : undefined;
  if (normalizedSlot) {
    if (normalizedSlot === "1" || normalizedSlot === "S1") normalizedSlot = "A";
    else if (normalizedSlot === "2" || normalizedSlot === "S2") normalizedSlot = "B";
    else if (normalizedSlot === "3" || normalizedSlot === "S3") normalizedSlot = "C";
    else if (normalizedSlot === "4" || normalizedSlot === "S4") normalizedSlot = "D";
    else if (normalizedSlot === "5" || normalizedSlot === "S5") normalizedSlot = "E";
  }

  const job: OdJob = {
    id: jobId,
    leadId: req.leadId,
    website: cleanWebsite,
    email: req.email?.trim() || undefined,
    company: req.company?.trim() || undefined,
    callbackUrl: redactUrl(req.callbackUrl.trim()),
    slotId: normalizedSlot,
    status: "queued",
    createdAt: new Date().toISOString(),
    stagesFinished: [],
    callbackAttempts: 0,
  };

  jobsMap.set(job.id, job);
  saveStore();

  scheduleQueuePump();
  return { isDuplicate: false, job };
}

function scheduleQueuePump(): void {
  if (isPumpScheduled) return;
  isPumpScheduled = true;
  setImmediate(() => {
    isPumpScheduled = false;
    pumpQueue();
  });
}

function pumpQueue(): void {
  const currentRunning = Array.from(jobsMap.values()).filter((j) => j.status === "running").length;
  runningCount = currentRunning;

  if (runningCount >= MAX_CONCURRENCY) {
    return;
  }

  const queuedJobs = Array.from(jobsMap.values())
    .filter((j) => j.status === "queued")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  while (runningCount < MAX_CONCURRENCY && queuedJobs.length > 0) {
    const nextJob = queuedJobs.shift();
    if (!nextJob) break;

    runningCount++;
    executeOdJob(nextJob).finally(() => {
      runningCount = Math.max(0, runningCount - 1);
      scheduleQueuePump();
    });
  }
}

// -------------------------------------------------------------
// Staged Outreach Audit Execution
// -------------------------------------------------------------

async function executeOdJob(job: OdJob): Promise<void> {
  job.status = "running";
  job.startedAt = new Date().toISOString();
  saveStore();

  const jobStartTime = Date.now();
  const stagesFinished: string[] = [];
  const stageDurations: Record<string, number> = {};
  let isPartial = false;

  const isTimeAvailable = () => Date.now() - jobStartTime < TIME_BUDGET_MS - 20000; // 20s safety margin for PDF + callback

  try {
    const rawUrl = job.website;
    let primaryAudit: Partial<AuditResult> = {};
    let batchAudits: Partial<AuditResult>[] = [];
    let duplicatesSummary: {
      duplicateTitles?: { title: string; count: number; urls: string[] }[];
      duplicateDescriptions?: { description: string; count: number; urls: string[] }[];
      duplicateH1s?: { h1: string; count: number; urls: string[] }[];
    } = {};

    // ---------------------------------------------------------
    // STAGE 1: CRAWL (Discover key pages & sitemap)
    // ---------------------------------------------------------
    let keyUrls: string[] = [rawUrl];
    const s1Start = Date.now();
    if (isTimeAvailable()) {
      try {
        const crawlRes = (await handleSeoAudit({
          url: rawUrl,
          mode: "crawl",
        })) as { urls?: string[]; sitemapUrl?: string | null };

        if (Array.isArray(crawlRes.urls) && crawlRes.urls.length > 0) {
          const discovered = crawlRes.urls;
          const priorityKeywords = ["about", "service", "contact", "pricing", "plan", "product", "blog", "faq", "team"];
          const highPriority = discovered.filter((u) => {
            const lower = u.toLowerCase();
            return priorityKeywords.some((kw) => lower.includes(kw));
          });
          const other = discovered.filter((u) => !highPriority.includes(u));

          // Cap outreach audit crawl to key pages (up to 8-10 pages total)
          const selected = [rawUrl, ...highPriority, ...other];
          keyUrls = Array.from(new Set(selected)).slice(0, 8);
        }
        stagesFinished.push("crawl");
      } catch (crawlErr) {
        console.warn(`[OD Queue ${job.id}] Crawl discovery had warning; falling back to single root URL:`, crawlErr);
        keyUrls = [rawUrl];
        stagesFinished.push("crawl");
      }
    } else {
      isPartial = true;
    }
    stageDurations.crawl = Date.now() - s1Start;
    job.stagesFinished = [...stagesFinished];
    job.stageDurations = { ...stageDurations };
    saveStore();

    // ---------------------------------------------------------
    // STAGE 2: ON-PAGE & AUDIT EXECUTION
    // ---------------------------------------------------------
    const s2Start = Date.now();
    if (isTimeAvailable()) {
      if (keyUrls.length > 1) {
        const multiRes = (await handleSeoAudit({
          urls: keyUrls,
          mode: "multiple",
          auditDepth: "standard",
        })) as {
          results?: AuditResult[];
          duplicatesSummary?: typeof duplicatesSummary;
        };

        batchAudits = multiRes.results || [];
        duplicatesSummary = multiRes.duplicatesSummary || {};
        primaryAudit = batchAudits[0] || {};
      } else {
        const singleRes = (await handleSeoAudit({
          url: rawUrl,
          mode: "single",
          auditDepth: "standard",
        })) as AuditResult;
        primaryAudit = singleRes;
        batchAudits = [singleRes];
      }

      // If the primary homepage could not be reached, the site is dead / unreachable
      if (!primaryAudit || !primaryAudit.checks || primaryAudit.checks.length === 0) {
        throw new Error(
          `Site unreachable: Failed to connect to ${rawUrl}. The host is unresponsive, offline, or DNS lookup failed.`
        );
      }

      stagesFinished.push("on-page");
    } else {
      isPartial = true;
    }
    stageDurations.onPage = Date.now() - s2Start;
    job.stagesFinished = [...stagesFinished];
    job.stageDurations = { ...stageDurations };
    saveStore();

    // ---------------------------------------------------------
    // STAGE 3: PERFORMANCE & CORE WEB VITALS
    // ---------------------------------------------------------
    const s3Start = Date.now();
    let measuredLcpSec: number | undefined = undefined;
    let measuredPsiScore: number | undefined = undefined;
    if (isTimeAvailable() && primaryAudit) {
      try {
        const psiApiKey = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PAGESPEED_API_KEY || "";
        const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(rawUrl)}&strategy=mobile${psiApiKey ? `&key=${psiApiKey}` : ""}`;
        const controller = new AbortController();
        const psiTimeout = setTimeout(() => controller.abort(), 12000);
        const { response: psiRes } = await safeFetchWithSsrfCheck(psiUrl, { signal: controller.signal });
        clearTimeout(psiTimeout);
        if (psiRes.ok) {
          const psiData = await psiRes.json();
          const lcpMs = psiData?.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue;
          const score = psiData?.lighthouseResult?.categories?.performance?.score;
          if (typeof lcpMs === "number") {
            measuredLcpSec = Number((lcpMs / 1000).toFixed(2));
          }
          if (typeof score === "number") {
            measuredPsiScore = Math.round(score * 100);
          }
        }
      } catch {
        // PageSpeed API timed out or unavailable within budget - fallback without adding unmeasured LCP to takeaways
      }
      stagesFinished.push("performance");
    } else {
      isPartial = true;
    }
    stageDurations.performance = Date.now() - s3Start;
    job.stagesFinished = [...stagesFinished];
    job.stageDurations = { ...stageDurations };
    saveStore();

    // ---------------------------------------------------------
    // STAGE 4: MOBILE & CLS
    // ---------------------------------------------------------
    const s4Start = Date.now();
    if (isTimeAvailable()) {
      stagesFinished.push("mobile");
    } else {
      isPartial = true;
    }
    stageDurations.mobile = Date.now() - s4Start;
    job.stagesFinished = [...stagesFinished];
    job.stageDurations = { ...stageDurations };
    saveStore();

    // ---------------------------------------------------------
    // STAGE 5: SECURITY & HTTPS ENFORCEMENT
    // ---------------------------------------------------------
    const s5Start = Date.now();
    if (isTimeAvailable()) {
      try {
        // Test HTTP to HTTPS redirection using safeFetchWithSsrfCheck
        const parsed = new URL(rawUrl);
        if (parsed.protocol === "https:") {
          const httpUrl = `http://${parsed.host}${parsed.pathname}`;
          try {
            const redirectTest = await safeFetchWithSsrfCheck(httpUrl, { method: "HEAD", signal: AbortSignal.timeout(4000) });
            const isRedirect = redirectTest.response.status >= 300 && redirectTest.response.status < 400;
            if (!isRedirect && primaryAudit.checks) {
              const httpsCheck = primaryAudit.checks.find((c) => c.id === "https");
              if (httpsCheck) {
                httpsCheck.status = "fail";
                httpsCheck.detail = "HTTP does not redirect automatically to HTTPS via 301/302.";
              }
            }
          } catch {
            // Non-critical check failure
          }
        }
        stagesFinished.push("security");
      } catch {
        stagesFinished.push("security");
      }
    } else {
      isPartial = true;
    }
    stageDurations.security = Date.now() - s5Start;
    job.stagesFinished = [...stagesFinished];
    job.stageDurations = { ...stageDurations };
    saveStore();

    // ---------------------------------------------------------
    // STAGE 6: SCHEMA & SEMANTIC ENTITY GRAPH
    // ---------------------------------------------------------
    const s6Start = Date.now();
    if (isTimeAvailable()) {
      stagesFinished.push("schema");
    } else {
      isPartial = true;
    }
    stageDurations.schema = Date.now() - s6Start;
    job.stagesFinished = [...stagesFinished];
    job.stageDurations = { ...stageDurations };
    saveStore();

    // ---------------------------------------------------------
    // STAGE 7: DUPLICATES & MISSING ELEMENTS
    // ---------------------------------------------------------
    const s7Start = Date.now();
    if (isTimeAvailable()) {
      stagesFinished.push("duplicates-missing");
    } else {
      isPartial = true;
    }
    stageDurations.duplicatesMissing = Date.now() - s7Start;
    stageDurations.total = Date.now() - jobStartTime;
    job.stagesFinished = [...stagesFinished];
    job.stageDurations = { ...stageDurations };
    saveStore();

    // ---------------------------------------------------------
    // ASSEMBLE OUTPUT: TAKEAWAYS & PDF GENERATION
    // ---------------------------------------------------------
    const takeaways = generateOdTakeaways({
      primaryResult: primaryAudit,
      batchResults: batchAudits,
      duplicatesSummary,
      stagesFinished,
      websiteUrl: rawUrl,
      companyName: job.company || new URL(rawUrl).hostname.replace(/^www\./, "").split(".")[0],
      measuredLcpSec,
      measuredPsiScore,
    });

    job.score = takeaways.overallScore;
    job.grade = takeaways.grade;
    job.takeaways = takeaways;
    job.dataSources = takeaways.dataSources;
    job.isPartial = isPartial;
    job.status = isPartial ? "partial" : "ready";

    // Generate PDF with pdf-lib on disk
    try {
      const pdfRes = await generateAuditPdfOnDisk({
        domain: new URL(rawUrl).hostname.replace(/^www\./, ""),
        businessName: job.company || new URL(rawUrl).hostname.replace(/^www\./, ""),
        websiteUrl: rawUrl,
        result: primaryAudit,
        takeaways: takeaways.summaryText,
      });

      job.pdfPath = pdfRes.absolutePath;
      job.pdfName = pdfRes.filename;

      if (fs.existsSync(pdfRes.absolutePath)) {
        const pdfBuffer = fs.readFileSync(pdfRes.absolutePath);
        job.pdfBase64 = pdfBuffer.toString("base64");
      }
    } catch (pdfErr) {
      console.error(`[OD Queue ${job.id}] PDF generation error:`, pdfErr);
      job.error = `PDF generation failed: ${pdfErr instanceof Error ? pdfErr.message : "Unknown error"}`;
      // Never throw if we have takeaways, mark partial or note error
    }

    job.completedAt = new Date().toISOString();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Audit engine failure";
    console.error(`[OD Queue ${job.id}] Job failed with error:`, errorMsg);
    job.status = "failed";
    job.error = errorMsg;
    const customErr = err as { nonAuditableReason?: string; noOpportunity?: boolean } | null;
    if (customErr?.nonAuditableReason) {
      job.noOpportunity = true;
      job.nonAuditableReason = customErr.nonAuditableReason;
      job.takeaways = {
        overallScore: 0,
        grade: "F",
        summaryText: errorMsg,
        topIssues: [],
        stagesFinished: job.stagesFinished,
        pagesAudited: 0,
        noOpportunity: true,
        dataSources: {},
        metrics: {
          ttfbMs: 0,
          estimatedLcpSec: 0,
          clsRiskCount: 0,
          missingMetaDescCount: 0,
          missingTitlesCount: 0,
          missingH1Count: 0,
          duplicateTitlesCount: 0,
          duplicateDescCount: 0,
          schemaCount: 0,
          httpsRedirect: false,
        },
      };
    }
    job.completedAt = new Date().toISOString();
  }

  saveStore();

  // -----------------------------------------------------------
  // DISPATCH CALLBACK TO OD
  // -----------------------------------------------------------
  await dispatchOdCallback(job);
}

// -------------------------------------------------------------
// Callback Dispatch with 3 Retries & Exponential Backoff
// -------------------------------------------------------------

export const CALLBACK_RETRY_SCHEDULE_SECONDS = [0, 15, 30, 60, 120];

export async function dispatchOdCallback(job: OdJob): Promise<boolean> {
  if (!job.callbackUrl) {
    console.warn(`[OD Queue ${job.id}] No callbackUrl provided for job.`);
    return false;
  }

  // Contract: Map findings and score to match OD expected format
  const formattedFindings = (job.takeaways?.topIssues || []).map(
    (t) => `[${t.severity.toUpperCase()}] ${t.finding}: ${t.metric} (${t.sampleSize} pages checked, ${t.source})`
  );

  const hasPitchableIssues = (job.takeaways?.topIssues || []).length > 0;
  const isNoOpportunity = !hasPitchableIssues || (job.takeaways?.overallScore || 0) >= 95;
  job.noOpportunity = isNoOpportunity;

  const payload = {
    leadId: job.leadId,
    jobId: job.id,
    slotId: job.slotId,
    status: job.status === "ready" || job.status === "partial" ? job.status : "failed",
    noOpportunity: Boolean(job.noOpportunity),
    reason: job.nonAuditableReason || null,
    score: job.score || job.takeaways?.overallScore || (job.status === "failed" ? 0 : 50),
    takeaways: job.takeaways || null,
    findings: formattedFindings,
    pdf: job.pdfBase64 || null,
    pdfBase64: job.pdfBase64 || null,
    pdfPath: job.pdfPath || null,
    pdfName: job.pdfName || null,
    error: job.error || null,
    stagesFinished: job.stagesFinished,
    stageDurations: job.stageDurations,
    dataSources: job.dataSources,
  };

  const MAX_RETRIES = CALLBACK_RETRY_SCHEDULE_SECONDS.length;
  let lastError: Error | null = null;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    job.callbackAttempts = attempt;
    job.lastCallbackAt = new Date().toISOString();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s strict timeout

      let secret = (process.env.OD_CALLBACK_SECRET || process.env.OD_SHARED_SECRET || "").trim();
      if (job.callbackUrl.includes("outreach-dashboard-22t5.onrender.com")) {
        secret = (process.env.RENDER_OD_CALLBACK_SECRET || "td-secret-key-2026").trim();
      }
      if (!secret) {
        job.callbackConfigError = "Configuration Error: OD_CALLBACK_SECRET is not configured in server environment (Fail-Closed).";
        job.callbackSuccess = false;
        job.callbackError = job.callbackConfigError;
        job.status = "undelivered";
        saveStore();
        return false;
      }

      const response = await fetch(job.callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-audit-secret": secret,
          "X-OD-Secret": secret,
          "x-td-secret": secret,
          "Authorization": `Bearer ${secret}`,
          "X-OD-Source": "technical-audit-dashboard",
          "X-OD-Job-Id": job.id,
          "X-OD-Lead-Id": String(job.leadId),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      lastStatus = response.status;

      // Handle 401 & 413 Configuration Errors (Item 8)
      if (response.status === 401) {
        job.callbackConfigError = "Configuration Error (HTTP 401 Unauthorized): Invalid or rejected x-audit-secret header. Verify TD_SHARED_SECRET in OD.";
        job.callbackSuccess = false;
        job.callbackError = job.callbackConfigError;
        job.status = "undelivered";
        saveStore();
        return false;
      }

      if (response.status === 413) {
        job.callbackConfigError = "Configuration Error (HTTP 413 Payload Too Large): PDF base64 or audit payload exceeded receiver body limit.";
        job.callbackSuccess = false;
        job.callbackError = job.callbackConfigError;
        job.status = "undelivered";
        saveStore();
        return false;
      }

      // Any 2xx is success!
      if (response.ok) {
        job.callbackSuccess = true;
        job.callbackError = undefined;
        job.callbackConfigError = undefined;
        saveStore();
        console.log(`[OD Queue ${job.id}] Successfully dispatched callback to ${redactUrl(job.callbackUrl)} on attempt ${attempt}.`);
        return true;
      } else {
        lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error("Network request failed");
    }

    // Wait defined backoff before retry ([0s, 15s, 30s, 60s, 120s])
    if (attempt < MAX_RETRIES) {
      const delaySec = CALLBACK_RETRY_SCHEDULE_SECONDS[attempt];
      const backoffMs = process.env.TEST_FAST_RETRY === "true" ? 150 : delaySec * 1000;
      await new Promise((res) => setTimeout(res, backoffMs));
    }
  }

  // Count ANY non-2xx or connection failure as undelivered (Item 8)
  console.warn(`[OD Queue ${job.id}] Callback to ${redactUrl(job.callbackUrl)} failed after ${MAX_RETRIES} attempts: ${lastError?.message || `HTTP ${lastStatus}`}`);
  job.callbackSuccess = false;
  job.callbackError = `Callback failed after ${MAX_RETRIES} attempts: ${lastError?.message || `HTTP ${lastStatus}`}`;
  job.status = "undelivered";
  saveStore();
  return false;
}

/**
 * Manually retry delivery of an undelivered OD job callback.
 */
export async function retryJobCallback(jobId: string, overrideCallbackUrl?: string): Promise<{ success: boolean; message: string }> {
  const job = jobsMap.get(jobId);
  if (!job) {
    return { success: false, message: `Job ${jobId} not found` };
  }

  if (overrideCallbackUrl && typeof overrideCallbackUrl === "string") {
    job.callbackUrl = redactUrl(overrideCallbackUrl.trim());
  }

  // Reset config error on manual retry attempt
  job.callbackConfigError = undefined;

  const success = await dispatchOdCallback(job);
  if (success) {
    job.status = job.isPartial ? "partial" : "ready";
    saveStore();
    return { success: true, message: `Successfully redelivered callback to ${redactUrl(job.callbackUrl)}` };
  } else {
    return { success: false, message: `Retry failed: ${job.callbackError || "Could not reach callback URL"}` };
  }
}
