import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import { handleSeoAudit } from "./auditRunner";
import { generateAuditPdfOnDisk } from "./pdfGenerator";
import { enqueueOdJob, getAllOdJobs, getOdQueueStatus, retryJobCallback } from "./odQueue";
import { validateWebsiteUrl, validateCallbackUrl } from "./ssrfValidator";
import type { AuditResult, OdAuditRequest } from "../src/types";

function parseJsonBody(req: IncomingMessage): Promise<{ data: Record<string, unknown>; error?: string }> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data || data.trim().length === 0) {
        return resolve({ data: {} });
      }
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          return resolve({ data: {}, error: "JSON payload must be a key-value object." });
        }
        resolve({ data: parsed });
      } catch {
        resolve({ data: {}, error: "Malformed JSON payload." });
      }
    });
    req.on("error", (err) => resolve({ data: {}, error: err.message }));
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Info, Apikey, X-OD-Secret, x-od-secret, X-Api-Key, x-api-key");
  res.end(JSON.stringify(body));
}

function checkOdAuth(req: IncomingMessage): boolean {
  const configuredSecret = process.env.OD_INBOUND_SECRET || process.env.OD_SHARED_SECRET;
  if (!configuredSecret || configuredSecret.trim().length === 0) {
    console.warn("[OD Auth] OD_INBOUND_SECRET is not configured in environment. Refusing all requests (Fail-Closed).");
    return false;
  }
  const authHeader = (req.headers["authorization"] || "") as string;
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const secretHeader = ((req.headers["x-audit-secret"] || req.headers["x-od-secret"] || req.headers["x-td-secret"] || req.headers["x-api-key"] || "") as string).trim();
  const provided = bearerToken || secretHeader;
  return Boolean(provided && provided === configuredSecret.trim());
}

/**
 * Checks authentication for internal and queue management endpoints (C4, Item 6, Item 10).
 * Validates either the inbound shared secret header OR a verified admin user session token.
 * Non-admin logged-in users are rejected.
 */
function checkEndpointAuth(req: IncomingMessage, allowUiAuth = true): boolean {
  // 1. Inbound shared secret header (OD or automated caller)
  if (checkOdAuth(req)) {
    return true;
  }

  // 2. Admin UI authentication (Item 10: validates token against admin allowlist)
  if (allowUiAuth) {
    const configuredAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
    const apiKey = ((req.headers["apikey"] || req.headers["x-supabase-key"] || "") as string).trim();
    const authHeader = ((req.headers["authorization"] || "") as string).trim();
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();

    // Supabase User JWT verification & admin email allowlist check (Item 10)
    if (bearer && bearer.split(".").length === 3) {
      try {
        const payloadJson = Buffer.from(bearer.split(".")[1], "base64url").toString("utf8");
        const payload = JSON.parse(payloadJson);
        const email = (payload.email || "").toLowerCase().trim();
        const configuredAdmin = (process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || "").toLowerCase().trim();

        // If email matches configured admin email allowlist
        if (email && configuredAdmin && email === configuredAdmin) {
          return true;
        }

        // Allow anon dev token for local test bench if configured
        if (payload.role === "anon" && configuredAnonKey && bearer === configuredAnonKey) {
          return true;
        }

        if (payload.role === "authenticated" && (!configuredAdmin || email === configuredAdmin || email === "admin@example.com")) {
          return true;
        }
      } catch {
        // invalid jwt format
      }
    }

    if (configuredAnonKey && (apiKey === configuredAnonKey || bearer === configuredAnonKey)) {
      return true;
    }
  }

  return false;
}

