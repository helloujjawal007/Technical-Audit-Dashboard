import type { CheckResult, AuditResult, CheckCategory } from "@/types";

export type SemrushPillarId =
  | "crawlability"
  | "https"
  | "performance"
  | "internal-linking"
  | "markup"
  | "on-page";

export interface SemrushPillarData {
  id: SemrushPillarId;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  score: number;
  grade: string;
  passedCount: number;
  warnCount: number;
  failCount: number;
  totalChecks: number;
  checks: CheckResult[];
  status: "good" | "fair" | "poor";
}

export interface SemrushIssueGuidance {
  whyItMatters: string;
  howToFix: string;
  codeSnippet?: string;
  snippetLanguage?: string;
  difficulty: "Easy (5 mins)" | "Medium (15 mins)" | "Complex (Requires developer)";
  impactBoost: number; // Estimated % Site Health increase
}

export interface SemrushBottleneck {
  check: CheckResult;
  guidance: SemrushIssueGuidance;
  affectedUrls: string[];
  severity: "error" | "warning" | "notice";
}

export const SEMRUSH_GUIDANCE: Record<string, SemrushIssueGuidance> = {
  "duplicate-title": {
    whyItMatters:
      "Duplicate title tags across multiple pages or multiple <title> tags in HTML confuse search crawlers, cause cannibalization between your own pages, and dilute click-through rates from search results.",
    howToFix:
      "Ensure every page has exactly one unique <title> tag reflecting its specific topic and primary keyword.",
    codeSnippet: `<title>Unique Page Topic - Compelling Value Proposition | Brand</title>`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 8,
  },
  "duplicate-meta-description": {
    whyItMatters:
      "Search engines reject duplicate meta descriptions across pages or multiple description tags, defaulting to generic page snippet text. Unique descriptions increase CTR by up to 25%.",
    howToFix:
      "Write a unique, compelling meta description (120-160 characters) with a clear value proposition and call-to-action for every page.",
    codeSnippet: `<meta name="description" content="Unique compelling summary of this specific page with primary keyword and CTA." />`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 5,
  },
  "duplicate-h1": {
    whyItMatters:
      "Duplicate H1 headings across multiple pages or having your H1 copy the title tag verbatim wastes an opportunity to target secondary keywords and clarify page content hierarchy.",
    howToFix:
      "Provide a distinct, descriptive H1 heading for each page that complements the title tag rather than repeating it.",
    codeSnippet: `<h1>Unique Descriptive Section Heading</h1>`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 4,
  },
  "duplicate-canonical": {
    whyItMatters:
      "Declaring multiple <link rel='canonical'> tags on a single page creates conflicting instructions. Search engines typically discard all canonical declarations when duplicates exist, causing duplicate indexation.",
    howToFix:
      "Remove extra canonical tags from your CMS, templates, or plugins so that exactly one canonical tag exists in the <head>.",
    codeSnippet: `<link rel="canonical" href="https://example.com/unique-page" />`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 8,
  },
  "duplicate-content": {
    whyItMatters:
      "Search engines penalize pages with substantial blocks of identical or near-identical text, or high boilerplate-to-content ratios. They will often choose not to index duplicate versions.",
    howToFix:
      "Consolidate duplicate pages using 301 redirects or canonical tags, and enrich thin pages with unique body content.",
    codeSnippet: `<!-- Consolidate with canonical or rewrite unique body copy -->\n<link rel="canonical" href="https://example.com/authoritative-page" />`,
    snippetLanguage: "html",
    difficulty: "Medium (15 mins)",
    impactBoost: 7,
  },
  canonical: {
    whyItMatters:
      "Canonical tags tell search engines which URL represents the master copy of a page. A missing, broken, or insecure canonical tag leads to duplicate content penalties and splits search ranking equity.",
    howToFix:
      "Add a self-referencing absolute HTTPS canonical tag inside the HTML <head> of the page.",
    codeSnippet: `<link rel="canonical" href="https://yourdomain.com/exact-page-path" />`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 7,
  },
  "robots-meta": {
    whyItMatters:
      "Without an explicit robots meta tag, search engines rely on default crawler rules and may not render rich image previews or snippets in Google search results.",
    howToFix:
      "Add an explicit robots directive in your HTML <head> to ensure proper snippet rendering and max-image-preview permissions.",
    codeSnippet: `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 4,
  },
  noindex: {
    whyItMatters:
      "A noindex directive tells Google, Bing, and other crawlers NOT to index this page in search results. If accidental, this eliminates 100% of organic traffic to the page.",
    howToFix:
      "Remove the <meta name='robots' content='noindex'> or X-Robots-Tag HTTP header from your production web server or CMS settings.",
    codeSnippet: `<!-- Remove this line if indexing is intended -->\n<!-- <meta name="robots" content="noindex" /> -->`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 9,
  },
  h1: {
    whyItMatters:
      "The H1 heading is the primary topical signpost on the page. Missing, multiple, or empty H1 tags confuse search engine crawlers regarding what topic the page should rank for.",
    howToFix:
      "Use exactly one descriptive H1 heading at the top of the main content area. Demote secondary headings to H2 and H3 tags.",
    codeSnippet: `<h1>Primary Keyword Focused Page Title</h1>\n<h2>Supporting Section Heading</h2>`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 6,
  },
  headings: {
    whyItMatters:
      "A disorganized heading hierarchy makes it difficult for both screen readers and search bots to understand your content's outline.",
    howToFix:
      "Ensure headings follow logical sequential order (H1 -> H2 -> H3) without skipping levels.",
    codeSnippet: `<h1>Main Topic</h1>\n  <h2>Subtopic A</h2>\n    <h3>Detail 1</h3>\n  <h2>Subtopic B</h2>`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 3,
  },
  title: {
    whyItMatters:
      "The Title tag is the single most important clickable headline in Google SERPs. If it is too short (<30 chars) or too long (>60 chars), Google truncates or rewrites it.",
    howToFix:
      "Write a concise title between 50 and 60 characters with your target keyword near the beginning and brand at the end.",
    codeSnippet: `<title>Primary Keyword - Compelling Value Proposition | Brand</title>`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 5,
  },
  "meta-description": {
    whyItMatters:
      "The meta description is your organic search ad copy. A compelling description directly increases Click-Through Rate (CTR) from Google search.",
    howToFix:
      "Write a clear, persuasive 120-160 character description that explains what users will find and includes a call to action.",
    codeSnippet: `<meta name="description" content="Discover actionable SEO audits in under 2 minutes. Audit Core Web Vitals, fix technical issues, and improve organic rankings." />`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 4,
  },
  "author-publisher": {
    whyItMatters:
      "Google's Quality Rater Guidelines heavily weight E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness). Missing author/publisher attribution reduces content credibility.",
    howToFix:
      "Add an author meta tag and JSON-LD Person or Organization schema attributing the content to a verified subject matter expert.",
    codeSnippet: `<meta name="author" content="Jane Doe" />\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Person",\n  "name": "Jane Doe",\n  "jobTitle": "Lead SEO Specialist"\n}\n</script>`,
    snippetLanguage: "html",
    difficulty: "Medium (15 mins)",
    impactBoost: 4,
  },
  https: {
    whyItMatters:
      "HTTPS is a confirmed Google ranking signal. Insecure pages trigger browser security warnings that cause immediate visitor bounce.",
    howToFix:
      "Install an SSL/TLS certificate and configure a permanent 301 redirect from HTTP to HTTPS on your web server.",
    codeSnippet: `# Nginx 301 HTTPS Redirect\nserver {\n    listen 80;\n    server_name example.com www.example.com;\n    return 301 https://$host$request_uri;\n}`,
    snippetLanguage: "nginx",
    difficulty: "Medium (15 mins)",
    impactBoost: 8,
  },
  "bp-hsts": {
    whyItMatters:
      "HSTS (HTTP Strict Transport Security) protects against SSL-stripping man-in-the-middle attacks and enforces secure HTTPS connections in browsers.",
    howToFix:
      "Add the Strict-Transport-Security header to your web server response.",
    codeSnippet: `# Nginx HSTS configuration\nadd_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;`,
    snippetLanguage: "nginx",
    difficulty: "Easy (5 mins)",
    impactBoost: 3,
  },
  "img-alt": {
    whyItMatters:
      "Image alt attributes provide essential accessibility context for screen readers and enable Google Image search indexing.",
    howToFix:
      "Add descriptive alt text describing the image content. Use empty alt='' only for purely decorative graphics.",
    codeSnippet: `<img src="/images/chart.png" alt="Annual organic traffic growth bar chart 2025-2026" width="600" height="400" />`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 3,
  },
  "perf-img-dims": {
    whyItMatters:
      "Images without explicit width and height cause layout shifting as they load, increasing Cumulative Layout Shift (CLS) and hurting Core Web Vitals.",
    howToFix:
      "Always include width and height attributes or CSS aspect-ratio on all <img> elements.",
    codeSnippet: `<img src="/hero.webp" width="1200" height="630" alt="Dashboard preview" style="aspect-ratio: 1200/630;" />`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 4,
  },
  "structured-data": {
    whyItMatters:
      "Structured data enables Google Rich Snippets (stars, FAQ accordions, breadcrumbs, pricing) which significantly boosts organic CTR.",
    howToFix:
      "Add Schema.org JSON-LD structured data matching your page type (Organization, Article, Product, FAQPage).",
    codeSnippet: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "name": "Your Brand",\n  "url": "https://yourdomain.com"\n}\n</script>`,
    snippetLanguage: "html",
    difficulty: "Medium (15 mins)",
    impactBoost: 5,
  },
  "internal-links": {
    whyItMatters:
      "Pages with fewer than 5 internal links suffer from poor PageRank distribution and may become orphan pages difficult for Googlebot to discover.",
    howToFix:
      "Add contextual internal links with descriptive anchor text from related articles and high-authority pages.",
    codeSnippet: `<p>Learn more in our complete <a href="/guides/technical-seo">Technical SEO Checklist</a>.</p>`,
    snippetLanguage: "html",
    difficulty: "Easy (5 mins)",
    impactBoost: 4,
  },
  "response-time": {
    whyItMatters:
      "Slow Time-to-First-Byte (TTFB > 500ms) delays crawler discovery and directly increases visitor bounce rates.",
    howToFix:
      "Implement edge caching with a CDN (Cloudflare, Fastly), optimize database queries, and enable server response caching.",
    codeSnippet: `// Example Cache-Control header in Next.js\nexport const revalidate = 3600; // Cache on edge for 1 hour`,
    snippetLanguage: "javascript",
    difficulty: "Complex (Requires developer)",
    impactBoost: 6,
  },
  "sitemap": {
    whyItMatters:
      "An XML sitemap helps search engines discover all canonical URLs on your website, including newly published or updated content.",
    howToFix:
      "Generate an XML sitemap at /sitemap.xml and reference it in your robots.txt file.",
    codeSnippet: `User-agent: *\nAllow: /\n\nSitemap: https://yourdomain.com/sitemap.xml`,
    snippetLanguage: "text",
    difficulty: "Easy (5 mins)",
    impactBoost: 5,
  },
  "robots-txt": {
    whyItMatters:
      "A valid robots.txt file guides web crawlers on which areas of your site should not be accessed, conserving crawl budget.",
    howToFix:
      "Deploy a robots.txt file in your domain root allowing indexable content and referencing your sitemap.",
    codeSnippet: `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: https://yourdomain.com/sitemap.xml`,
    snippetLanguage: "text",
    difficulty: "Easy (5 mins)",
    impactBoost: 4,
  },
  "security-headers": {
    whyItMatters:
      "Missing security headers leaves your site vulnerable to cross-site scripting (XSS), clickjacking, and mime-type sniffing.",
    howToFix:
      "Configure X-Frame-Options, X-Content-Type-Options, and Content-Security-Policy headers.",
    codeSnippet: `X-Frame-Options: SAMEORIGIN\nX-Content-Type-Options: nosniff\nReferrer-Policy: strict-origin-when-cross-origin`,
    snippetLanguage: "http",
    difficulty: "Medium (15 mins)",
    impactBoost: 3,
  },
};

