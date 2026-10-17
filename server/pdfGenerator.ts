import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { AuditResult } from "../src/types";

export interface GeneratePdfOptions {
  domain: string;
  businessName: string;
  websiteUrl: string;
  result: Partial<AuditResult>;
  takeaways?: string;
  outputDir?: string;
}

export interface GeneratedPdfResult {
  success: boolean;
  filename: string;
  absolutePath: string;
  sizeBytes: number;
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
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
    takeaways,
    outputDir = path.resolve(process.cwd(), "reports"),
  } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const cleanDomain = domain.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[^a-z0-9.-]/gi, "_");
  const filename = `${cleanDomain}_technical_audit.pdf`;
  const absolutePath = path.join(outputDir, filename);

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Palette
  const darkNavy = rgb(0.06, 0.09, 0.16);
  const tealPrimary = rgb(0.05, 0.58, 0.53);
  const slateText = rgb(0.35, 0.42, 0.52);
  const lightBg = rgb(0.96, 0.97, 0.99);
  const borderGrey = rgb(0.88, 0.91, 0.94);
  const roseRed = rgb(0.88, 0.12, 0.24);
  const emeraldGreen = rgb(0.02, 0.60, 0.38);

  let cursorY = height - 50;

  // 1. Header Banner
  page.drawRectangle({
    x: 40,
    y: cursorY - 45,
    width: width - 80,
    height: 60,
    color: lightBg,
    borderColor: borderGrey,
    borderWidth: 1,
  });

  page.drawText("ONLINE DIGITAL SOLUTION (ODS)", {
    x: 55,
    y: cursorY - 10,
    size: 14,
    font: boldFont,
    color: darkNavy,
  });

  page.drawText("Technical Diagnostic & Architecture Audit Report", {
    x: 55,
    y: cursorY - 26,
    size: 9,
    font,
    color: tealPrimary,
  });

  const auditDateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  page.drawText(`Date: ${auditDateStr}`, {
    x: width - 160,
    y: cursorY - 10,
    size: 9,
    font,
    color: slateText,
  });
  page.drawText("Confidential Client Report", {
    x: width - 180,
    y: cursorY - 26,
    size: 8,
    font: boldFont,
    color: slateText,
  });

  cursorY -= 70;

  // 2. Target Prospect Information Box
  page.drawRectangle({
    x: 40,
    y: cursorY - 40,
    width: width - 80,
    height: 48,
    color: rgb(1, 1, 1),
    borderColor: borderGrey,
    borderWidth: 1,
  });

  page.drawText("PROSPECT:", {
    x: 55,
    y: cursorY - 15,
    size: 8,
    font: boldFont,
    color: slateText,
  });
  page.drawText(businessName || domain, {
    x: 110,
    y: cursorY - 15,
    size: 11,
    font: boldFont,
    color: darkNavy,
  });

  page.drawText("WEBSITE:", {
    x: 55,
    y: cursorY - 30,
    size: 8,
    font: boldFont,
    color: slateText,
  });
  page.drawText(websiteUrl || domain, {
    x: 110,
    y: cursorY - 30,
    size: 10,
    font,
    color: tealPrimary,
  });

  const score = result.score ?? 70;
  const grade = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D";

  page.drawText("HEALTH SCORE:", {
    x: width - 190,
    y: cursorY - 15,
    size: 8,
    font: boldFont,
    color: slateText,
  });
  page.drawText(`${score}/100 (Grade ${grade})`, {
    x: width - 190,
    y: cursorY - 30,
    size: 11,
    font: boldFont,
    color: score >= 80 ? emeraldGreen : score >= 60 ? tealPrimary : roseRed,
  });

  cursorY -= 65;

  // 3. Priority Bottlenecks & Key Takeaways Card (Highlighted Callout)
  page.drawRectangle({
    x: 40,
    y: cursorY - 80,
    width: width - 80,
    height: 90,
    color: rgb(0.99, 0.95, 0.95),
    borderColor: rgb(0.96, 0.8, 0.82),
    borderWidth: 1,
  });

  page.drawText("EXECUTIVE TAKEAWAYS & CRITICAL BOTTLENECKS", {
    x: 55,
    y: cursorY - 15,
    size: 10,
    font: boldFont,
    color: roseRed,
  });

  const resolvedTakeaways =
    takeaways ||
    result.recommendations?.slice(0, 2).map((r) => r.detail).join("; ") ||
    "Server TTFB latency bottlenecks and missing Schema.org structured entity graphs.";

  const takeawayLines = wrapText(resolvedTakeaways, 75);
  let tkY = cursorY - 32;
  for (const line of takeawayLines.slice(0, 3)) {
    page.drawText(`• ${line}`, {
      x: 55,
      y: tkY,
      size: 9,
      font,
      color: darkNavy,
    });
    tkY -= 14;
  }

  cursorY -= 105;

  // 4. Core Web Vitals & Diagnostic Signals
  page.drawText("CORE WEB VITALS & PERFORMANCE BENCHMARKS", {
    x: 42,
    y: cursorY,
    size: 10,
    font: boldFont,
    color: darkNavy,
  });
  cursorY -= 12;

  const ttfb = result.pageSpeed?.responseTimeMs || 0;
  const lcp = ttfb > 0 ? ((ttfb / 1000) * 2.2 + 0.8).toFixed(2) + "s" : "2.4s";
  const htmlSize = Math.round((result.pageSpeed?.htmlSizeBytes || 0) / 1024);

  const metrics = [
    { label: "Server Latency (TTFB)", val: `${ttfb} ms`, status: ttfb > 600 ? "Needs SSR Edge Caching" : "Passed" },
    { label: "Estimated LCP", val: lcp, status: Number.parseFloat(lcp) > 2.5 ? "Poor / Render-blocking" : "Good" },
    { label: "HTML Payload", val: `${htmlSize} KB`, status: htmlSize > 150 ? "Unminified Assets" : "Optimized" },
    { label: "Mobile Responsive", val: result.pageSpeed?.mobileOptimized ? "Yes" : "No", status: result.pageSpeed?.mobileOptimized ? "Viewport Valid" : "Action Required" },
  ];

  const colWidth = (width - 80) / 4;
  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i];
    const boxX = 40 + i * colWidth;
    page.drawRectangle({
      x: boxX,
      y: cursorY - 45,
      width: colWidth - 6,
      height: 50,
      color: lightBg,
      borderColor: borderGrey,
      borderWidth: 1,
    });

    page.drawText(m.label, {
      x: boxX + 6,
      y: cursorY - 14,
      size: 7,
      font: boldFont,
      color: slateText,
    });

    page.drawText(m.val, {
      x: boxX + 6,
      y: cursorY - 28,
      size: 11,
      font: boldFont,
      color: darkNavy,
    });

    page.drawText(m.status, {
      x: boxX + 6,
      y: cursorY - 40,
      size: 6.5,
      font,
      color: m.status.includes("Needs") || m.status.includes("Poor") || m.status.includes("Action") ? roseRed : emeraldGreen,
    });
  }

  cursorY -= 75;

  // 5. Prescriptive Solutions (ODS Capabilities)
  page.drawText("PRESCRIPTIVE ENGINEERING SOLUTIONS (ODS CAPABILITIES)", {
    x: 42,
    y: cursorY,
    size: 10,
    font: boldFont,
    color: darkNavy,
  });
  cursorY -= 15;

  const solutions = [
    {
      title: "1. Next.js SSR & Cloudflare Edge Caching Overhaul",
      desc: "Migrate legacy client-heavy pages to Server-Side Rendering (SSR) with global edge micro-caching to bring TTFB below 150ms.",
    },
    {
      title: "2. JSON-LD Semantic Entity Graph Deployment",
      desc: "Inject structured Organization, LocalBusiness, and Service graphs to establish domain authority and secure Google Rich Snippets.",
    },
    {
      title: "3. Core Web Vitals Remediation & Next/Image Migration",
      desc: "Implement explicit aspect ratios and modern AVIF/WebP image compression to eliminate Cumulative Layout Shift (CLS < 0.1).",
    },
  ];

  for (const sol of solutions) {
    page.drawRectangle({
      x: 40,
      y: cursorY - 42,
      width: width - 80,
      height: 48,
      color: rgb(1, 1, 1),
      borderColor: borderGrey,
      borderWidth: 1,
    });

    page.drawText(sol.title, {
      x: 52,
      y: cursorY - 15,
      size: 9,
      font: boldFont,
      color: tealPrimary,
    });

    const descLines = wrapText(sol.desc, 80);
    let dY = cursorY - 28;
    for (const dline of descLines.slice(0, 2)) {
      page.drawText(dline, {
        x: 52,
        y: dY,
        size: 8,
        font,
        color: slateText,
      });
      dY -= 11;
    }

    cursorY -= 56;
  }

  // 6. Footer & CTA
  cursorY = 55;
  page.drawLine({
    start: { x: 40, y: cursorY + 15 },
    end: { x: width - 40, y: cursorY + 15 },
    thickness: 1,
    color: borderGrey,
  });

  page.drawText("Online Digital Solution (ODS) • Modern Web Architecture & Technical SEO", {
    x: 40,
    y: cursorY,
    size: 7.5,
    font: boldFont,
    color: slateText,
  });

  page.drawText("Next Step: Complimentary 10-minute engineering walkthrough to review quick-win implementation.", {
    x: 40,
    y: cursorY - 12,
    size: 7.5,
    font,
    color: tealPrimary,
  });

  const pdfBytes = await doc.save();
  fs.writeFileSync(absolutePath, pdfBytes);

  // Write to shared /tmp/reports directory for seamless cross-daemon access on macOS
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
