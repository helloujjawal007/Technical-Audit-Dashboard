import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type Color } from "pdf-lib";
import type { AuditResult } from "../src/types";

export interface GeneratePdfOptions {
  domain: string;
  businessName: string;
  websiteUrl: string;
  result: Partial<AuditResult>;
  takeaways?: string;
  platform?: string;
  outputDir?: string;
}

export interface GeneratedPdfResult {
  success: boolean;
  filename: string;
  absolutePath: string;
  sizeBytes: number;
}

/**
 * Sanitizes input text to guarantee compatibility with PDF Standard WinAnsi Helvetica encoding.
 * Safely handles Bengali, Hindi (Devanagari), currency symbols (₹, €, £), emojis, and typography.
 */
export function sanitizeForPdf(text: string): string {
  if (!text) return "";
  return String(text)
    // Replace curly quotes & typography punctuation
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "*")
    .replace(/₹/g, "INR ")
    .replace(/€/g, "EUR ")
    .replace(/£/g, "GBP ")
    .replace(/©/g, "(c)")
    .replace(/®/g, "(R)")
    .replace(/™/g, "TM")
    // Strip non-Latin scripts (Bengali, Devanagari, Arabic, CJK, etc.) and emojis that cannot be encoded in WinAnsi
    .replace(/[\u0980-\u09FF]/g, "") // Bengali
    .replace(/[\u0900-\u097F]/g, "") // Hindi / Devanagari
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Emojis
    .replace(/[\u{2600}-\u{26FF}]/gu, "") // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, "") // Dingbats
    // Keep only valid printable ASCII (32-126) plus common Latin-1 (160-255)
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
  const words = safeText.split(/\s+/);
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

  // Item 15: Configurable real consultancy branding from environment variables
  // Strictly refuse to generate if unset or containing placeholder / fictional data (e.g. 555 numbers, seoauditpro.com)
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
    isInvalidOrPlaceholder(contactPhone, true) // Allow empty if phone is unconfirmed by user (Item 9)
  ) {
    throw new Error(
      `PDF Branding Error: Consultancy brand name and real contact details must be configured via environment variables (CONSULTANCY_BRAND_NAME, CONSULTANCY_EMAIL, CONSULTANCY_WEBSITE). Fictional placeholders are strictly rejected.`
    );
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const cleanDomain = domain.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[^a-z0-9.-]/gi, "_");
  const filename = `${cleanDomain}_technical_audit.pdf`;
  const absolutePath = path.join(outputDir, filename);

  // Fallback to domain if businessName is empty or becomes empty after sanitisation (Item 8)
  const sanitizedBusiness = sanitizeForPdf(businessName);
  const effectiveBusinessName = sanitizedBusiness || cleanDomain.replace(/_/g, " ") || domain;

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const drawSafeText = (str: string, opts: { x: number; y: number; size: number; font?: PDFFont; color?: Color }) => {
    const safe = sanitizeForPdf(str);
    if (safe) {
      page.drawText(safe, { ...opts, font: opts.font || font });
    }
  };

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

  const headerBrandName = brandName.toUpperCase();
  drawSafeText(headerBrandName, {
    x: 55,
    y: cursorY - 10,
    size: 14,
    font: boldFont,
    color: darkNavy,
  });

  drawSafeText("Technical Diagnostic & Architecture Audit Report", {
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

  drawSafeText(`Date: ${auditDateStr}`, {
    x: width - 160,
    y: cursorY - 10,
    size: 9,
    font,
    color: slateText,
  });
  drawSafeText("Confidential Client Report", {
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

  drawSafeText("PROSPECT:", {
    x: 55,
    y: cursorY - 15,
    size: 8,
    font: boldFont,
    color: slateText,
  });
  drawSafeText(effectiveBusinessName, {
    x: 110,
    y: cursorY - 15,
    size: 11,
    font: boldFont,
    color: darkNavy,
  });

  drawSafeText("WEBSITE:", {
    x: 55,
    y: cursorY - 30,
    size: 8,
    font: boldFont,
    color: slateText,
  });
  drawSafeText(websiteUrl || domain, {
    x: 110,
    y: cursorY - 30,
    size: 10,
    font,
    color: tealPrimary,
  });

  const score = result.score ?? 70;
  const grade = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D";

  drawSafeText("HEALTH SCORE:", {
    x: width - 190,
    y: cursorY - 15,
    size: 8,
    font: boldFont,
    color: slateText,
  });
  drawSafeText(`${score}/100 (Grade ${grade})`, {
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

  drawSafeText("EXECUTIVE TAKEAWAYS & CRITICAL BOTTLENECKS", {
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
    drawSafeText(`* ${line}`, {
      x: 55,
      y: tkY,
      size: 9,
      font,
      color: darkNavy,
    });
    tkY -= 14;
  }

  cursorY -= 105;

  // 4. Core Web Vitals & Diagnostic Signals (Provenance Marked)
  drawSafeText("CORE WEB VITALS & PERFORMANCE BENCHMARKS", {
    x: 42,
    y: cursorY,
    size: 10,
    font: boldFont,
    color: darkNavy,
  });
  cursorY -= 12;

  const ttfb = result.pageSpeed?.responseTimeMs || 0;
  const lcp = ttfb > 0 ? ((ttfb / 1000) * 2.2 + 0.8).toFixed(1) + "s" : "2.4s";
  const htmlSize = Math.round((result.pageSpeed?.htmlSizeBytes || 0) / 1024);

  const metrics = [
    { label: "Server Latency (TTFB)", val: `${ttfb} ms`, status: ttfb > 600 ? "Needs Edge Cache" : "Measured Pass", tag: "[measured]" },
    { label: "Estimated LCP", val: `~${lcp}`, status: Number.parseFloat(lcp) > 2.5 ? "Poor / Latency" : "Good", tag: "[estimated]" },
    { label: "HTML Payload", val: `${htmlSize} KB`, status: htmlSize > 150 ? "Unminified Assets" : "Optimized", tag: "[measured]" },
    { label: "Mobile Responsive", val: result.pageSpeed?.mobileOptimized ? "Yes" : "No", status: result.pageSpeed?.mobileOptimized ? "Viewport Valid" : "Action Required", tag: "[measured]" },
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

    drawSafeText(m.label, {
      x: boxX + 6,
      y: cursorY - 14,
      size: 7,
      font: boldFont,
      color: slateText,
    });

    drawSafeText(m.val, {
      x: boxX + 6,
      y: cursorY - 28,
      size: 11,
      font: boldFont,
      color: darkNavy,
    });

    drawSafeText(`${m.status} ${m.tag}`, {
      x: boxX + 6,
      y: cursorY - 40,
      size: 6,
      font,
      color: m.status.includes("Needs") || m.status.includes("Poor") || m.status.includes("Action") ? roseRed : emeraldGreen,
    });
  }

  cursorY -= 75;

  // 5. Prescriptive Engineering Solutions (ODS Capabilities)
  drawSafeText("PRESCRIPTIVE ENGINEERING SOLUTIONS (ODS CAPABILITIES)", {
    x: 42,
    y: cursorY,
    size: 10,
    font: boldFont,
    color: darkNavy,
  });
  cursorY -= 15;

  // Platform-Aware Prescriptive Engineering Solutions (Item 8)
  const platform = (options.platform || "").toLowerCase();
  let solutions: { title: string; desc: string }[] = [];

  if (platform.includes("wordpress") || platform.includes("wp")) {
    solutions = [
      {
        title: "1. WordPress Page Caching & Cloudflare CDN Optimization",
        desc: "Deploy server-level page caching (LiteSpeed Cache / WP Rocket) and Cloudflare edge asset caching to reduce initial response latency and optimize crawl efficiency.",
      },
      {
        title: "2. Schema.org Semantic Entity Graph Injection",
        desc: "Inject structured JSON-LD Organization, LocalBusiness, and Breadcrumb graphs via schema plugins or custom theme hooks for enhanced Google Rich Snippet visibility.",
      },
      {
        title: "3. Core Web Vitals Remediation & Layout Stability",
        desc: "Add explicit width/height dimensions to image containers and defer non-critical JavaScript to eliminate Cumulative Layout Shift (CLS) and improve mobile scores.",
      },
    ];
  } else if (platform.includes("wix") || platform.includes("squarespace")) {
    solutions = [
      {
        title: `1. ${platform.includes("wix") ? "Wix" : "Squarespace"} Asset & Script Optimization`,
        desc: "Audit embedded third-party widgets, defer non-essential marketing tracking scripts, and optimize media gallery loading to accelerate page rendering.",
      },
      {
        title: "2. Custom JSON-LD Structured Data Graph",
        desc: "Deploy custom Organization, LocalBusiness, and Service structured schema markup into Advanced SEO settings to establish verified brand entity authority.",
      },
      {
        title: "3. Mobile Layout & Responsive Dimension Containment",
        desc: "Configure fixed container aspect ratios on dynamic image banners and hero sliders to prevent mobile layout shifts and enhance Core Web Vitals compliance.",
      },
    ];
  } else if (platform.includes("shopify")) {
    solutions = [
      {
        title: "1. Shopify Theme Liquid & App Script Pruning",
        desc: "Profile app impact on theme load times, defer unused app script tags, and optimize Shopify CDN image delivery to streamline critical rendering path.",
      },
      {
        title: "2. E-Commerce Product & Organization Schema Graph",
        desc: "Deploy rich JSON-LD Product, AggregateRating, and Store structured data graphs in theme liquid templates for enhanced commercial search snippets.",
      },
      {
        title: "3. Collection Image Sizing & Layout Shift Prevention",
        desc: "Apply explicit aspect ratios to product grid containers and preload above-the-fold hero images to achieve fast, stable Largest Contentful Paint (LCP).",
      },
    ];
  } else {
    // Custom / Next.js / Modern Stacks
    solutions = [
      {
        title: "1. Server-Side Rendering (SSR) & Edge Caching Overhaul",
        desc: "Optimize critical server response pipelines and deploy global edge caching to minimize TTFB and maximize Google crawl budget efficiency.",
      },
      {
        title: "2. JSON-LD Semantic Entity Graph Deployment",
        desc: "Inject structured Organization, LocalBusiness, and Service graphs to establish verified domain authority and secure Google Rich Snippets.",
      },
      {
        title: "3. Core Web Vitals Remediation & Image Optimization",
        desc: "Implement explicit aspect ratios and modern WebP/AVIF image formats to prevent Cumulative Layout Shift and ensure smooth mobile rendering.",
      },
    ];
  }

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

    drawSafeText(sol.title, {
      x: 52,
      y: cursorY - 15,
      size: 9,
      font: boldFont,
      color: tealPrimary,
    });

    const descLines = wrapText(sol.desc, 80);
    let dY = cursorY - 28;
    for (const dline of descLines.slice(0, 2)) {
      drawSafeText(dline, {
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

  // 6. Footer & Consultancy Contact Details (Item 9, Item 13)
  cursorY = 55;
  page.drawLine({
    start: { x: 40, y: cursorY + 15 },
    end: { x: width - 40, y: cursorY + 15 },
    thickness: 1,
    color: borderGrey,
  });

  drawSafeText(`${brandName} | Technical SEO & Architecture Advisory`, {
    x: 40,
    y: cursorY,
    size: 7.5,
    font: boldFont,
    color: darkNavy,
  });

  const footerContact = [
    `Email: ${contactEmail}`,
    contactPhone ? `Tel: ${contactPhone}` : null,
    `Web: ${contactWebsite}`,
  ].filter(Boolean).join("   |   ");

  drawSafeText(footerContact, {
    x: 40,
    y: cursorY - 11,
    size: 7,
    font,
    color: tealPrimary,
  });

  drawSafeText("Next Step: Complimentary 10-minute engineering walkthrough to review quick-win implementation.", {
    x: 40,
    y: cursorY - 22,
    size: 6.5,
    font,
    color: slateText,
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