export function getIssueGuidance(check: CheckResult): SemrushIssueGuidance {
  if (SEMRUSH_GUIDANCE[check.id]) {
    return SEMRUSH_GUIDANCE[check.id];
  }
  const isFail = check.status === "fail";
  return {
    whyItMatters: `This audit check flags a ${isFail ? "critical" : "potential"} issue on the audited page. ${check.detail}`,
    howToFix:
      "Inspect the affected page source, review the check recommendation, and apply standard SEO best practices. Re-run the audit once deployed.",
    difficulty: isFail ? "Medium (15 mins)" : "Easy (5 mins)",
    impactBoost: isFail ? 4 : 2,
  };
}

/**
 * Categorizes all audit checks into the 6 SEMrush Thematic Pillars
 */
export function buildSemrushPillars(result: AuditResult): SemrushPillarData[] {
  const checks = result.checks || [];

  const pillarDefinitions: {
    id: SemrushPillarId;
    label: string;
    shortLabel: string;
    description: string;
    icon: string;
    checkIds: string[];
    fallbackCategory?: CheckCategory;
  }[] = [
    {
      id: "crawlability",
      label: "Crawlability & Indexability",
      shortLabel: "Crawlability",
      description: "Robots directives, XML sitemaps, canonical tags, noindex tags, HTTP status codes",
      icon: "Server",
      checkIds: ["status", "canonical", "duplicate-canonical", "robots-meta", "robots-txt", "sitemap", "sitemap-in-robots", "noindex", "redirect-followed", "perf-redirects"],
      fallbackCategory: "technical",
    },
    {
      id: "https",
      label: "HTTPS & Site Security",
      shortLabel: "HTTPS",
      description: "SSL/TLS protocol validity, mixed content, HSTS, security headers, protocol canonicals",
      icon: "ShieldCheck",
      checkIds: ["https", "security-headers", "bp-hsts", "bp-https-redirect", "bp-csp", "bp-clickjacking", "bp-third-party-cookies"],
    },
    {
      id: "performance",
      label: "Core Web Vitals & Speed",
      shortLabel: "Performance",
      description: "TTFB server latency, HTML page size, CSS/JS resources, compression, CLS layout stability",
      icon: "Gauge",
      checkIds: ["response-time", "perf-server-latency", "html-size", "perf-payload", "perf-cls", "perf-img-dims", "perf-render-blocking", "perf-compression", "compression", "perf-css-count", "perf-js-count", "perf-viewport", "viewport"],
      fallbackCategory: "performance",
    },
    {
      id: "internal-linking",
      label: "Internal Linking Architecture",
      shortLabel: "Internal Links",
      description: "Link equity distribution, click depth, internal vs external ratio, anchor text quality",
      icon: "Link2",
      checkIds: ["internal-links", "anchor-text", "dofollow-links", "nofollow-links", "external-links"],
      fallbackCategory: "off-page",
    },
    {
      id: "markup",
      label: "Structured Data & Markup",
      shortLabel: "Markup",
      description: "Schema.org structured data, JSON-LD, Open Graph, Twitter cards, rich snippets eligibility",
      icon: "Boxes",
      checkIds: ["structured-data", "faq", "open-graph", "twitter-cards", "favicon", "toc", "infographic"],
    },
    {
      id: "on-page",
      label: "On-Page SEO & Content Quality",
      shortLabel: "On-Page SEO",
      description: "Title & meta description length, H1 structure, content depth, image alt text, E-E-A-T attribution",
      icon: "FileText",
      checkIds: ["title", "meta-description", "h1", "headings", "content-length", "duplicate-content", "duplicate-title", "duplicate-meta-description", "duplicate-h1", "keyword-density", "author-publisher", "img-alt", "html-lang"],
      fallbackCategory: "on-page",
    },
  ];

  return pillarDefinitions.map((def) => {
    // Gather matching checks
    const pillarChecks = checks.filter((c) => {
      if (def.checkIds.includes(c.id)) return true;
      if (def.fallbackCategory && c.category === def.fallbackCategory) {
        // Only take if not claimed by explicit checkIds of other pillars
        const claimedElsewhere = pillarDefinitions.some(
          (other) => other.id !== def.id && other.checkIds.includes(c.id)
        );
        return !claimedElsewhere;
      }
      return false;
    });

    const passedCount = pillarChecks.filter((c) => c.status === "pass").length;
    const warnCount = pillarChecks.filter((c) => c.status === "warn").length;
    const failCount = pillarChecks.filter((c) => c.status === "fail").length;
    const total = pillarChecks.length;

    let score = 100;
    if (total > 0) {
      // Each fail deducts 18 points, each warn deducts 8 points
      const deduction = failCount * 18 + warnCount * 8;
      score = Math.max(10, Math.min(100, Math.round(100 - (deduction / (total * 18)) * 90)));
    }

    let grade = "A";
    let status: "good" | "fair" | "poor" = "good";
    if (score >= 90) {
      grade = "A+";
      status = "good";
    } else if (score >= 80) {
      grade = "A";
      status = "good";
    } else if (score >= 65) {
      grade = "B";
      status = "fair";
    } else if (score >= 50) {
      grade = "C";
      status = "fair";
    } else {
      grade = "D";
      status = "poor";
    }

    return {
      id: def.id,
      label: def.label,
      shortLabel: def.shortLabel,
      description: def.description,
      icon: def.icon,
      score,
      grade,
      passedCount,
      warnCount,
      failCount,
      totalChecks: total,
      checks: pillarChecks,
      status,
    };
  });
}

/**
 * Extracts Top Bottlenecks ranked by potential Site Health boost
 */
export function getTopBottlenecks(result: AuditResult, url: string): SemrushBottleneck[] {
  const checks = result.checks || [];
  const actionItems = checks.filter((c) => c.status === "fail" || c.status === "warn");

  const bottlenecks: SemrushBottleneck[] = actionItems.map((check) => {
    const guidance = getIssueGuidance(check);
    const severity: "error" | "warning" | "notice" =
      check.status === "fail" ? "error" : "warning";
    return {
      check,
      guidance,
      affectedUrls: [url],
      severity,
    };
  });

  // Sort by severity (error first), then by impactBoost descending
  return bottlenecks.sort((a, b) => {
    if (a.severity === "error" && b.severity !== "error") return -1;
    if (b.severity === "error" && a.severity !== "error") return 1;
    return b.guidance.impactBoost - a.guidance.impactBoost;
  });
}

