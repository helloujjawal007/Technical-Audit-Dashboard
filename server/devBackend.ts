import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleSeoAudit } from "./auditRunner";

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

const devResetTokens = new Map<string, { token: string; expiresAt: number }>();

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



          // Password Reset (Token generation & verification)
          if (endpoint === "password-reset") {
            const body = await parseJsonBody(req);
            const cleanEmail = (typeof body.email === "string" ? body.email : "").trim().toLowerCase();
            if (!cleanEmail) {
              return sendJson(res, 400, { error: "Email is required." });
            }

            // If verifying token and setting new password
            if (body.token && body.newPassword) {
              const record = devResetTokens.get(cleanEmail);
              const submittedToken = String(body.token).trim();
              if (!record || record.expiresAt < Date.now() || record.token !== submittedToken) {
                return sendJson(res, 400, {
                  success: false,
                  error: "Invalid or expired verification code.",
                });
              }
              // Successfully verified, clear token
              devResetTokens.delete(cleanEmail);
              return sendJson(res, 200, {
                success: true,
                message: "Password updated successfully.",
              });
            }

            // Otherwise generate 6-digit verification token
            const token = Math.floor(100000 + Math.random() * 900000).toString();
            devResetTokens.set(cleanEmail, {
              token,
              expiresAt: Date.now() + 15 * 60 * 1000, // 15 min validity
            });
            console.log(`\n========================================`);
            console.log(`[DevBackend] Password Reset Token for ${cleanEmail}: ${token}`);
            console.log(`========================================\n`);

            return sendJson(res, 200, {
              success: true,
              message: "Verification code sent to your email.",
              token, // Included in response for dev convenience
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
