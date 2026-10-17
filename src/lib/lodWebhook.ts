import type { AuditResult, CategoryScore } from "@/types";

export interface LodAuditPayload {
  company_name: string;
  website_url: string;
  domain: string;
  audit_id?: string;
  audit_date: string;
  health_score: number;
  grade: string;
  status: "success" | "warning" | "critical";
  core_web_vitals: {
    ttfb_ms: number;
    estimated_lcp_sec: number;
    cls_risk_images: number;
    mobile_optimized: boolean;
    html_payload_kb: number;
    scripts_count: number;
    stylesheets_count: number;
  };
  critical_issues_count: number;
  warnings_count: number;
  passed_checks_count: number;
  top_critical_issues: { id: string; label: string; detail: string; category: string }[];
  ods_prescriptive_solutions: { priority: "high" | "medium" | "low"; title: string; detail: string }[];
  category_scores: CategoryScore[];
  diagnostic_markdown: string;
}

export interface WebhookDispatchResult {
  success: boolean;
  statusCode?: number;
  message: string;
  timestamp: string;
  attempts: number;
  destinationUrl: string;
}

function calculateGrade(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 88) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

export function formatLodPayload(
  result: AuditResult,
  url: string,
  companyName?: string,
  auditId?: string
): LodAuditPayload {
  let domain = url;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = url.replace(/^https?:\/\//, "").split("/")[0];
  }

  const name = companyName || domain.split(".")[0].toUpperCase();
  const checks = result.checks || [];
  const critical = checks.filter((c) => c.status === "fail");
  const warnings = checks.filter((c) => c.status === "warn");
  const passed = checks.filter((c) => c.status === "pass");

  const score = result.score || 0;
  const grade = calculateGrade(score);

  const ttfb = result.pageSpeed?.responseTimeMs || 0;
  const payloadKb = Math.round((result.pageSpeed?.htmlSizeBytes || 0) / 1024);
  const clsRisk = checks.find((c) => c.id === "perf-cls")?.status === "fail" ? 1 : 0;
  const lcpEstimate = ttfb > 0 ? Number(((ttfb / 1000) * 2.2 + 0.8).toFixed(2)) : 2.5;

  // Map recommendations to ODS Solutions
  const odsSolutions = (result.recommendations || []).map((r) => {
    let odsDetail = r.detail;
    let odsTitle = r.title;
    if (r.title.toLowerCase().includes("ttfb") || r.title.toLowerCase().includes("server")) {
      odsTitle = "Next.js SSR & Edge Caching Overhaul (ODS Engine)";
      odsDetail = `${r.detail} Solution: Deploy modern Server-Side Rendering (SSR) with Cloudflare Edge caching to reduce TTFB below 150ms.`;
    } else if (r.title.toLowerCase().includes("schema") || r.title.toLowerCase().includes("structured")) {
      odsTitle = "JSON-LD Semantic Entity Graph Deployment (ODS Architecture)";
      odsDetail = `${r.detail} Solution: Inject structured Organization, WebSite, and Service schema graphs to ensure rich snippet eligibility.`;
    } else if (r.title.toLowerCase().includes("cls") || r.title.toLowerCase().includes("image")) {
      odsTitle = "Core Web Vitals Remediation & Next/Image Migration";
      odsDetail = `${r.detail} Solution: Apply explicit aspect-ratio containers, AVIF/WebP image pipelines, and prevent layout reflows.`;
    }
    return {
      priority: r.priority,
      title: odsTitle,
      detail: odsDetail,
    };
  });

  // Markdown diagnostic report for automated PDF generation
  const diagnosticMarkdown = `
# Technical Audit Diagnostic Report — Online Digital Solution (ODS)
**Client / Domain:** ${name} (${url})
**Audit Date:** ${new Date().toLocaleDateString(undefined, { dateStyle: "long" })}
**Overall Health Score:** ${score}/100 (Grade: ${grade})

## Executive Summary
- **Health Score:** ${score}/100
- **Pass Rate:** ${checks.length > 0 ? Math.round((passed.length / checks.length) * 100) : 0}% (${passed.length} passed of ${checks.length} checks)
- **Critical Issues:** ${critical.length}
- **Warnings:** ${warnings.length}

## Core Web Vitals & Performance Signals
- **Server Latency (TTFB):** ${ttfb}ms
- **Estimated LCP:** ${lcpEstimate}s
- **HTML Payload:** ${payloadKb} KB
- **Mobile Friendly:** ${result.pageSpeed?.mobileOptimized ? "Yes" : "Needs Viewport Optimization"}

## ODS Prescriptive Solutions
${odsSolutions
  .slice(0, 6)
  .map((s, idx) => `${idx + 1}. **[${s.priority.toUpperCase()}] ${s.title}:** ${s.detail}`)
  .join("\n")}
`.trim();

  return {
    company_name: name,
    website_url: url,
    domain,
    audit_id: auditId,
    audit_date: new Date().toISOString(),
    health_score: score,
    grade,
    status: score >= 80 ? "success" : score >= 50 ? "warning" : "critical",
    core_web_vitals: {
      ttfb_ms: ttfb,
      estimated_lcp_sec: lcpEstimate,
      cls_risk_images: clsRisk,
      mobile_optimized: Boolean(result.pageSpeed?.mobileOptimized),
      html_payload_kb: payloadKb,
      scripts_count: result.pageSpeed?.scripts || 0,
      stylesheets_count: result.pageSpeed?.stylesheets || 0,
    },
    critical_issues_count: critical.length,
    warnings_count: warnings.length,
    passed_checks_count: passed.length,
    top_critical_issues: critical.slice(0, 8).map((c) => ({
      id: c.id,
      label: c.label,
      detail: c.detail,
      category: c.category,
    })),
    ods_prescriptive_solutions: odsSolutions,
    category_scores: result.categoryScores || [],
    diagnostic_markdown: diagnosticMarkdown,
  };
}

/**
 * Dispatches audit payload to the configured LOD endpoint with automatic retry & exponential backoff.
 */
export async function dispatchToLodEndpoint(
  payload: LodAuditPayload,
  endpointUrl?: string,
  maxRetries = 3
): Promise<WebhookDispatchResult> {
  const targetUrl =
    endpointUrl ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_LOD_WEBHOOK_URL) ||
    "/functions/v1/webhook-lod";

  let lastError: Error | null = null;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ODS-Source": "technical-audit-engine",
          "X-ODS-Audit-Id": payload.audit_id || "direct-client",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      lastStatus = response.status;

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          message: `LOD Handshake successfully completed (200 OK) on attempt ${attempt}.`,
          timestamp: new Date().toISOString(),
          attempts: attempt,
          destinationUrl: targetUrl,
        };
      } else {
        lastError = new Error(`Server returned HTTP ${response.status}`);
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error("Network connection dropped");
    }

    // Exponential backoff before retry (1s, 2s, 4s)
    if (attempt < maxRetries) {
      await new Promise((res) => setTimeout(res, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  return {
    success: false,
    statusCode: lastStatus || 504,
    message: `LOD Webhook Handshake failed after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`,
    timestamp: new Date().toISOString(),
    attempts: maxRetries,
    destinationUrl: targetUrl,
  };
}
