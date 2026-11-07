/**
 * API Route: /api/od/audit-request
 *
 * NOTE: Outreach Dashboard (OD) audit queue runs exclusively on the local/VPS Node.js server
 * (managed by server/devBackend.ts and server/odQueue.ts) where concurrent worker capacity (concurrency: 5)
 * and persistent filesystem storage (reports/od_jobs_store.json) are available.
 *
 * Serverless / Edge execution (e.g. Vercel) does not host the multi-minute audit queue and returns 501 Not Implemented.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 501;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-audit-secret, X-OD-Secret, X-Api-Key"
  );

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  res.end(
    JSON.stringify({
      error: "Not Implemented (HTTP 501): Outreach Dashboard (OD) audit queue runs exclusively on the local/VPS Node.js server (server/devBackend.ts) where concurrent worker capacity and persistent filesystem storage are available. Serverless execution is not supported.",
      supportedEnvironment: "Local/VPS Node.js server (port 5174 / devBackend.ts)",
    })
  );
}
