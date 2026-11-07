/**
 * API Route: /api/od/jobs
 *
 * NOTE: Outreach Dashboard (OD) audit queue status and jobs list run exclusively on the local/VPS Node.js server
 * (server/devBackend.ts) where concurrent worker capacity and persistent filesystem storage are available.
 *
 * Serverless / Edge execution (e.g. Vercel) returns 501 Not Implemented.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 501;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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
