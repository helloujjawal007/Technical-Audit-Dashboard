import type { AuditResult } from "@/types";

export interface OutreachLeadPayload {
  business_name: string;
  website_url: string;
  email?: string;
  first_name?: string;
  category?: string;
  location?: string;
  audit_key_takeaways?: string;
  audit_pdf_name?: string;
  audit_pdf_path?: string;
  enroll_autopilot?: boolean;
  result?: Partial<AuditResult>;
}

export interface OutreachImportResponse {
  success: boolean;
  isExisting?: boolean;
  lead?: {
    id: string;
    business_name: string;
    category?: string;
    email?: string;
    primary_contact_name?: string;
    audit_key_takeaways?: string;
    audit_pdf_name?: string;
    audit_pdf_path?: string;
    status: string;
    website?: string;
    location?: string;
  };
  generatedPitch?: {
    subject: string;
    body: string;
    stage: string;
    hasPdfAttachment: boolean;
    pdfFilename: string;
  };
  message: string;
  error?: string;
}

export interface GeneratedPdfInfo {
  success: boolean;
  filename: string;
  absolutePath: string;
  sizeBytes: number;
}

/**
 * Extracts 1-2 high-impact technical bottlenecks suitable for {{audit_key_takeaways}}
 */
export function extractAuditTakeaways(result: Partial<AuditResult>): string {
  const checks = result.checks || [];
  const recs = result.recommendations || [];

  const bottlenecks: string[] = [];

  // Check 1: TTFB / Server Latency
  const ttfb = result.pageSpeed?.responseTimeMs || 0;
  if (ttfb > 500) {
    bottlenecks.push(`Server TTFB latency (${ttfb}ms)`);
  }

  // Check 2: Schema / Structured Data
  const schemaCheck = checks.find((c) => c.id === "seo-schema" || c.id === "seo-structured-data");
  if (schemaCheck && (schemaCheck.status === "fail" || schemaCheck.status === "warn")) {
    bottlenecks.push("missing Schema.org LocalBusiness structured data");
  }

  // Check 3: Critical check failures if we still need takeaways
  if (bottlenecks.length < 2) {
    const critical = checks.filter((c) => c.status === "fail" && !c.id.includes("ttfb"));
    for (const c of critical) {
      if (bottlenecks.length >= 2) break;
      bottlenecks.push(c.detail || c.label);
    }
  }

  // Check 4: Recommendations fallback
  if (bottlenecks.length < 2 && recs.length > 0) {
    for (const r of recs) {
      if (bottlenecks.length >= 2) break;
      bottlenecks.push(r.detail || r.title);
    }
  }

  if (bottlenecks.length === 0) {
    return "Core Web Vitals bottlenecks and missing Schema.org semantic entity graph";
  }

  return bottlenecks.slice(0, 2).join(" and ");
}

/**
 * Generates an actual A4 diagnostic PDF on the local Mac disk via backend
 */
export async function generateAuditPdf(options: {
  domain: string;
  businessName: string;
  websiteUrl: string;
  result: Partial<AuditResult>;
  takeaways?: string;
}): Promise<GeneratedPdfInfo> {
  const res = await fetch("/functions/v1/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    throw new Error(`Failed to generate PDF on disk (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Pushes lead and audit PDF directly to the Outreach Dashboard (http://localhost:5001/api/leads/import-audit)
 * via the local bridge handler with automatic fallback.
 */
export async function sendLeadToOutreach(payload: OutreachLeadPayload): Promise<OutreachImportResponse> {
  // Try bridge endpoint first (handles PDF generation on disk and proxies to port 5001)
  try {
    const bridgeRes = await fetch("/functions/v1/outreach-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (bridgeRes.ok) {
      return await bridgeRes.json();
    }
  } catch {
    // If bridge fails or in standalone mode, attempt direct dispatch to port 5001
  }

  // Direct fetch fallback to localhost:5001
  const directRes = await fetch("http://localhost:5001/api/leads/import-audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      business_name: payload.business_name,
      website_url: payload.website_url,
      email: payload.email || "",
      first_name: payload.first_name || "",
      category: payload.category || "General Website",
      location: payload.location || "",
      audit_key_takeaways: payload.audit_key_takeaways || "Core Web Vitals bottlenecks and missing structured schema",
      audit_pdf_name: payload.audit_pdf_name || `${payload.website_url.replace(/^https?:\/\//, "")}_technical_audit.pdf`,
      audit_pdf_path: payload.audit_pdf_path || "",
      enroll_autopilot: payload.enroll_autopilot !== false,
    }),
  });

  if (!directRes.ok) {
    const errText = await directRes.text();
    throw new Error(`Outreach Dashboard responded with HTTP ${directRes.status}: ${errText}`);
  }

  return await directRes.json();
}