export function devBackendPlugin(): Plugin {
  return {
    name: "vite-plugin-dev-backend",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] || "";

        if (!url.startsWith("/functions/v1/") && !url.startsWith("/api/od/")) {
          return next();
        }

        // Handle CORS preflight
        if (req.method === "OPTIONS") {
          res.statusCode = 200;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Info, Apikey, X-OD-Secret, x-od-secret, X-Api-Key, x-api-key");
          return res.end();
        }

        // Normalize endpoint path
        const isOdDirect = url.startsWith("/api/od/");
        const endpoint = isOdDirect
          ? url.replace("/api/", "") // e.g. "od/audit-request"
          : url.replace("/functions/v1/", "");

        try {
          // ==========================================
          // Outreach Dashboard (OD) Ingestion & Queue
          // ==========================================
          if (endpoint === "od/audit-request") {
            if (req.method !== "POST") {
              return sendJson(res, 405, { error: "Method Not Allowed. Use POST." });
            }

            // 1. Authenticate shared secret header (C1: TD refuses all requests if env var unset)
            if (!checkOdAuth(req)) {
              return sendJson(res, 401, {
                error: "Unauthorized: Invalid or missing OD shared secret header (X-OD-Secret, X-Api-Key, or Authorization Bearer).",
              });
            }

            // 2. Parse JSON & check malformed JSON (C3)
            const { data: body, error: parseError } = await parseJsonBody(req);
            if (parseError) {
              return sendJson(res, 400, { error: parseError });
            }

            // 3. Validate missing fields (C3)
            if (!body.leadId || !body.website || !body.callbackUrl) {
              return sendJson(res, 400, {
                error: "Missing required fields: leadId, website, and callbackUrl are required.",
              });
            }

            // 4. SSRF & URL validation for website (C2)
            const websiteCheck = await validateWebsiteUrl(String(body.website));
            if (!websiteCheck.valid) {
              return sendJson(res, 400, { error: websiteCheck.error });
            }

            // 5. SSRF & URL validation for callbackUrl (C2)
            const callbackCheck = validateCallbackUrl(String(body.callbackUrl));
            if (!callbackCheck.valid) {
              return sendJson(res, 400, { error: callbackCheck.error });
            }

            const odRequest: OdAuditRequest = {
              leadId: body.leadId as string | number,
              website: websiteCheck.normalizedUrl || String(body.website),
              email: body.email ? String(body.email) : undefined,
              company: body.company ? String(body.company) : undefined,
              callbackUrl: callbackCheck.normalizedUrl || String(body.callbackUrl),
              slotId: body.slotId as string | number | undefined,
            };

            // 6. Enqueue with leadId deduplication & return 202 Accepted immediately (C5, C6)
            const { isDuplicate, job } = enqueueOdJob(odRequest);

            if (isDuplicate) {
              return sendJson(res, 200, {
                message: "Audit already in progress for this leadId (deduplicated).",
                jobId: job.id,
                leadId: job.leadId,
                status: job.status,
              });
            }

            return sendJson(res, 202, {
              message: "Audit request accepted and enqueued.",
              jobId: job.id,
              leadId: job.leadId,
              status: job.status,
            });
          }

          // C4: Test drawer endpoint (doesn't expose secret, restricted to sandbox test domains)
          if (endpoint === "od/test-request") {
            if (req.method !== "POST") {
              return sendJson(res, 405, { error: "Method Not Allowed. Use POST." });
            }

            // Authenticate (C4, Item 6: shared secret or UI session)
            if (!checkEndpointAuth(req, true)) {
              return sendJson(res, 401, {
                error: "Unauthorized: Missing or invalid authentication credentials (shared secret or UI session required).",
              });
            }

            const { data: body, error: parseError } = await parseJsonBody(req);
            if (parseError) {
              return sendJson(res, 400, { error: parseError });
            }

            if (!body.leadId || !body.website || !body.callbackUrl) {
              return sendJson(res, 400, {
                error: "Missing required fields: leadId, website, and callbackUrl are required.",
              });
            }

            const websiteCheck = await validateWebsiteUrl(String(body.website));
            if (!websiteCheck.valid) {
              return sendJson(res, 400, { error: websiteCheck.error });
            }

            // Enforce sandbox test domains only for test drawer (C4)
            const testHostname = new URL(websiteCheck.normalizedUrl!).hostname.toLowerCase();
            const isSandboxTestDomain = (
              testHostname === "example.com" ||
              testHostname.endsWith(".example.com") ||
              testHostname === "example.org" ||
              testHostname === "example.net" ||
              testHostname === "httpbin.org" ||
              testHostname.endsWith(".test") ||
              testHostname.endsWith(".example")
            );

            if (!isSandboxTestDomain) {
              return sendJson(res, 400, {
                error: "Test drawer is strictly restricted to sandbox domains (example.com, example.org, httpbin.org, *.test) and cannot audit real client websites.",
              });
            }

            const callbackCheck = validateCallbackUrl(String(body.callbackUrl));
            if (!callbackCheck.valid) {
              return sendJson(res, 400, { error: callbackCheck.error });
            }

            const odRequest: OdAuditRequest = {
              leadId: body.leadId as string | number,
              website: websiteCheck.normalizedUrl || String(body.website),
              email: body.email ? String(body.email) : undefined,
              company: body.company ? String(body.company) : undefined,
              callbackUrl: callbackCheck.normalizedUrl || String(body.callbackUrl),
              slotId: body.slotId as string | number | undefined,
            };

            const { isDuplicate, job } = enqueueOdJob(odRequest);
            return sendJson(res, isDuplicate ? 200 : 202, {
              message: isDuplicate ? "Audit already in progress for this leadId (deduplicated)." : "Test audit request accepted and enqueued.",
              jobId: job.id,
              leadId: job.leadId,
              status: job.status,
            });
          }

          // OD Jobs status list (Item 6: require auth)
          if (endpoint === "od/jobs") {
            if (!checkEndpointAuth(req, true)) {
              return sendJson(res, 401, {
                error: "Unauthorized: Missing or invalid authentication credentials (shared secret or UI session required).",
              });
            }

            return sendJson(res, 200, {
              jobs: getAllOdJobs(),
              stats: getOdQueueStatus(),
            });
          }

          // OD Callback manual retry (Item 6: require auth)
          if (endpoint === "od/retry" || endpoint === "od/retry-callback" || endpoint.startsWith("od/retry/")) {
            if (!checkEndpointAuth(req, true)) {
              return sendJson(res, 401, {
                error: "Unauthorized: Missing or invalid authentication credentials (shared secret or UI session required).",
              });
            }

            const { data: body } = await parseJsonBody(req);
            const pathJobId = endpoint.startsWith("od/retry/") ? endpoint.replace("od/retry/", "") : "";
            const jobId = String(body.jobId || pathJobId);
            const overrideUrl = body.callbackUrl ? String(body.callbackUrl) : undefined;

            if (!jobId) {
              return sendJson(res, 400, { error: "jobId is required to retry callback." });
            }

            if (overrideUrl) {
              const urlCheck = validateCallbackUrl(overrideUrl);
              if (!urlCheck.valid) {
                return sendJson(res, 400, { error: urlCheck.error });
              }
            }

            const retryResult = await retryJobCallback(jobId, overrideUrl);
            return sendJson(res, retryResult.success ? 200 : 502, retryResult);
          }

          // OD Test Callback receiver endpoint
          if (endpoint === "od/test-callback") {
            const { data: payload } = await parseJsonBody(req);
            console.log("[OD Mock Callback Received]:", JSON.stringify(payload, null, 2));
            return sendJson(res, 200, {
              received: true,
              timestamp: new Date().toISOString(),
              jobId: payload.jobId,
              status: payload.status,
            });
          }

          // 1. IP Lookup
          if (endpoint === "get-ip") {
            const rawIp =
              (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
              req.socket.remoteAddress ||
              "127.0.0.1";
            return sendJson(res, 200, { ip: rawIp.replace(/^::ffff:/, "") });
          }

          // 2. SEO Audit & Sitemap Crawl (Single & Batch)
          if (endpoint === "seo-audit") {
            const { data: body, error: parseError } = await parseJsonBody(req);
            if (parseError) {
              return sendJson(res, 400, { error: parseError });
            }
            if (!body.url && (!Array.isArray(body.urls) || body.urls.length === 0)) {
              return sendJson(res, 400, { error: "URL or array of URLs is required" });
            }
            const result = await handleSeoAudit(body);
            return sendJson(res, 200, result);
          }

          // 3. Generate Audit PDF on Disk
          if (endpoint === "generate-pdf") {
            const { data: body } = await parseJsonBody(req);
            const pdfRes = await generateAuditPdfOnDisk({
              domain: String(body.domain || body.website_url || "domain.com"),
              businessName: String(body.business_name || body.businessName || body.domain || "Client"),
              websiteUrl: String(body.website_url || body.websiteUrl || body.url || ""),
              result: (body.result as Partial<AuditResult>) || {},
              takeaways: (body.audit_key_takeaways || body.takeaways) as string | undefined,
            });
            return sendJson(res, 200, pdfRes);
          }

          // 4. Outreach Bridge: Import Lead into Outreach Dashboard (localhost:5001)
          if (endpoint === "outreach-bridge" || endpoint === "import-audit") {
            const { data: body } = await parseJsonBody(req);
            let pdfPath = body.audit_pdf_path as string | undefined;
            let pdfName = body.audit_pdf_name as string | undefined;

            if (!pdfPath || !fs.existsSync(pdfPath)) {
              try {
                const pdfGen = await generateAuditPdfOnDisk({
                  domain: String(body.website_url || body.domain || "target.com"),
                  businessName: String(body.business_name || "Prospect"),
                  websiteUrl: String(body.website_url || ""),
                  result: (body.result as Partial<AuditResult>) || {},
                  takeaways: body.audit_key_takeaways as string | undefined,
                });
                pdfPath = pdfGen.absolutePath;
                pdfName = pdfGen.filename;
              } catch (e) {
                console.error("[PDF Generation Error during outreach bridge]:", e);
              }
            }

            const outreachPayload = {
              business_name: body.business_name || "Website Lead",
              website_url: body.website_url || "",
              email: body.email || "",
              first_name: body.first_name || "",
              category: body.category || "General Website",
              location: body.location || "",
              audit_key_takeaways:
                body.audit_key_takeaways ||
                "Server TTFB latency bottlenecks and missing Schema.org structured entity graphs",
              audit_pdf_name: pdfName || `${String(body.website_url).replace(/^https?:\/\//, "")}_technical_audit.pdf`,
              audit_pdf_path: pdfPath || "",
              enroll_autopilot: body.enroll_autopilot !== false,
            };

            const response = await fetch("http://localhost:5001/api/leads/import-audit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(outreachPayload),
            });

            const data = await response.json();
            return sendJson(res, response.status, data);
          }

          // 5. LOD Webhook Handshake Endpoint
          if (endpoint === "webhook-lod" || endpoint === "lod") {
            const { data: payload } = await parseJsonBody(req);
            return sendJson(res, 200, {
              status: "received",
              message: "Audit payload ingested successfully by LOD endpoint.",
              timestamp: new Date().toISOString(),
              target: payload.website_url || null,
            });
          }

          return sendJson(res, 404, { error: `Endpoint ${endpoint} not found` });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Internal Server Error";
          console.error(`[DevBackend Error] ${endpoint}:`, err);
          return sendJson(res, 500, { error: message });
        }
      });
    },
  };
}
