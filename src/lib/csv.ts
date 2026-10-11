import type { AuditResult, CrawlPageResult } from "@/types";

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function checkStatus(result: AuditResult, id: string): string {
  const check = result.checks.find((c) => c.id === id);
  return check ? check.status : "n/a";
}

function checkDetail(result: AuditResult, id: string): string {
  const check = result.checks.find((c) => c.id === id);
  return check ? check.detail : "";
}

export function generateCrawlCsv(pages: CrawlPageResult[]): string {
  const headers = [
    "URL", "Score", "Title", "Meta Description", "Title Tag Status", "Meta Description Status",
    "H1", "H2 Count", "Content Words", "Images Count", "Images Missing Alt",
    "Canonical URL", "OG Tags (of 4)", "Twitter Card", "Has TOC", "Has FAQ", "Has Infographic",
    "Primary Keyword", "Keyword Density (%)", "Schema Types",
    "Internal Links", "External Links", "Dofollow Links", "Nofollow Links",
    "HTTPS", "HTTP Status", "Viewport", "Charset", "robots.txt", "Sitemap",
    "Security Headers (of 4)", "Compression", "HTML Language",
    "Response Time (ms)", "HTML Size (KB)", "Scripts", "Stylesheets", "Resources",
    "Favicon", "Error",
    "Noindex Status", "Noindex Source", "Noindex Directive",
    "Title Issue", "Title Current Content", "Title Updated Content",
    "Description Issue", "Description Current Content", "Description Updated Content",
    "H1 Issue", "H1 Current Content", "H1 Updated Content",
    "Broken Internal Links", "Redirected Internal Links", "Internal Link Details",
    "Schema Validation", "Schema Validation Errors",
    "Google Properties", "Google Property IDs",
  ];

  const rows: string[][] = [headers.map(csvEscape)];

  for (const page of pages) {
    const r = page.result;
    if (!r) {
      rows.push([
        csvEscape(page.url),
        ...Array(headers.length - 2).fill(""),
        csvEscape(page.error),
      ]);
      continue;
    }

    const h2Count = r.headings.filter((h) => h.level === 2).length;
    const imgsMissingAlt = r.images.filter((i) => !i.alt && i.src).length;
    const ogCount = [r.socialPreview.ogTitle, r.socialPreview.ogDescription, r.socialPreview.ogImage].filter(Boolean).length;
    const schemaTypes = [...new Set(r.schema.map((s) => s.type))].join("; ");
    const primaryKw = r.keywords[0]?.keyword || "";
    const primaryDensity = r.keywords[0]?.density || 0;
    const htmlSizeKb = (r.pageSpeed.htmlSizeBytes / 1024).toFixed(1);

    const noindex = r.noindex;
    const cr = r.contentRecommendations || [];
    const titleRec = cr.find((c) => c.element === "title");
    const descRec = cr.find((c) => c.element === "meta-description");
    const h1Rec = cr.find((c) => c.element === "h1");
    const brokenLinks = (r.internalLinkStatuses || []).filter((l) => (l.status ?? 0) === 0 || (l.status ?? 0) >= 400);
    const redirectedLinks = (r.internalLinkStatuses || []).filter((l) => (l.status ?? 0) >= 300 && (l.status ?? 0) < 400);
    const internalLinkDetails = (r.internalLinkStatuses || []).map((l) =>
      `${l.href} → ${l.status || l.error}${l.redirect ? ` → ${l.redirect}` : ""}`
    ).join(" | ");
    const invalidSchemas = (r.schemaValidation || []).filter((s) => !s.valid);
    const schemaValidation = invalidSchemas.length > 0
      ? `${invalidSchemas.length} invalid`
      : (r.schemaValidation || []).length > 0 ? "All valid" : "No schemas";
    const schemaErrors = invalidSchemas.map((s) =>
      `${s.type}: ${s.errors.join("; ")}`
    ).join(" | ");
    const googlePropNames = (r.googleProperties || []).map((p) => p.property).join("; ");
    const googlePropIds = (r.googleProperties || []).map((p) => `${p.property}: ${p.id || "detected"}`).join("; ");

    rows.push([
      csvEscape(page.url),
      csvEscape(r.score),
      csvEscape(r.title),
      csvEscape(r.description),
      csvEscape(checkStatus(r, "title")),
      csvEscape(checkStatus(r, "meta-description")),
      csvEscape(checkDetail(r, "h1")),
      csvEscape(h2Count),
      csvEscape(checkDetail(r, "content-length").match(/\d+/)?.[0] || ""),
      csvEscape(r.images.length),
      csvEscape(imgsMissingAlt),
      csvEscape(checkDetail(r, "canonical")),
      csvEscape(ogCount),
      csvEscape(r.socialPreview.twitterCard),
      csvEscape(r.hasTOC ? "Yes" : "No"),
      csvEscape(r.hasFAQ ? "Yes" : "No"),
      csvEscape(r.hasInfographic ? "Yes" : "No"),
      csvEscape(primaryKw),
      csvEscape(primaryDensity),
      csvEscape(schemaTypes),
      csvEscape(r.linkAnalysis.internal.length),
      csvEscape(r.linkAnalysis.external.length),
      csvEscape(r.linkAnalysis.dofollow.length),
      csvEscape(r.linkAnalysis.nofollow.length),
      csvEscape(checkStatus(r, "https")),
      csvEscape(checkDetail(r, "status")),
      csvEscape(checkStatus(r, "viewport")),
      csvEscape(checkDetail(r, "charset")),
      csvEscape(checkStatus(r, "robots-txt")),
      csvEscape(checkStatus(r, "sitemap")),
      csvEscape(checkDetail(r, "security-headers").match(/\d+\/4/)?.[0] || ""),
      csvEscape(checkStatus(r, "compression")),
      csvEscape(checkDetail(r, "html-lang")),
      csvEscape(r.pageSpeed.responseTimeMs),
      csvEscape(htmlSizeKb),
      csvEscape(r.pageSpeed.scripts),
      csvEscape(r.pageSpeed.stylesheets),
      csvEscape(r.pageSpeed.resources),
      csvEscape(checkStatus(r, "favicon")),
      csvEscape(page.error),
      csvEscape(noindex ? (noindex.indexable ? "Indexable" : "Noindex") : ""),
      csvEscape(noindex?.source || ""),
      csvEscape(noindex?.directive || ""),
      csvEscape(titleRec?.issue || ""),
      csvEscape(titleRec?.currentContent || ""),
      csvEscape(titleRec?.updatedContent || ""),
      csvEscape(descRec?.issue || ""),
      csvEscape(descRec?.currentContent || ""),
      csvEscape(descRec?.updatedContent || ""),
      csvEscape(h1Rec?.issue || ""),
      csvEscape(h1Rec?.currentContent || ""),
      csvEscape(h1Rec?.updatedContent || ""),
      csvEscape(brokenLinks.length),
      csvEscape(redirectedLinks.length),
      csvEscape(internalLinkDetails),
      csvEscape(schemaValidation),
      csvEscape(schemaErrors),
      csvEscape(googlePropNames),
      csvEscape(googlePropIds),
    ]);
  }

  return rows.map((row) => row.join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadExcel(filename: string, rows: string[][]): void {
  const escapeHtml = (value: string): string => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
  const table = rows.map((row, rowIndex) =>
    `<tr>${row.map((cell) => { const tag = rowIndex === 0 ? "th" : "td"; return `<${tag}>${escapeHtml(cell)}</${tag}>`; }).join("")}</tr>`
  ).join("");
  const html = `<html><head><meta charset="utf-8"></head><body><table>${table}</table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateIssueCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}
