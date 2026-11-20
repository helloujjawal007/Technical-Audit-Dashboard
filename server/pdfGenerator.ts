import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type Color } from "pdf-lib";
import type { AuditResult, ClientAuditIssue, ClientSeoAuditReport } from "../src/types";
import { buildClientSeoAuditReport } from "../src/lib/seoReportBuilder";

export interface GeneratePdfOptions {
  domain: string;
  businessName: string;
  websiteUrl: string;
  result: Partial<AuditResult>;
  batchResults?: Partial<AuditResult>[];
  duplicatesSummary?: {
    duplicateTitles?: { title: string; count: number; urls: string[] }[];
    duplicateDescriptions?: { description: string; count: number; urls: string[] }[];
    duplicateH1s?: { h1: string; count: number; urls: string[] }[];
    orphanInboundUrls?: string[];
  };
  psiMetrics?: {
    lcpSec?: number;
    inpMs?: number;
    clsScore?: number;
    performanceScore?: number;
  };
  report?: ClientSeoAuditReport;
  takeaways?: string;
  platform?: string;
  outputDir?: string;
  filename?: string;
}

export interface GeneratedPdfResult {
  success: boolean;
  filename: string;
  absolutePath: string;
  sizeBytes: number;
}

/**
 * Sanitizes input text to guarantee compatibility with PDF Standard WinAnsi Helvetica encoding.
 */
