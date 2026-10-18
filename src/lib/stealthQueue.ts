import { invokeEdgeFunction } from "@/lib/api";

export interface StealthPageSummary {
  url: string;
  status: "pending" | "running" | "completed" | "failed";
  score?: number;
  title?: string | null;
  issuesCount?: number;
  error?: string | null;
}

export interface StealthJob {
  id: string;
  domain: string;
  url: string;
  totalUrls: number;
  completedUrls: number;
  status: "queued" | "running" | "waiting" | "completed" | "paused" | "failed";
  auditDepth: "basic" | "standard" | "deep";
  urls: string[];
  pages: StealthPageSummary[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  message?: string;
}

const STORAGE_KEY = "ods_stealth_audit_jobs";

// Global foreground active flag
let isForegroundActive = false;
export function setForegroundAuditActive(active: boolean) {
  isForegroundActive = active;
}

export function isForegroundAuditRunning(): boolean {
  return isForegroundActive;
}

export function getStealthJobs(): StealthJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStealthJobs(jobs: StealthJob[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    window.dispatchEvent(new CustomEvent("ods_stealth_jobs_updated", { detail: jobs }));
  } catch (e) {
    console.error("Failed to save stealth jobs:", e);
  }
}

/**
 * Enqueues a large website (e.g. 400-500 pages) into the Stealth Background Queue.
 */
export function enqueueStealthSite(options: {
  url: string;
  urls: string[];
  depth?: "basic" | "standard" | "deep";
}): StealthJob {
  const { url, urls, depth = "standard" } = options;

  let domain = url;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = url.replace(/^https?:\/\//, "").split("/")[0];
  }

  const jobs = getStealthJobs();

  // If already queued or running, return existing
  const existing = jobs.find((j) => j.domain === domain && j.status !== "completed");
  if (existing) {
    return existing;
  }

  const newJob: StealthJob = {
    id: "stealth_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
    domain,
    url,
    totalUrls: urls.length,
    completedUrls: 0,
    status: "queued",
    auditDepth: depth,
    urls,
    pages: urls.map((u) => ({ url: u, status: "pending" })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: `Big site detected (${urls.length} pages). Enqueued for background stealth audit.`,
  };

  const updated = [newJob, ...jobs.filter((j) => j.domain !== domain)];
  saveStealthJobs(updated);
  return newJob;
}

export function removeStealthJob(jobId: string): void {
  const jobs = getStealthJobs().filter((j) => j.id !== jobId);
  saveStealthJobs(jobs);
}

export function clearCompletedStealthJobs(): void {
  const jobs = getStealthJobs().filter((j) => j.status !== "completed");
  saveStealthJobs(jobs);
}

/**
 * Background stealth runner that audits queued big sites ONLY when foreground audits are done.
 */
let workerStarted = false;

export function initStealthBackgroundWorker() {
  if (workerStarted || typeof window === "undefined") return;
  workerStarted = true;

  const runWorkerTick = async () => {
    try {
      const jobs = getStealthJobs();
      const activeJob = jobs.find((j) => j.status === "running" || j.status === "queued" || j.status === "waiting");

      if (!activeJob) {
        setTimeout(runWorkerTick, 3000);
        return;
      }

      // Check if user is currently running a foreground audit
      if (isForegroundActive) {
        if (activeJob.status !== "waiting") {
          activeJob.status = "waiting";
          activeJob.message = "Paused: Waiting for active foreground audits to complete...";
          activeJob.updatedAt = new Date().toISOString();
          saveStealthJobs(jobs);
        }
        setTimeout(runWorkerTick, 3000);
        return;
      }

      // Foreground is idle! Start or resume stealth processing
      if (activeJob.status !== "running") {
        activeJob.status = "running";
        activeJob.message = `Stealth background crawling active (${activeJob.completedUrls}/${activeJob.totalUrls} pages)...`;
        activeJob.updatedAt = new Date().toISOString();
        saveStealthJobs(jobs);
      }

      // Find next batch of pending pages
      const pendingIndices: number[] = [];
      activeJob.pages.forEach((p, idx) => {
        if (p.status === "pending" && pendingIndices.length < 4) {
          pendingIndices.push(idx);
        }
      });

      if (pendingIndices.length === 0) {
        // All pages in this big site completed!
        activeJob.status = "completed";
        activeJob.completedUrls = activeJob.totalUrls;
        activeJob.completedAt = new Date().toISOString();
        activeJob.message = `Completed stealth audit of all ${activeJob.totalUrls} pages.`;
        saveStealthJobs(jobs);

        // Notify user via browser event / toast
        window.dispatchEvent(
          new CustomEvent("ods_stealth_job_finished", {
            detail: {
              domain: activeJob.domain,
              totalUrls: activeJob.totalUrls,
              jobId: activeJob.id,
            },
          })
        );

        setTimeout(runWorkerTick, 2000);
        return;
      }

      // Mark pages as running
      pendingIndices.forEach((i) => {
        activeJob.pages[i].status = "running";
      });
      saveStealthJobs(jobs);

      // Fetch and audit the small batch in background with 8s timeout
      await Promise.all(
        pendingIndices.map(async (i) => {
          const pageUrl = activeJob.pages[i].url;
          try {
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Audit request timed out")), 8000)
            );

            const auditData = await Promise.race([
              invokeEdgeFunction<{ score?: number; title?: string | null; checks?: Array<{ status: string }> }>("seo-audit", {
                method: "POST",
                body: {
                  url: pageUrl,
                  mode: "single",
                  auditDepth: activeJob.auditDepth || "standard",
                },
              }),
              timeoutPromise,
            ]);

            activeJob.pages[i] = {
              url: pageUrl,
              status: "completed",
              score: auditData.score || 75,
              title: auditData.title || null,
              issuesCount: (auditData.checks || []).filter((c) => c.status === "fail" || c.status === "warn").length,
            };
          } catch (err) {
            activeJob.pages[i] = {
              url: pageUrl,
              status: "failed",
              error: err instanceof Error ? err.message : "Fetch timeout",
            };
          }
        })
      );

      activeJob.completedUrls = activeJob.pages.filter((p) => p.status === "completed" || p.status === "failed").length;
      activeJob.updatedAt = new Date().toISOString();
      activeJob.message = `Stealth background crawling: ${activeJob.completedUrls}/${activeJob.totalUrls} pages audited`;
      saveStealthJobs(jobs);

      // Short 300ms breather to prevent overwhelming local network
      setTimeout(runWorkerTick, 300);
    } catch (e) {
      console.warn("Stealth worker error:", e);
      setTimeout(runWorkerTick, 4000);
    }
  };

  runWorkerTick();
}
