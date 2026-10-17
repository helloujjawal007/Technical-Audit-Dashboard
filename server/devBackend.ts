import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import { handleSeoAudit } from "./auditRunner";
import { generateAuditPdfOnDisk } from "./pdfGenerator";
import type { AuditResult } from "../src/types";

function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Info, Apikey");
  res.end(JSON.stringify(body));
}

export function devBackendPlugin(): Plugin {
  return {
    name: "vite-plugin-dev-backend",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] || "";

        if (!url.startsWith("/functions/v1/")) {
          return next();
        }

        // Handle CORS preflight
        if (req.method === "OPTIONS") {
          res.statusCode = 200;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Info, Apikey");
          return res.end();
        }

        const endpoint = url.replace("/functions/v1/", "");

        try {
          // 1. IP Lookup
          if (endpoint === "get-ip") {
            const rawIp =
              (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
              req.socket.remoteAddress ||
              "127.0.0.1";
            return sendJson(res, 200, { ip: rawIp.replace(/^::ffff:/, "") });
          }

          // 2. SEO Audit & Sitemap Crawl
          if (endpoint === "seo-audit") {
            const body = await parseJsonBody(req);
            if (!body.url) {
              return sendJson(res, 400, { error: "URL is required" });
            }
            const result = await handleSeoAudit(body);
            return sendJson(res, 200, result);
          }



          // 3. Generate Audit PDF on Disk
          if (endpoint === "generate-pdf") {
            const body = await parseJsonBody(req);
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
            const body = await parseJsonBody(req);
            let pdfPath = body.audit_pdf_path as string | undefined;
            let pdfName = body.audit_pdf_name as string | undefined;

            // Ensure a physical PDF report exists on disk
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
            const payload = await parseJsonBody(req);
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