export function sanitizeForPdf(text: string): string {
  if (!text) return "";
  return String(text)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "*")
    .replace(/→/g, "->")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/₹/g, "INR ")
    .replace(/€/g, "EUR ")
    .replace(/£/g, "GBP ")
    .replace(/©/g, "(c)")
    .replace(/®/g, "(R)")
    .replace(/™/g, "TM")
    .replace(/[\u0980-\u09FF]/g, "")
    .replace(/[\u0900-\u097F]/g, "")
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || code === 10 || code === 13;
    })
    .join("")
    .trim();
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const safeText = sanitizeForPdf(text);
  if (!safeText) return [];
  const words = safeText.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (word.length > maxCharsPerLine) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }
      for (let i = 0; i < word.length; i += maxCharsPerLine) {
        lines.push(word.slice(i, i + maxCharsPerLine));
      }
      continue;
    }
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function generateAuditPdfOnDisk(options: GeneratePdfOptions): Promise<GeneratedPdfResult> {
  const {
    domain,
    businessName,
    websiteUrl,
    result,
    batchResults,
    duplicatesSummary,
    psiMetrics,
    takeaways,
    outputDir = path.resolve(process.cwd(), "reports"),
  } = options;

  const brandName = (process.env.CONSULTANCY_BRAND_NAME || "").trim();
  const contactEmail = (process.env.CONSULTANCY_EMAIL || "").trim();
  const contactPhone = (process.env.CONSULTANCY_PHONE || "").trim();
  const contactWebsite = (process.env.CONSULTANCY_WEBSITE || "").trim();

  const isInvalidOrPlaceholder = (val: string, allowEmpty = false) => {
    if (!val) return !allowEmpty;
    const lower = val.toLowerCase();
    return (
      lower.includes("seo audit pro") ||
      lower.includes("seoauditpro") ||
      lower.includes("555-") ||
      lower.includes("5550") ||
      lower.includes("example.com") ||
      lower.includes("placeholder")
    );
  };

  if (
    isInvalidOrPlaceholder(brandName) ||
    isInvalidOrPlaceholder(contactEmail) ||
    isInvalidOrPlaceholder(contactWebsite) ||
    isInvalidOrPlaceholder(contactPhone, true)
  ) {
    throw new Error(
      "PDF Branding Error: Consultancy brand name and real contact details must be configured via environment variables (CONSULTANCY_BRAND_NAME, CONSULTANCY_EMAIL, CONSULTANCY_WEBSITE). Fictional placeholders are strictly rejected."
    );
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const cleanDomain = domain.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[^a-z0-9.-]/gi, "_");
  const filename = options.filename ? options.filename.replace(/[^a-zA-Z0-9_.-]/g, "_") : `${cleanDomain}_technical_audit.pdf`;
  const absolutePath = path.join(outputDir, filename);

  const sanitizedBusiness = sanitizeForPdf(businessName);
  const effectiveBusinessName = sanitizedBusiness || cleanDomain.replace(/_/g, " ") || domain;

  const report: ClientSeoAuditReport =
    options.report ||
    buildClientSeoAuditReport({
      websiteUrl: websiteUrl || domain,
      businessName: effectiveBusinessName,
      platform: options.platform || result.platform,
      primaryResult: result,
      batchResults,
      duplicatesSummary,
      psiMetrics,
    });

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN_X = 40;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;
  const FOOTER_MARGIN = 58;

  const darkNavy = rgb(0.06, 0.09, 0.16);
  const tealPrimary = rgb(0.05, 0.58, 0.53);
  const slateText = rgb(0.32, 0.38, 0.48);
  const lightBg = rgb(0.96, 0.97, 0.99);
  const borderGrey = rgb(0.86, 0.89, 0.93);
  const roseRed = rgb(0.82, 0.12, 0.24);
  const amberGold = rgb(0.75, 0.45, 0.02);
  const emeraldGreen = rgb(0.02, 0.55, 0.35);
  const quickWinBg = rgb(0.93, 0.99, 0.96);

  const pages: PDFPage[] = [];
  let page = doc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let cursorY = PAGE_H - 44;

  const addNewPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    cursorY = PAGE_H - 46;
    drawText(`${brandName} | Technical SEO Audit - ${effectiveBusinessName}`, {
      x: MARGIN_X,
      y: PAGE_H - 28,
      size: 7.5,
      font,
      color: slateText,
    });
    page.drawLine({
      start: { x: MARGIN_X, y: PAGE_H - 34 },
      end: { x: PAGE_W - MARGIN_X, y: PAGE_H - 34 },
      thickness: 0.5,
      color: borderGrey,
    });
  };

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < FOOTER_MARGIN) {
      addNewPage();
    }
  };

  const drawText = (str: string, opts: { x: number; y: number; size: number; font?: PDFFont; color?: Color }) => {
    const safe = sanitizeForPdf(str);
    if (safe) {
      page.drawText(safe, { ...opts, font: opts.font || font });
    }
  };

  const drawSectionHeading = (title: string) => {
    ensureSpace(34);
    cursorY -= 6;
    page.drawRectangle({
      x: MARGIN_X,
      y: cursorY - 16,
      width: 4,
      height: 15,
      color: tealPrimary,
    });
    drawText(title, {
      x: MARGIN_X + 10,
      y: cursorY - 12,
      size: 11,
      font: boldFont,
      color: darkNavy,
    });
    cursorY -= 26;
  };

  const drawParagraph = (text: string, size = 8.8, maxChars = 94, color: Color = darkNavy) => {
    const lines = wrapText(text, maxChars);
    for (const line of lines) {
      ensureSpace(13);
      drawText(line, { x: MARGIN_X, y: cursorY, size, font, color });
      cursorY -= 12;
    }
    cursorY -= 4;
  };

  const drawIssueCard = (issue: ClientAuditIssue, indexLabel: string) => {
    const descLines = wrapText(issue.description, 88).slice(0, 3);
    const exText =
      issue.exampleAffectedUrls.length > 0
        ? `Affected URLs: ${issue.affectedUrlsCount}  |  Examples: ${issue.exampleAffectedUrls.slice(0, 2).join(", ")}`
        : `Affected URLs: ${issue.affectedUrlsCount}`;
    const exLines = wrapText(exText, 88).slice(0, 2);
    const impactLines = wrapText(`SEO Impact: ${issue.seoImpact}`, 88).slice(0, 3);
    const fixLines = wrapText(`Recommended Solution: ${issue.recommendedSolution}`, 88).slice(0, 3);

    const cardHeight = 36 + (descLines.length + exLines.length + impactLines.length + fixLines.length) * 10.5;
    ensureSpace(cardHeight + 10);

    const boxTop = cursorY;
    page.drawRectangle({
      x: MARGIN_X,
      y: boxTop - cardHeight,
      width: CONTENT_W,
      height: cardHeight,
      color: issue.isQuickWin ? quickWinBg : rgb(1, 1, 1),
      borderColor: issue.isQuickWin ? tealPrimary : borderGrey,
      borderWidth: issue.isQuickWin ? 1 : 0.8,
    });

    const priorityColor = issue.priority === "High" ? roseRed : issue.priority === "Medium" ? amberGold : tealPrimary;
    const badgeText = `[${issue.priority.toUpperCase()} PRIORITY] ${issue.isQuickWin ? "[QUICK WIN]" : "[ENGINEERING]"} (${issue.findingType})`;
    drawText(`${indexLabel}. ${issue.issueName}`, {
      x: MARGIN_X + 10,
      y: boxTop - 14,
      size: 9.2,
      font: boldFont,
      color: darkNavy,
    });
    drawText(`${issue.area}  |  ${badgeText}  |  Effort: ${issue.effortLabel}`, {
      x: MARGIN_X + 10,
      y: boxTop - 25,
      size: 7.2,
      font: boldFont,
      color: priorityColor,
    });

    let lineY = boxTop - 38;
    for (const l of descLines) {
      drawText(l, { x: MARGIN_X + 10, y: lineY, size: 8, font, color: darkNavy });
      lineY -= 10.5;
    }
    for (const l of exLines) {
      drawText(l, { x: MARGIN_X + 10, y: lineY, size: 7.5, font: boldFont, color: tealPrimary });
      lineY -= 10.5;
    }
    for (const l of impactLines) {
      drawText(l, { x: MARGIN_X + 10, y: lineY, size: 7.8, font, color: slateText });
      lineY -= 10.5;
    }
    for (const l of fixLines) {
      drawText(l, { x: MARGIN_X + 10, y: lineY, size: 7.8, font, color: emeraldGreen });
      lineY -= 10.5;
    }

    cursorY -= cardHeight + 8;
  };

  // ==================== COVER HEADER ====================
  page.drawRectangle({
    x: MARGIN_X,
    y: cursorY - 52,
    width: CONTENT_W,
    height: 60,
    color: lightBg,
    borderColor: borderGrey,
    borderWidth: 1,
  });

  drawText(brandName.toUpperCase(), { x: MARGIN_X + 14, y: cursorY - 12, size: 13.5, font: boldFont, color: darkNavy });
  drawText("Comprehensive Client-Ready Technical SEO Audit", {
    x: MARGIN_X + 14,
    y: cursorY - 27,
    size: 9,
    font: boldFont,
    color: tealPrimary,
  });
  drawText(`Target: ${websiteUrl || domain}  (${report.pagesAudited} page${report.pagesAudited === 1 ? "" : "s"} audited)`, {
    x: MARGIN_X + 14,
    y: cursorY - 41,
    size: 8,
    font,
    color: slateText,
  });

  const auditDateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  drawText(`Date: ${auditDateStr}`, { x: PAGE_W - 155, y: cursorY - 12, size: 8.5, font, color: slateText });
  drawText(`Score: ${report.overallScore}/100 (${report.grade})`, {
    x: PAGE_W - 155,
    y: cursorY - 27,
    size: 10.5,
    font: boldFont,
    color: report.overallScore >= 80 ? emeraldGreen : report.overallScore >= 60 ? tealPrimary : roseRed,
  });
  drawText(`Quick Wins: ${report.healthOverview.quickWinsTotal}`, {
    x: PAGE_W - 155,
    y: cursorY - 41,
    size: 8,
    font: boldFont,
    color: tealPrimary,
  });

  cursorY -= 72;

  // ==================== 1. EXECUTIVE SUMMARY ====================
  drawSectionHeading("1. EXECUTIVE SUMMARY");
  drawParagraph(report.executiveSummary, 8.8, 95, darkNavy);
  if (takeaways && !report.executiveSummary.includes(takeaways.slice(0, 30))) {
    drawParagraph(`Audit Highlight: ${takeaways}`, 8.2, 95, slateText);
  }

  // ==================== 2. OVERALL TECHNICAL SEO HEALTH OVERVIEW ====================
  drawSectionHeading("2. OVERALL TECHNICAL SEO HEALTH OVERVIEW");
  drawParagraph(report.healthOverview.summary, 8.5, 95, slateText);

  // Core Web Vitals & Speed Telemetry Cards
  ensureSpace(58);
  const cwv = report.coreWebVitals;
  const cwvCards = [
    { label: "Server TTFB", val: `${cwv.ttfbMs} ms`, note: cwv.ttfbMs > 1000 ? "Needs Caching" : "Good [measured]" },
    {
      label: "LCP Speed",
      val: typeof cwv.lcpSec === "number" ? `${cwv.lcpSec}s` : "N/A",
      note: typeof cwv.lcpSec === "number" ? (cwv.lcpSec > 2.5 ? `Slow [${cwv.lcpSource}]` : `Good [${cwv.lcpSource}]`) : "Run PSI for live",
    },
    {
      label: "INP / Interactivity",
      val: typeof cwv.inpMs === "number" ? `${cwv.inpMs} ms` : "Not Measured",
      note: typeof cwv.inpMs === "number" ? (cwv.inpMs > 200 ? "High Delay" : "Responsive") : "PSI key / lab needed",
    },
    {
      label: "CLS / Layout Risk",
      val: typeof cwv.clsScore === "number" ? `${cwv.clsScore}` : `${cwv.clsRiskCount} page(s)`,
      note: cwv.clsRiskCount > 0 ? "Unsized Media Risk" : "Stable Layout",
    },
  ];
  const colW = CONTENT_W / 4;
  for (let i = 0; i < cwvCards.length; i++) {
    const c = cwvCards[i];
    const x = MARGIN_X + i * colW;
    page.drawRectangle({
      x,
      y: cursorY - 44,
      width: colW - 6,
      height: 46,
      color: lightBg,
      borderColor: borderGrey,
      borderWidth: 0.8,
    });
    drawText(c.label, { x: x + 6, y: cursorY - 12, size: 7, font: boldFont, color: slateText });
    drawText(c.val, { x: x + 6, y: cursorY - 26, size: 10, font: boldFont, color: darkNavy });
    drawText(c.note, {
      x: x + 6,
      y: cursorY - 38,
      size: 6.5,
      font,
      color: c.note.includes("Slow") || c.note.includes("Needs") || c.note.includes("Risk") || c.note.includes("Delay") ? roseRed : emeraldGreen,
    });
  }
  cursorY -= 56;

  // 9-Area Audit Scorecard
  ensureSpace(30);
  drawText("9-Pillar Technical Audit Coverage:", { x: MARGIN_X, y: cursorY, size: 9, font: boldFont, color: darkNavy });
  cursorY -= 14;
  for (const area of report.healthOverview.areaBreakdown) {
    ensureSpace(15);
    const statusColor = area.status === "Critical" ? roseRed : area.status === "Needs Attention" ? amberGold : emeraldGreen;
    drawText(`[${area.status.toUpperCase()}]`, { x: MARGIN_X, y: cursorY, size: 7.5, font: boldFont, color: statusColor });
    drawText(`${area.area} - ${area.summary}`, { x: MARGIN_X + 92, y: cursorY, size: 7.8, font, color: darkNavy });
    cursorY -= 13;
  }
  cursorY -= 6;

  // ==================== 3. DETAILED TECHNICAL SEO FINDINGS (QUICK WINS FIRST) ====================
  drawSectionHeading("3. DETAILED TECHNICAL SEO FINDINGS (QUICK WINS PRIORITIZED FIRST)");
  if (report.detailedFindings.length === 0) {
    drawParagraph("No confirmed technical SEO issues or recommendations were triggered across the audited URLs.", 8.8, 94, emeraldGreen);
  } else {
    report.detailedFindings.slice(0, 22).forEach((issue, idx) => {
      drawIssueCard(issue, String(idx + 1));
    });
  }

  // ==================== 4. CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION ====================
  drawSectionHeading("4. CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION");
  if (report.criticalIssues.length === 0) {
    drawParagraph("Zero High-Priority critical issues detected on the audited pages.", 8.8, 94, emeraldGreen);
  } else {
    report.criticalIssues.forEach((issue, idx) => {
      const line = `${idx + 1}. ${issue.issueName} [${issue.isQuickWin ? "QUICK WIN" : "ENGINEERING"}] - Affects ${issue.affectedUrlsCount} URL(s): ${issue.recommendedSolution}`;
      drawParagraph(line, 8.2, 95, darkNavy);
    });
  }

  // ==================== 5. RECOMMENDED FIXES AND ACTION PLAN (QUICK WINS FIRST) ====================
  drawSectionHeading("5. RECOMMENDED FIXES & ACTION PLAN (QUICK WINS FIRST)");
  const renderPlanGroup = (label: string, items: ClientAuditIssue[]) => {
    if (items.length === 0) return;
    ensureSpace(24);
    drawText(label, { x: MARGIN_X, y: cursorY, size: 9, font: boldFont, color: tealPrimary });
    cursorY -= 13;
    items.slice(0, 10).forEach((item, idx) => {
      drawParagraph(
        `${idx + 1}. ${item.issueName} (${item.priority} Priority, ${item.effortLabel}, ${item.affectedUrlsCount} URLs) -> ${item.recommendedSolution}`,
        8,
        95,
        darkNavy
      );
    });
  };
  renderPlanGroup("A. Quick Wins First (Highest ROI / Fast Implementation):", report.actionPlan.quickWinsFirst);
  renderPlanGroup("B. High & Medium Engineering Fixes:", report.actionPlan.mediumTermFixes);
  renderPlanGroup("C. Longer-Term Optimization:", report.actionPlan.longerTermEngineering);

  // ==================== 6. PRIORITY-WISE IMPLEMENTATION ROADMAP ====================
  drawSectionHeading("6. PRIORITY-WISE IMPLEMENTATION ROADMAP");
  const phases = [report.roadmap.phase1QuickWins, report.roadmap.phase2HighMedium, report.roadmap.phase3LongTerm];
  for (const ph of phases) {
    ensureSpace(26);
    drawText(`${ph.title} (${ph.timeline})`, { x: MARGIN_X, y: cursorY, size: 8.8, font: boldFont, color: darkNavy });
    cursorY -= 12;
    if (ph.items.length === 0) {
      drawParagraph("* No pending items in this phase.", 8, 95, slateText);
    } else {
      for (const item of ph.items.slice(0, 6)) {
        drawParagraph(`* [${item.priority}] ${item.issueName} (${item.affectedUrlsCount} URLs)`, 8, 95, slateText);
      }
    }
  }

  // ==================== 7. FINAL RECOMMENDATIONS ====================
  drawSectionHeading("7. FINAL RECOMMENDATIONS");
  for (const rec of report.finalRecommendations) {
    drawParagraph(`* ${rec}`, 8.5, 95, darkNavy);
  }

  // Draw branded consultancy footer across every page
  const footerContact = [
    `Email: ${contactEmail}`,
    contactPhone ? `Tel: ${contactPhone}` : null,
    `Web: ${contactWebsite}`,
  ]
    .filter(Boolean)
    .join("   |   ");

  pages.forEach((p, idx) => {
    p.drawLine({
      start: { x: MARGIN_X, y: 42 },
      end: { x: PAGE_W - MARGIN_X, y: 42 },
      thickness: 0.7,
      color: borderGrey,
    });
    p.drawText(sanitizeForPdf(`${brandName} | Technical SEO & Architecture Advisory`), {
      x: MARGIN_X,
      y: 30,
      size: 7.2,
      font: boldFont,
      color: darkNavy,
    });
    p.drawText(sanitizeForPdf(footerContact), {
      x: MARGIN_X,
      y: 20,
      size: 6.8,
      font,
      color: tealPrimary,
    });
    p.drawText(`Page ${idx + 1} of ${pages.length}`, {
      x: PAGE_W - 95,
      y: 25,
      size: 7.2,
      font,
      color: slateText,
    });
  });

  const pdfBytes = await doc.save();
  fs.writeFileSync(absolutePath, pdfBytes);

  const sharedDir = "/tmp/reports";
  let finalPath = absolutePath;
  try {
    if (!fs.existsSync(sharedDir)) {
      fs.mkdirSync(sharedDir, { recursive: true });
    }
    const sharedPath = path.join(sharedDir, filename);
    fs.writeFileSync(sharedPath, pdfBytes);
    finalPath = sharedPath;
  } catch {
    // fallback to absolutePath
  }

  return {
    success: true,
    filename,
    absolutePath: finalPath,
    sizeBytes: pdfBytes.length,
  };
}
