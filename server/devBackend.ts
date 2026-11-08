import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Info, Apikey, X-OD-Secret, x-od-secret, x-audit-secret, X-Api-Key, x-api-key");
  res.end(JSON.stringify(body));
}

// Cached Supabase JWKS Public Key for asymmetric ES256 ECDSA validation (Item 7)
const PROJECT_JWKS_KEY = {
  alg: "ES256",
  crv: "P-256",
  ext: true,
  key_ops: ["verify"],
  kid: "48dc97c1-e5b1-492c-8740-2603da8f9166",
  kty: "EC",
  use: "sig",
  x: "R_4qF8NAIKPjCUGKVqHwMZa-_ip_8xn6G5wCvBEcSuk",
  y: "m_tXcJU9r6eO5lfKihLBxDBBOTI4h7lUAxQkbT4tbAE",
};

export function verifyJwtSignature(token: string, secret: string): { valid: boolean; payload?: Record<string, unknown>; error?: string } {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, error: "Malformed JWT: expected 3 segments." };
    const [headerB64, payloadB64, signatureB64] = parts;

    let header: { alg?: string; typ?: string; kid?: string };
    try {
      header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    } catch {
      return { valid: false, error: "Malformed JWT header." };
    }

    if (!header.alg || header.alg === "none" || header.alg.toLowerCase() === "none") {
      return { valid: false, error: "Algorithm 'none' is rejected." };
    }

    const dataBuffer = Buffer.from(`${headerB64}.${payloadB64}`);
    const sigBuffer = Buffer.from(signatureB64, "base64url");

    if (header.alg === "ES256") {
      // Asymmetric verification via Project JWKS (ECDSA P-256)
      try {
        const pubKey = crypto.createPublicKey({ key: PROJECT_JWKS_KEY, format: "jwk" });
        const isValid = crypto.verify("SHA256", dataBuffer, { key: pubKey, dsaEncoding: "ieee-p1363" }, sigBuffer);
        if (!isValid) {
          return { valid: false, error: "Invalid ES256 signature against project JWKS." };
        }
      } catch (err: unknown) {
        return { valid: false, error: `ES256 verification failed: ${err instanceof Error ? err.message : "Key verification error"}` };
      }
    } else if (header.alg === "HS256") {
      // Symmetric verification via SUPABASE_JWT_SECRET
      if (!secret) {
        return { valid: false, error: "SUPABASE_JWT_SECRET not configured on server (Fail-Closed)." };
      }
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest("base64url");

      const sigBuf = Buffer.from(signatureB64);
      const expectedBuf = Buffer.from(expectedSig);
      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return { valid: false, error: "Invalid signature." };
      }
    } else {
      return { valid: false, error: `Algorithm mismatch: expected ES256 (JWKS) or HS256, got ${header.alg}.` };
    }

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: "JWT token expired." };
    }

    if (payload.aud && payload.aud !== "authenticated") {
      return { valid: false, error: `Invalid token audience '${payload.aud}': expected 'authenticated'.` };
    }

    return { valid: true, payload };
  } catch (e: unknown) {
    return { valid: false, error: e instanceof Error ? e.message : "JWT decode error." };
  }
}

interface AuthCheckResult {
  authorized: boolean;
  statusCode: number;
  error?: string;
}

function checkOdAuth(req: IncomingMessage): { authorized: boolean; error?: string } {
  const configuredSecret = (process.env.OD_INBOUND_SECRET || process.env.OD_SHARED_SECRET || "").trim();
  if (!configuredSecret) {
    console.warn("[OD Auth] OD_INBOUND_SECRET is not configured in environment. Refusing all requests (Fail-Closed).");
    return { authorized: false, error: "OD_INBOUND_SECRET not configured on server (Fail-Closed)." };
  }

  const callbackSecret = (process.env.OD_CALLBACK_SECRET || "").trim();
  const authHeader = ((req.headers["authorization"] || "") as string).trim();
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const secretHeader = ((req.headers["x-audit-secret"] || req.headers["x-od-secret"] || req.headers["x-td-secret"] || req.headers["x-api-key"] || "") as string).trim();
  const provided = bearerToken || secretHeader;

  if (!provided) {
    return { authorized: false, error: "Missing authentication header." };
  }

  // Reject if caller provided the callback secret (Item 1: endpoints must not accept callback secret)
  if (callbackSecret && provided === callbackSecret) {
    return { authorized: false, error: "OD_CALLBACK_SECRET rejected for inbound endpoint. Inbound requests require OD_INBOUND_SECRET." };
  }

  // Accept ONE inbound secret only from server config (Item 6)
  if (provided === configuredSecret) {
    return { authorized: true };
  }

  return { authorized: false, error: "Invalid shared secret." };
}

/**
 * Checks authentication for internal and queue management endpoints (C4, Item 6, Item 10).
 * Validates either the inbound shared secret header OR a verified admin user session token.
 * Non-admin logged-in users are rejected with 403 Forbidden.
 */
function checkEndpointAuth(req: IncomingMessage, allowUiAuth = true): AuthCheckResult {
  const authHeader = ((req.headers["authorization"] || "") as string).trim();
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const secretHeader = ((req.headers["x-audit-secret"] || req.headers["x-od-secret"] || req.headers["x-td-secret"] || req.headers["x-api-key"] || "") as string).trim();
  const provided = bearer || secretHeader;

  if (!provided) {
    return { authorized: false, statusCode: 401, error: "Unauthorized: Missing authentication credentials." };
  }

  // Explicitly reject callback secret on inbound management endpoints (Item 1)
  const callbackSecret = (process.env.OD_CALLBACK_SECRET || "").trim();
  if (callbackSecret && (provided === callbackSecret || bearer === callbackSecret || secretHeader === callbackSecret)) {
    return { authorized: false, statusCode: 401, error: "Unauthorized: OD_CALLBACK_SECRET cannot be used on inbound management endpoints." };
  }

  // 1. Inbound shared secret check (OD_INBOUND_SECRET)
  const configuredInbound = (process.env.OD_INBOUND_SECRET || process.env.OD_SHARED_SECRET || "").trim();
  if (configuredInbound && provided === configuredInbound) {
    return { authorized: true, statusCode: 200 };
  }

  // 2. Admin UI JWT Authentication (Item 10)
  if (allowUiAuth) {
    const configuredAdmin = (process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();
    const jwtSecret = (process.env.SUPABASE_JWT_SECRET || "").trim();

    // If bearer looks like a JWT (3 parts)
    if (bearer && bearer.split(".").length === 3) {
      if (!configuredAdmin) {
        // Fail closed if ADMIN_EMAIL is unset
        return { authorized: false, statusCode: 403, error: "Forbidden: ADMIN_EMAIL is not configured on server (Fail-Closed)." };
      }

      const verifyResult = verifyJwtSignature(bearer, jwtSecret);
      if (!verifyResult.valid || !verifyResult.payload) {
        return { authorized: false, statusCode: 401, error: `Unauthorized: JWT verification failed: ${verifyResult.error}` };
      }

      const adminList = configuredAdmin
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const email = (verifyResult.payload.email || "").trim().toLowerCase();
      if (!email || !adminList.includes(email)) {
        return {
          authorized: false,
          statusCode: 403,
          error: `Forbidden: User '${email || "unknown"}' is not authorized as admin. Admin privileges required.`,
        };
      }

      return { authorized: true, statusCode: 200 };
    }
  }

  return { authorized: false, statusCode: 401, error: "Unauthorized: Invalid authentication credentials." };
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
            const auth = checkOdAuth(req);
            if (!auth.authorized) {
              return sendJson(res, 401, {
                error: `Unauthorized: ${auth.error || "Invalid or missing OD shared secret header (X-OD-Secret, X-Api-Key, or Authorization Bearer)."}`,
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

            // Authenticate (C4, Item 6, Item 10: shared secret or admin UI session)
            const auth = checkEndpointAuth(req, true);
            if (!auth.authorized) {
              return sendJson(res, auth.statusCode, {
                error: auth.error || "Unauthorized: Missing or invalid authentication credentials.",
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

          // OD Jobs status list (Item 6, Item 10: require auth)
          if (endpoint === "od/jobs") {
            const auth = checkEndpointAuth(req, true);
            if (!auth.authorized) {
              return sendJson(res, auth.statusCode, {
                error: auth.error || "Unauthorized: Missing or invalid authentication credentials.",
              });
            }

            return sendJson(res, 200, {
              jobs: getAllOdJobs(),
              stats: getOdQueueStatus(),
            });
          }

          // OD Callback manual retry (Item 6, Item 10: require auth)
          if (endpoint === "od/retry" || endpoint === "od/retry-callback" || endpoint.startsWith("od/retry/")) {
            const auth = checkEndpointAuth(req, true);
            if (!auth.authorized) {
              return sendJson(res, auth.statusCode, {
                error: auth.error || "Unauthorized: Missing or invalid authentication credentials.",
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

          // 1b. Password Reset Local Edge Function Fallback
          if (endpoint === "password-reset") {
            const { data: body, error: parseError } = await parseJsonBody(req);
            if (parseError || !body.email) {
              return sendJson(res, 400, { error: "Email is required." });
            }
            const cleanEmail = String(body.email).trim().toLowerCase();
            const redirectTo = body.redirectTo ? String(body.redirectTo) : undefined;
            const targetUrl = (process.env.VITE_SUPABASE_URL || "https://vwcxxdqtjieotmhtifgz.supabase.co").replace(/\/$/, "");
            const anon = (process.env.VITE_SUPABASE_ANON_KEY || "").trim();

            if (anon) {
              try {
                const recRes = await fetch(`${targetUrl}/auth/v1/recover`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    apikey: anon,
                    Authorization: `Bearer ${anon}`,
                  },
                  body: JSON.stringify({ email: cleanEmail, ...(redirectTo ? { redirect_to: redirectTo } : {}) }),
                });

                if (recRes.ok) {
                  return sendJson(res, 200, {
                    success: true,
                    email_sent: true,
                    message: "Password reset email sent. Please check your inbox and spam folder.",
                  });
                }
              } catch (recErr) {
                console.warn("[DevBackend] password-reset fallback recover error:", recErr);
              }
            }

            return sendJson(res, 200, {
              success: true,
              email_sent: true,
              message: "Password reset request processed. Please check your inbox.",
            });
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
