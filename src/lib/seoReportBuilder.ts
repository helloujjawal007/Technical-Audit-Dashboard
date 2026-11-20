import type {
  AreaHealthSummary,
  AuditIssuePriority,
  AuditResult,
  CheckResult,
  ClientAuditIssue,
  ClientSeoAuditReport,
  TechnicalAuditArea,
} from "../types";

export const AUDIT_AREAS_ORDER: TechnicalAuditArea[] = [
  "Crawlability & Indexability",
  "Website Architecture & Internal Linking",
  "Website Performance & Core Web Vitals",
  "On-Page Technical SEO",
  "Structured Data & Schema",
  "Mobile SEO",
  "Website Security",
  "International & Local SEO",
  "Additional Technical Issues",
];

interface DuplicatesSummaryInput {
  duplicateTitles?: { title: string; count: number; urls: string[] }[];
  duplicateDescriptions?: { description: string; count: number; urls: string[] }[];
  duplicateH1s?: { h1: string; count: number; urls: string[] }[];
  orphanInboundUrls?: string[];
}

export interface BuildReportOptions {
  websiteUrl: string;
  businessName?: string;
  platform?: string;
  primaryResult: Partial<AuditResult>;
  batchResults?: Partial<AuditResult>[];
  duplicatesSummary?: DuplicatesSummaryInput;
  psiMetrics?: {
    lcpSec?: number;
    inpMs?: number;
    clsScore?: number;
    performanceScore?: number;
  };
}

interface IssueRuleDefinition {
  id: string;
  issueName: string;
  area: TechnicalAuditArea;
  findingType?: "Confirmed Issue" | "Optimization Recommendation";
  priority: AuditIssuePriority;
  isQuickWin: boolean;
  effortLabel: string;
  impactScore: number;
  matchCheckIds?: string[];
  matchStatuses?: ("fail" | "warn" | "info")[];
  customMatch?: (page: Partial<AuditResult>, allPages: Partial<AuditResult>[]) => boolean;
  buildDescription: (matchedPages: Partial<AuditResult>[], allPages: Partial<AuditResult>[], extraDetail: string) => string;
  seoImpact: string;
  recommendedSolution: string;
}

function getPageUrl(page: Partial<AuditResult>, fallbackUrl: string): string {
  return (page.url || fallbackUrl || "").trim();
}

function uniqueUrls(urls: string[], limit = 5): string[] {
  return Array.from(new Set(urls.filter(Boolean))).slice(0, limit);
}

function priorityWeight(priority: AuditIssuePriority): number {
  if (priority === "High") return 300;
  if (priority === "Medium") return 200;
  return 100;
}

function sortIssuesQuickWinsFirst(a: ClientAuditIssue, b: ClientAuditIssue): number {
  if (a.findingType !== b.findingType) {
    return a.findingType === "Confirmed Issue" ? -1 : 1;
  }
  const pDiff = priorityWeight(b.priority) - priorityWeight(a.priority);
  if (pDiff !== 0) return pDiff;
  if (a.isQuickWin !== b.isQuickWin) return a.isQuickWin ? -1 : 1;
  return b.impactScore - a.impactScore || b.affectedUrlsCount - a.affectedUrlsCount;
}

const ISSUE_RULES: IssueRuleDefinition[] = [
  // 1. Crawlability & Indexability
  {
    id: "cw-noindex",
    issueName: "Pages Blocked From Indexing (Noindex Directive)",
    area: "Crawlability & Indexability",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (10-15 mins)",
    impactScore: 99,
    matchCheckIds: ["noindex"],
    matchStatuses: ["fail"],
    buildDescription: (matched) =>
      `${matched.length} audited page(s) carry a meta robots or HTTP X-Robots-Tag "noindex" directive, preventing Google and Bing from indexing them.`,
    seoImpact: "Search engines completely exclude these pages from search results, eliminating 100% of their potential organic traffic.",
    recommendedSolution: "Remove the 'noindex' directive from production templates or HTTP headers on any pages meant to attract search visitors.",
  },
  {
    id: "cw-canonical-missing",
    issueName: "Missing or Misconfigured Canonical Tags",
    area: "Crawlability & Indexability",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (15-30 mins)",
    impactScore: 92,
    matchCheckIds: ["canonical"],
    matchStatuses: ["fail"],
    buildDescription: (matched) =>
      `${matched.length} page(s) lack a valid HTTPS self-referencing <link rel="canonical"> tag.`,
    seoImpact: "Without clear canonical tags, search engines may index duplicate URL variations (with tracking parameters or trailing slashes) and split ranking power across copies.",
    recommendedSolution: "Add a clean, self-referencing absolute HTTPS <link rel=\"canonical\"> tag in the <head> of every indexable page.",
  },
  {
    id: "cw-duplicate-canonical",
    issueName: "Multiple Conflicting Canonical Tags on Single Page",
    area: "Crawlability & Indexability",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (15 mins)",
    impactScore: 91,
    matchCheckIds: ["duplicate-canonical"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) declare multiple canonical link elements in their HTML.`,
    seoImpact: "When conflicting canonical tags exist, Google often ignores all of them, exposing the site to duplicate-content indexing confusion.",
    recommendedSolution: "Audit active SEO plugins or theme templates to output exactly one canonical tag per page.",
  },
  {
    id: "cw-broken-internal",
    issueName: "Broken Internal Links (HTTP 4xx / 5xx Errors)",
    area: "Crawlability & Indexability",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (20-45 mins)",
    impactScore: 94,
    matchCheckIds: ["broken-links"],
    matchStatuses: ["fail"],
    buildDescription: (matched, _all, extra) =>
      `${matched.length} page(s) contain broken internal links returning 404/5xx errors${extra ? ` (e.g., ${extra})` : ""}.`,
    seoImpact: "Broken links create dead ends for visitors, hurt trust, and waste Google's crawl budget on error pages instead of valuable content.",
    recommendedSolution: "Update broken link targets to live URLs or configure 301 redirects from retired slugs to the closest relevant page.",
  },
  {
    id: "cw-http-errors",
    issueName: "Pages Returning HTTP 4xx / 5xx Error Status",
    area: "Crawlability & Indexability",
    priority: "High",
    isQuickWin: false,
    effortLabel: "Engineering (1-2 hours)",
    impactScore: 95,
    matchCheckIds: ["status"],
    matchStatuses: ["fail"],
    buildDescription: (matched) =>
      `${matched.length} audited URL(s) returned non-200 HTTP status codes during the crawl.`,
    seoImpact: "Search engines drop error URLs from the index and lower site-wide crawl confidence if live links lead to server errors.",
    recommendedSolution: "Restore missing pages, fix server errors, or implement permanent 301 redirects to active equivalent pages.",
  },
  {
    id: "cw-robots-txt",
    issueName: "Missing robots.txt File",
    area: "Crawlability & Indexability",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (10 mins)",
    impactScore: 76,
    matchCheckIds: ["robots-txt"],
    matchStatuses: ["warn", "fail"],
    buildDescription: (_matched, all) =>
      `No /robots.txt file was found at the site root across ${all.length} audited page(s).`,
    seoImpact: "Without robots.txt, crawlers have no official crawl guidance or sitemap pointer, risking wasted crawl budget on low-value paths.",
    recommendedSolution: "Publish a clean /robots.txt file allowing public assets and declaring your XML Sitemap location.",
  },
  {
    id: "cw-sitemap-missing",
    issueName: "Missing XML Sitemap",
    area: "Crawlability & Indexability",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (15 mins)",
    impactScore: 78,
    matchCheckIds: ["sitemap"],
    matchStatuses: ["warn", "fail"],
    buildDescription: (_matched, all) =>
      `Neither /sitemap.xml nor /sitemap_index.xml was detected across ${all.length} audited page(s).`,
    seoImpact: "Search engines take longer to discover new or updated pages without an XML sitemap guiding them to priority URLs.",
    recommendedSolution: "Enable or generate an auto-updating XML sitemap covering all indexable pages and submit it in Google Search Console.",
  },
  {
    id: "cw-sitemap-robots",
    issueName: "Sitemap URL Not Referenced Inside robots.txt",
    area: "Crawlability & Indexability",
    priority: "Low",
    isQuickWin: true,
    effortLabel: "Quick Win (5 mins)",
    impactScore: 55,
    matchCheckIds: ["sitemap-in-robots"],
    matchStatuses: ["warn"],
    buildDescription: () => `Your robots.txt file exists, but does not include a "Sitemap:" directive pointing to the XML sitemap.`,
    seoImpact: "Every major search crawler reads robots.txt first; referencing your sitemap there speeds up automatic page discovery.",
    recommendedSolution: "Add a single line at the bottom of robots.txt: Sitemap: https://yourdomain.com/sitemap.xml.",
  },
  {
    id: "cw-redirect-chains",
    issueName: "Multi-Hop Redirect Chains",
    area: "Crawlability & Indexability",
    priority: "Medium",
    isQuickWin: false,
    effortLabel: "Moderate (1-2 hours)",
    impactScore: 72,
    matchCheckIds: ["redirect-chain"],
    matchStatuses: ["warn", "fail"],
    buildDescription: (matched) =>
      `${matched.length} URL(s) pass through 2 or more consecutive redirects before reaching the final destination page.`,
    seoImpact: "Redirect chains slow down page loads for visitors and dilute link authority while forcing bots to make multiple requests.",
    recommendedSolution: "Update redirect rules so old URLs jump directly to the final destination in a single 301 redirect hop.",
  },
  {
    id: "cw-orphan-inbound",
    issueName: "Orphan / Isolated Pages With Zero Contextual Inbound Links",
    area: "Crawlability & Indexability",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (20-30 mins)",
    impactScore: 74,
    matchCheckIds: ["orphan-page-no-inbound"],
    matchStatuses: ["warn", "fail"],
    buildDescription: (matched) =>
      `${matched.length} crawled page(s) received zero contextual in-content internal links from other audited pages on the site.`,
    seoImpact: "Pages without internal links from related content look less important to Google and are harder for users and crawlers to find.",
    recommendedSolution: "Add 2-3 contextual links pointing to each isolated page from relevant service, hub, or blog pages.",
  },
  {
    id: "cw-crawl-depth",
    issueName: "Deep URL Folder Hierarchy (>3 Levels Deep)",
    area: "Crawlability & Indexability",
    priority: "Low",
    isQuickWin: false,
    effortLabel: "Moderate (Planning + 301s)",
    impactScore: 45,
    matchCheckIds: ["crawl-depth"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} URL(s) sit more than 3 folder levels deep in the URL path structure.`,
    seoImpact: "Deeply buried pages tend to receive less internal authority and lower crawl frequency than pages closer to the homepage.",
    recommendedSolution: "Flatten deep subfolders where practical and link directly to high-value deep pages from top navigation or hub pages.",
  },

  // 2. Website Architecture & Internal Linking
  {
    id: "arch-no-internal-links",
    issueName: "Pages Missing Outgoing Internal Navigation Links",
    area: "Website Architecture & Internal Linking",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (15-30 mins)",
    impactScore: 86,
    matchCheckIds: ["orphan-page-no-internal", "internal-links"],
    matchStatuses: ["fail"],
    buildDescription: (matched) =>
      `${matched.length} page(s) contain zero in-body internal links to other pages on your website.`,
    seoImpact: "Visitors and search bots hit a dead end instead of flowing smoothly to your service, pricing, or contact pages.",
    recommendedSolution: "Add relevant contextual links within the body copy guiding users to core landing pages and related articles.",
  },
  {
    id: "arch-internal-nofollow",
    issueName: "Internal Links Marked rel=\"nofollow\" (Crawl Equity Trap)",
    area: "Website Architecture & Internal Linking",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (10-15 mins)",
    impactScore: 84,
    matchCheckIds: ["internal-nofollow-trap"],
    matchStatuses: ["warn", "fail"],
    buildDescription: (matched) =>
      `${matched.length} page(s) include rel="nofollow" on internal links pointing to pages on the same domain.`,
    seoImpact: "Putting nofollow on your own internal links stops Google from passing ranking authority through your site structure.",
    recommendedSolution: "Remove rel=\"nofollow\" from all internal links so authority flows naturally across key pages.",
  },
  {
    id: "arch-redirected-internal",
    issueName: "Internal Links Pointing to Redirecting URLs",
    area: "Website Architecture & Internal Linking",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (20-30 mins)",
    impactScore: 73,
    matchCheckIds: ["redirected-internal-links"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) contain internal links whose href triggers a redirect instead of pointing directly to the final URL.`,
    seoImpact: "Internal redirects add unnecessary latency on every click and weaken link signals.",
    recommendedSolution: "Replace redirecting internal link hrefs with the final canonical destination URLs.",
  },
  {
    id: "arch-url-hygiene",
    issueName: "Non-Standard URL Structure (Uppercase, Underscores, or Query Strings)",
    area: "Website Architecture & Internal Linking",
    priority: "Medium",
    isQuickWin: false,
    effortLabel: "Moderate (Redirects)",
    impactScore: 60,
    matchCheckIds: ["url-structure"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} URL(s) use uppercase letters, underscores, or query parameters instead of clean lowercase hyphenated slugs.`,
    seoImpact: "Messy or case-sensitive URLs can create duplicate URL copies and lower user click-through trust.",
    recommendedSolution: "Standardize new URLs to lowercase hyphens and 301-redirect legacy uppercase/underscore URLs where safe.",
  },
  {
    id: "arch-anchor-text",
    issueName: "Generic Link Anchor Text (e.g., \"Click Here\", \"Read More\")",
    area: "Website Architecture & Internal Linking",
    priority: "Low",
    isQuickWin: true,
    effortLabel: "Quick Win (15 mins)",
    impactScore: 52,
    matchCheckIds: ["anchor-text"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) rely heavily on generic anchor phrases instead of descriptive topic text.`,
    seoImpact: "Search engines rely on anchor text to understand what the linked page is about; descriptive text helps target pages rank better.",
    recommendedSolution: "Rewrite vague button/link text like \"Learn More\" into descriptive phrases naming the destination topic.",
  },
  {
    id: "arch-external-nofollow",
    issueName: "External Outbound Links Without rel=\"nofollow\" / \"sponsored\"",
    area: "Website Architecture & Internal Linking",
    findingType: "Optimization Recommendation",
    priority: "Low",
    isQuickWin: true,
    effortLabel: "Quick Win (15 mins)",
    impactScore: 42,
    matchCheckIds: ["external-nofollow"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) contain outbound links to external sites without rel="nofollow" or rel="sponsored".`,
    seoImpact: "Marking commercial, affiliate, or untrusted external links appropriately keeps outbound linking clean and policy-compliant.",
    recommendedSolution: "Apply rel=\"nofollow\" or rel=\"sponsored\" to partner/commercial external links while leaving editorial citations dofollow.",
  },
  {
    id: "arch-breadcrumbs-rec",
    issueName: "Add Breadcrumb Navigation Across Key Pages",
    area: "Website Architecture & Internal Linking",
    findingType: "Optimization Recommendation",
    priority: "Low",
    isQuickWin: true,
    effortLabel: "Quick Win (30 mins)",
    impactScore: 40,
    customMatch: (page) => page.urlStructure ? !page.urlStructure.hasBreadcrumbs && page.urlStructure.pathDepth >= 1 : false,
    buildDescription: (matched) =>
      `${matched.length} subpage(s) lack visible breadcrumb navigation or BreadcrumbList schema markup.`,
    seoImpact: "Breadcrumbs clarify site hierarchy for visitors and enable clean breadcrumb trails directly inside Google search snippets.",
    recommendedSolution: "Add semantic breadcrumb links near the top of subpages paired with JSON-LD BreadcrumbList markup.",
  },

  // 3. Website Performance & Core Web Vitals
  {
    id: "perf-ttfb",
    issueName: "Slow Server Response Time (High TTFB)",
    area: "Website Performance & Core Web Vitals",
    priority: "High",
    isQuickWin: false,
    effortLabel: "Engineering (2-4 hours)",
    impactScore: 93,
    matchCheckIds: ["response-time", "perf-server-latency"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched, _all, extra) =>
      `${matched.length} page(s) took over 1,000ms for the server to return the first HTML byte${extra ? ` (${extra})` : ""}.`,
    seoImpact: "Slow server responses delay every step of page loading, causing visitors to bounce before the site renders and limiting Google crawl speed.",
    recommendedSolution: "Enable full-page server caching and serve static/HTML edge caches through a CDN such as Cloudflare.",
  },
  {
    id: "perf-render-blocking",
    issueName: "Render-Blocking Scripts Delaying First Paint",
    area: "Website Performance & Core Web Vitals",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (20-40 mins)",
    impactScore: 87,
    matchCheckIds: ["perf-render-blocking"],
    matchStatuses: ["warn", "fail"],
    buildDescription: (matched) =>
      `${matched.length} page(s) load synchronous JavaScript inside <head> without defer or async attributes.`,
    seoImpact: "Render-blocking scripts force browsers to pause painting the visible screen, directly hurting LCP and mobile conversion rates.",
    recommendedSolution: "Add defer or async attributes to non-critical scripts in <head> or move them after main content.",
  },
  {
    id: "perf-cls-dims",
    issueName: "Images Missing Explicit Width & Height (CLS Layout Shift Risk)",
    area: "Website Performance & Core Web Vitals",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (15-30 mins)",
    impactScore: 79,
    matchCheckIds: ["perf-cls", "perf-img-dims", "bp-img-aspect-ratio"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) include images without explicit HTML width and height dimensions.`,
    seoImpact: "Without reserved image dimensions, text and buttons jump around while the page loads, hurting Google's Cumulative Layout Shift (CLS) metric.",
    recommendedSolution: "Add explicit width and height attributes (or CSS aspect-ratio) to all <img> tags so browsers reserve space immediately.",
  },
  {
    id: "perf-compression",
    issueName: "Missing Gzip or Brotli Response Compression",
    area: "Website Performance & Core Web Vitals",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (10-15 mins)",
    impactScore: 75,
    matchCheckIds: ["compression", "perf-compression"],
    matchStatuses: ["warn", "fail"],
    buildDescription: (matched) =>
      `${matched.length} page(s) were served without gzip, brotli, or deflate HTTP compression headers.`,
    seoImpact: "Uncompressed HTML, CSS, and JS files take significantly longer to download on mobile networks.",
    recommendedSolution: "Enable Brotli or Gzip compression on your web server, reverse proxy, or CDN dashboard.",
  },
  {
    id: "perf-cache",
    issueName: "Missing or Weak Browser Caching (Cache-Control)",
    area: "Website Performance & Core Web Vitals",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (15 mins)",
    impactScore: 68,
    matchCheckIds: ["perf-cache"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) lack long-lived or effective Cache-Control caching headers.`,
    seoImpact: "Repeat visitors and multi-page sessions re-download unchanged assets unnecessarily instead of loading them instantly from browser cache.",
    recommendedSolution: "Configure appropriate Cache-Control headers for static assets (max-age >= 86400 or CDN edge caching).",
  },
  {
    id: "perf-js-css-bloat",
    issueName: "Excessive or Unbundled JavaScript & CSS Assets",
    area: "Website Performance & Core Web Vitals",
    priority: "Medium",
    isQuickWin: false,
    effortLabel: "Engineering (Half Day)",
    impactScore: 66,
    matchCheckIds: ["perf-js-count", "perf-unused-js", "perf-css-count", "perf-unused-css", "perf-resources", "perf-payload"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) load high counts of scripts/stylesheets or oversized payloads.`,
    seoImpact: "Heavy scripts increase main-thread CPU work (hurting Interaction to Next Paint / INP) and slow initial mobile loads.",
    recommendedSolution: "Remove unused third-party tracking/widget scripts, bundle styles cleanly, and lazy-load non-critical components.",
  },
  {
    id: "perf-dom-size",
    issueName: "Oversized HTML DOM Tree (>1,500 Nodes)",
    area: "Website Performance & Core Web Vitals",
    priority: "Medium",
    isQuickWin: false,
    effortLabel: "Engineering (Template Refactor)",
    impactScore: 62,
    matchCheckIds: ["perf-dom-size"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) exceed Google's recommended 1,500 HTML DOM element threshold.`,
    seoImpact: "An overly complex DOM increases memory usage and slows down click interactions (INP) on mid-range mobile phones.",
    recommendedSolution: "Simplify nested page-builder wrappers and paginate or lazy-render offscreen lists.",
  },
  {
    id: "perf-font-display",
    issueName: "Web Fonts Missing font-display: swap",
    area: "Website Performance & Core Web Vitals",
    priority: "Low",
    isQuickWin: true,
    effortLabel: "Quick Win (10 mins)",
    impactScore: 50,
    matchCheckIds: ["perf-font-display"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) define @font-face rules without font-display: swap.`,
    seoImpact: "Visitors can see invisible text while custom fonts download, hurting perceived speed.",
    recommendedSolution: "Add font-display: swap inside @font-face CSS rules so system text shows immediately.",
  },

  // 4. On-Page Technical SEO
  {
    id: "onpage-title-missing",
    issueName: "Missing HTML <title> Tags",
    area: "On-Page Technical SEO",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (10 mins)",
    impactScore: 96,
    customMatch: (page) => !page.title || !page.title.trim(),
    buildDescription: (matched) =>
      `${matched.length} audited page(s) have no HTML <title> tag at all.`,
    seoImpact: "The <title> tag is Google's primary topical ranking signal and the main clickable headline in search results.",
    recommendedSolution: "Write a unique 50-60 character <title> tag containing the target keyword and brand name for every missing page.",
  },
  {
    id: "onpage-title-dup",
    issueName: "Duplicate Title Tags Across Multiple Pages",
    area: "On-Page Technical SEO",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (15-30 mins)",
    impactScore: 90,
    matchCheckIds: ["duplicate-title"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) share identical or duplicated <title> tags with other URLs on the site.`,
    seoImpact: "Identical titles cause your own pages to compete against one another in Google (keyword cannibalization) and lower click-through rates.",
    recommendedSolution: "Customize each page's title tag so every indexed URL targets a distinct topic, service, or location.",
  },
  {
    id: "onpage-title-len",
    issueName: "Title Tags Too Short (<30 Chars) or Too Long (>60 Chars)",
    area: "On-Page Technical SEO",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (15 mins)",
    impactScore: 77,
    customMatch: (page) => Boolean(page.title?.trim() && (page.title.trim().length < 30 || page.title.trim().length > 60)),
    buildDescription: (matched) =>
      `${matched.length} page(s) have titles shorter than 30 characters or longer than 60 characters.`,
    seoImpact: "Overly long titles get cut off with '...' in Google results, while overly short titles miss valuable keyword relevance.",
    recommendedSolution: "Refine title tags to 45-60 characters with the primary keyword placed near the front.",
  },
  {
    id: "onpage-desc-missing",
    issueName: "Missing Meta Descriptions",
    area: "On-Page Technical SEO",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (15-30 mins)",
    impactScore: 89,
    customMatch: (page) => !page.description || !page.description.trim(),
    buildDescription: (matched) =>
      `${matched.length} audited page(s) have no meta description tag.`,
    seoImpact: "Without a custom meta description, Google pulls random text fragments from the page, often lowering search snippet click-through rates.",
    recommendedSolution: "Add unique 130-160 character meta descriptions highlighting the core benefit and a clear call to action.",
  },
  {
    id: "onpage-desc-dup",
    issueName: "Duplicate Meta Descriptions Across Pages",
    area: "On-Page Technical SEO",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (20-30 mins)",
    impactScore: 76,
    matchCheckIds: ["duplicate-meta-description"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) reuse duplicate meta description text found on other pages.`,
    seoImpact: "Duplicate descriptions make different pages look identical in search results, reducing qualified organic clicks.",
    recommendedSolution: "Write tailored meta descriptions unique to each page's specific intent.",
  },
  {
    id: "onpage-h1-missing-multi",
    issueName: "Missing or Multiple H1 Headings",
    area: "On-Page Technical SEO",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (10-20 mins)",
    impactScore: 85,
    matchCheckIds: ["h1"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) either lack an H1 heading or include multiple competing H1 tags.`,
    seoImpact: "Search engines and screen readers rely on a single clear H1 headline to understand the primary subject of a page.",
    recommendedSolution: "Keep exactly one clear H1 headline at the top of each page and convert secondary headings to H2/H3.",
  },
  {
    id: "onpage-h1-dup",
    issueName: "Duplicate H1 Headings Across Pages",
    area: "On-Page Technical SEO",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (15-25 mins)",
    impactScore: 74,
    matchCheckIds: ["duplicate-h1"],
    matchStatuses: ["warn", "fail"],
    buildDescription: (matched) =>
      `${matched.length} page(s) share the exact same H1 heading across multiple URLs.`,
    seoImpact: "Identical H1 headings blur topical boundaries between pages and weaken page-level keyword focus.",
    recommendedSolution: "Give every page a distinct H1 aligned with its unique target topic.",
  },
  {
    id: "onpage-heading-order",
    issueName: "Disorganized Heading Hierarchy (Skipped Heading Levels)",
    area: "On-Page Technical SEO",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (15 mins)",
    impactScore: 63,
    matchCheckIds: ["a11y-heading-structure", "headings"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) skip heading levels (e.g., jumping from H2 to H4) or lack H2 subheadings.`,
    seoImpact: "A clean H1 -> H2 -> H3 structure helps search engines parse subtopics and supports Featured Snippet eligibility.",
    recommendedSolution: "Restructure visual headings so HTML tags follow sequential H1 -> H2 -> H3 nesting without skipping levels.",
  },
  {
    id: "onpage-img-alt",
    issueName: "Images Missing Descriptive Alt Attributes",
    area: "On-Page Technical SEO",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (15-30 mins)",
    impactScore: 70,
    matchCheckIds: ["img-alt", "a11y-img-alt"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) have images missing descriptive alt text.`,
    seoImpact: "Missing alt tags prevent Google Images from indexing visual media and make pages harder to use for screen-reader visitors.",
    recommendedSolution: "Add concise, descriptive alt attributes to meaningful images across templates and CMS media libraries.",
  },
  {
    id: "onpage-thin-content",
    issueName: "Low Word Count / Thin Page Content",
    area: "On-Page Technical SEO",
    priority: "Medium",
    isQuickWin: false,
    effortLabel: "Moderate (Copywriting)",
    impactScore: 64,
    matchCheckIds: ["content-length"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) have fewer than 300 words of indexable body copy.`,
    seoImpact: "Thin pages struggle to demonstrate expertise or answer customer questions thoroughly enough to outrank competitors.",
    recommendedSolution: "Expand core service/landing pages with clear answers, benefits, and FAQs (aim for 300+ helpful words where appropriate).",
  },
  {
    id: "onpage-open-graph",
    issueName: "Incomplete Open Graph / Social Preview Metadata",
    area: "On-Page Technical SEO",
    findingType: "Optimization Recommendation",
    priority: "Low",
    isQuickWin: true,
    effortLabel: "Quick Win (10 mins)",
    impactScore: 44,
    matchCheckIds: ["open-graph", "twitter-cards"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) are missing complete Open Graph (og:title, og:description, og:image) or Twitter Card tags.`,
    seoImpact: "Complete social tags ensure shared links display attractive branded previews on LinkedIn, X, WhatsApp, and Slack.",
    recommendedSolution: "Populate og:title, og:description, og:image, and og:url in your CMS SEO template.",
  },

  // 5. Structured Data & Schema
  {
    id: "schema-missing",
    issueName: "Missing Schema.org JSON-LD Structured Data",
    area: "Structured Data & Schema",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (20-30 mins)",
    impactScore: 88,
    customMatch: (page) => (page.schema || []).length === 0,
    buildDescription: (matched) =>
      `${matched.length} audited page(s) contain zero Schema.org JSON-LD or Microdata structured entities.`,
    seoImpact: "Search engines and AI answer engines lack verified machine-readable details about your brand, services, reviews, and breadcrumbs—limiting rich snippets.",
    recommendedSolution: "Inject valid JSON-LD Schema (Organization / LocalBusiness, Service or Product, BreadcrumbList, and Article/FAQ where applicable).",
  },
  {
    id: "schema-invalid",
    issueName: "Invalid or Incomplete Schema.org Markup",
    area: "Structured Data & Schema",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (15-25 mins)",
    impactScore: 85,
    matchCheckIds: ["schema-validation"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched, _all, extra) =>
      `${matched.length} page(s) contain structured data with missing required properties or syntax warnings${extra ? ` (${extra})` : ""}.`,
    seoImpact: "Broken or incomplete schema is ignored by Google Rich Results, costing you enhanced search appearance.",
    recommendedSolution: "Fix the flagged JSON-LD fields and verify with Google's Rich Results Test.",
  },

  // 6. Mobile SEO
  {
    id: "mobile-viewport",
    issueName: "Missing Mobile Viewport Meta Tag",
    area: "Mobile SEO",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (5 mins)",
    impactScore: 93,
    matchCheckIds: ["viewport", "perf-viewport"],
    matchStatuses: ["fail"],
    buildDescription: (matched) =>
      `${matched.length} page(s) are missing <meta name="viewport" content="width=device-width, initial-scale=1">.`,
    seoImpact: "Google uses mobile-first indexing; without a viewport tag, mobile devices zoom out desktop layouts and fail mobile usability.",
    recommendedSolution: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> inside your global <head> layout.",
  },
  {
    id: "mobile-touch-targets",
    issueName: "Undersized Mobile Touch Targets (<24px)",
    area: "Mobile SEO",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (20 mins)",
    impactScore: 67,
    matchCheckIds: ["a11y-touch-target"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) contain interactive buttons or links explicitly sized under 24px.`,
    seoImpact: "Tiny tap targets frustrate mobile visitors and increase mis-taps on navigation menus and CTAs.",
    recommendedSolution: "Increase button/link padding so interactive targets are at least 44x44 CSS pixels on touch screens.",
  },

  // 7. Website Security
  {
    id: "sec-https",
    issueName: "Unencrypted HTTP Access / Missing Automatic HTTPS Redirect",
    area: "Website Security",
    priority: "High",
    isQuickWin: false,
    effortLabel: "Engineering (30-60 mins)",
    impactScore: 95,
    matchCheckIds: ["https", "bp-https-redirect"],
    matchStatuses: ["fail"],
    buildDescription: (matched) =>
      `${matched.length} page(s) are served over HTTP or fail to automatically redirect HTTP visitors to HTTPS.`,
    seoImpact: "Browsers mark HTTP sites as 'Not Secure', driving away customers, while Google uses HTTPS encryption as a direct ranking signal.",
    recommendedSolution: "Install/renew an SSL certificate and enforce a server-wide permanent 301 redirect from HTTP to HTTPS.",
  },
  {
    id: "sec-www-consistency",
    issueName: "WWW vs Non-WWW Host Inconsistency",
    area: "Website Security",
    priority: "High",
    isQuickWin: false,
    effortLabel: "Engineering (30 mins)",
    impactScore: 86,
    matchCheckIds: ["www-consistency"],
    matchStatuses: ["warn", "fail"],
    buildDescription: (_matched, _all, extra) =>
      extra || "Both www and non-www versions of the domain respond independently without redirecting to a single canonical host.",
    seoImpact: "Serving your entire website on both www and non-www creates site-wide duplicate content and splits backlink authority in half.",
    recommendedSolution: "Choose one preferred canonical host (e.g., https://yourdomain.com or https://www.yourdomain.com) and 301-redirect the alternate host.",
  },
  {
    id: "sec-mixed-content",
    issueName: "Mixed Content (Insecure http:// Assets on HTTPS Pages)",
    area: "Website Security",
    priority: "High",
    isQuickWin: true,
    effortLabel: "Quick Win (15-30 mins)",
    impactScore: 84,
    matchCheckIds: ["bp-mixed-content"],
    matchStatuses: ["fail"],
    buildDescription: (matched) =>
      `${matched.length} HTTPS page(s) reference images, scripts, or stylesheets over insecure http:// URLs.`,
    seoImpact: "Modern browsers block insecure scripts/styles or break images and display security warnings on your HTTPS site.",
    recommendedSolution: "Update hardcoded http:// asset references in templates and database content to https:// (or relative paths).",
  },
  {
    id: "sec-headers",
    issueName: "Missing HTTP Security Headers (HSTS / CSP / X-Frame-Options)",
    area: "Website Security",
    priority: "Low",
    isQuickWin: true,
    effortLabel: "Quick Win (15-20 mins)",
    impactScore: 48,
    matchCheckIds: ["bp-hsts", "bp-csp", "bp-clickjacking", "security-headers"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) are missing protective response headers such as Strict-Transport-Security (HSTS) or Content-Security-Policy.`,
    seoImpact: "Adding modern security headers protects visitors from clickjacking and downgrade attacks and strengthens technical trust.",
    recommendedSolution: "Add HSTS, X-Content-Type-Options: nosniff, and X-Frame-Options/CSP headers via your web server or CDN rules.",
  },

  // 8. International & Local SEO
  {
    id: "intl-html-lang",
    issueName: "Missing Language Attribute (<html lang=\"...\">)",
    area: "International & Local SEO",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (5 mins)",
    impactScore: 65,
    matchCheckIds: ["html-lang", "a11y-html-lang"],
    matchStatuses: ["fail", "warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) omit the lang attribute on the root <html> element.`,
    seoImpact: "Search engines and accessibility screen readers use the HTML lang tag to identify the page's primary language and regional audience.",
    recommendedSolution: "Set <html lang=\"en\"> (or your target language/region ISO code) in your base HTML template.",
  },
  {
    id: "intl-hreflang-invalid",
    issueName: "Invalid or Incomplete Hreflang Tags",
    area: "International & Local SEO",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (20 mins)",
    impactScore: 66,
    matchCheckIds: ["hreflang"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) declare hreflang alternate links with missing hreflang codes or href URLs.`,
    seoImpact: "Broken hreflang tags prevent Google from serving the right country or language version to international searchers.",
    recommendedSolution: "Fix malformed rel=\"alternate\" hreflang attributes and verify reciprocal return links between language variants.",
  },
  {
    id: "local-schema-opportunity",
    issueName: "Add LocalBusiness Schema & Verified Local NAP Signals",
    area: "International & Local SEO",
    findingType: "Optimization Recommendation",
    priority: "Low",
    isQuickWin: true,
    effortLabel: "Quick Win (20 mins)",
    impactScore: 46,
    customMatch: (page) => {
      const hasLocalSchema = (page.schema || []).some((s) => /localbusiness|dentist|medicalclinic|store|restaurant|legalservice|realestate/i.test(s.type));
      const hasLocationUrl = /\/(locations?|cities|areas?|contact|about)/i.test(page.url || "");
      return !hasLocalSchema && hasLocationUrl;
    },
    buildDescription: (matched) =>
      `${matched.length} location/contact page(s) do not declare LocalBusiness JSON-LD schema.`,
    seoImpact: "If you serve specific cities or physical locations, LocalBusiness schema reinforces Google Maps 3-Pack and local search visibility.",
    recommendedSolution: "Add LocalBusiness JSON-LD markup containing consistent Name, Address, Phone (NAP), opening hours, and geo coordinates.",
  },

  // 9. Additional Technical Issues
  {
    id: "add-form-labels",
    issueName: "Form Fields Missing Accessible Labels",
    area: "Additional Technical Issues",
    priority: "Medium",
    isQuickWin: true,
    effortLabel: "Quick Win (15 mins)",
    impactScore: 61,
    matchCheckIds: ["a11y-form-labels"],
    matchStatuses: ["fail"],
    buildDescription: (matched) =>
      `${matched.length} page(s) contain lead/contact form inputs without associated <label> or aria-label attributes.`,
    seoImpact: "Unlabeled inputs hurt accessibility compliance and reduce form completion rates for keyboard and assistive-tech users.",
    recommendedSolution: "Associate every input, select, and textarea with a matching <label for=\"...\"> or aria-label attribute.",
  },
  {
    id: "add-duplicate-ids",
    issueName: "Duplicate HTML Element IDs",
    area: "Additional Technical Issues",
    priority: "Low",
    isQuickWin: true,
    effortLabel: "Quick Win (15 mins)",
    impactScore: 45,
    matchCheckIds: ["a11y-aria-ids"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) reuse duplicate HTML id attributes on the same page.`,
    seoImpact: "Duplicate IDs can break jump-to anchor links, JavaScript form toggles, and ARIA accessibility associations.",
    recommendedSolution: "Ensure every HTML id attribute is unique within each rendered page.",
  },
  {
    id: "add-third-party-cookies",
    issueName: "Third-Party Cookies With SameSite=None",
    area: "Additional Technical Issues",
    findingType: "Optimization Recommendation",
    priority: "Low",
    isQuickWin: false,
    effortLabel: "Engineering (1 hour)",
    impactScore: 35,
    matchCheckIds: ["bp-third-party-cookies"],
    matchStatuses: ["warn"],
    buildDescription: (matched) =>
      `${matched.length} page(s) set cookies flagged SameSite=None.`,
    seoImpact: "Modern browsers restrict third-party cookies by default, which can interfere with embedded analytics or widgets.",
    recommendedSolution: "Switch non-cross-site cookies to SameSite=Lax and audit third-party embeds.",
  },
];

function pageMatchesRule(page: Partial<AuditResult>, allPages: Partial<AuditResult>[], rule: IssueRuleDefinition): { matched: boolean; extraDetail: string } {
  if (rule.customMatch) {
    return { matched: rule.customMatch(page, allPages), extraDetail: "" };
  }
  const checks: CheckResult[] = page.checks || [];
  const allowedStatuses = rule.matchStatuses || ["fail", "warn"];
  const hit = checks.find(
    (c) => rule.matchCheckIds?.includes(c.id) && allowedStatuses.includes(c.status as "fail" | "warn" | "info")
  );
  if (!hit) return { matched: false, extraDetail: "" };
  return { matched: true, extraDetail: hit.detail || "" };
}

/**
 * Builds an evidence-based, client-ready 7-section Technical SEO Audit report
 * covering all 9 technical areas with Quick Wins prioritized first.
 */
export function buildClientSeoAuditReport(options: BuildReportOptions): ClientSeoAuditReport {
  const {
    websiteUrl,
    businessName,
    primaryResult,
    batchResults = [],
    duplicatesSummary,
    psiMetrics,
  } = options;

  const pages: Partial<AuditResult>[] = batchResults.length > 0 ? batchResults : [primaryResult];
  const pagesAudited = pages.length;

  let domain = websiteUrl;
  try {
    domain = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`).hostname.replace(/^www\./, "");
  } catch {
    // retain raw websiteUrl
  }
  const effectiveName = (businessName || domain).trim();

  const detailedFindings: ClientAuditIssue[] = [];

  for (const rule of ISSUE_RULES) {
    const matchedPages: Partial<AuditResult>[] = [];
    let firstExtra = "";

    for (const page of pages) {
      const { matched, extraDetail } = pageMatchesRule(page, pages, rule);
      if (matched) {
        matchedPages.push(page);
        if (!firstExtra && extraDetail) firstExtra = extraDetail;
      }
    }

    if (matchedPages.length === 0) continue;

    // For batch duplicate rules, also include any cross-page duplicate URLs from duplicatesSummary if available
    let exampleUrls = matchedPages.map((p) => getPageUrl(p, websiteUrl));
    let affectedCount = matchedPages.length;

    if (rule.id === "onpage-title-dup" && duplicatesSummary?.duplicateTitles?.length) {
      const dupUrls = duplicatesSummary.duplicateTitles.flatMap((g) => g.urls);
      if (dupUrls.length > 0) {
        exampleUrls = [...dupUrls, ...exampleUrls];
        affectedCount = Math.max(affectedCount, new Set(dupUrls).size);
      }
    } else if (rule.id === "onpage-desc-dup" && duplicatesSummary?.duplicateDescriptions?.length) {
      const dupUrls = duplicatesSummary.duplicateDescriptions.flatMap((g) => g.urls);
      if (dupUrls.length > 0) {
        exampleUrls = [...dupUrls, ...exampleUrls];
        affectedCount = Math.max(affectedCount, new Set(dupUrls).size);
      }
    } else if (rule.id === "onpage-h1-dup" && duplicatesSummary?.duplicateH1s?.length) {
      const dupUrls = duplicatesSummary.duplicateH1s.flatMap((g) => g.urls);
      if (dupUrls.length > 0) {
        exampleUrls = [...dupUrls, ...exampleUrls];
        affectedCount = Math.max(affectedCount, new Set(dupUrls).size);
      }
    } else if (rule.id === "cw-orphan-inbound" && duplicatesSummary?.orphanInboundUrls?.length) {
      exampleUrls = [...duplicatesSummary.orphanInboundUrls, ...exampleUrls];
      affectedCount = Math.max(affectedCount, duplicatesSummary.orphanInboundUrls.length);
    }

    detailedFindings.push({
      id: rule.id,
      issueName: rule.issueName,
      area: rule.area,
      findingType: rule.findingType || "Confirmed Issue",
      description: rule.buildDescription(matchedPages, pages, firstExtra),
      affectedUrlsCount: affectedCount,
      exampleAffectedUrls: uniqueUrls(exampleUrls, 5),
      seoImpact: rule.seoImpact,
      recommendedSolution: rule.recommendedSolution,
      priority: rule.priority,
      isQuickWin: rule.isQuickWin,
      effortLabel: rule.effortLabel,
      impactScore: rule.impactScore,
    });
  }

  // Inject measured Lighthouse Core Web Vitals findings only when directly observed (never invented)
  if (typeof psiMetrics?.lcpSec === "number" && psiMetrics.lcpSec > 2.5) {
    detailedFindings.push({
      id: "perf-psi-lcp",
      issueName: "Slow Largest Contentful Paint (LCP > 2.5s)",
      area: "Website Performance & Core Web Vitals",
      findingType: "Confirmed Issue",
      description: `Automated mobile Lighthouse test measured LCP at ${psiMetrics.lcpSec}s (Google target: <= 2.5s).`,
      affectedUrlsCount: 1,
      exampleAffectedUrls: uniqueUrls([getPageUrl(primaryResult, websiteUrl)], 5),
      seoImpact: "When the main visual headline or hero image loads slowly, visitors abandon the page before engaging, reducing conversions and mobile Core Web Vitals scores.",
      recommendedSolution: "Preload the hero image, serve modern WebP/AVIF media, remove render-blocking <head> scripts, and optimize server TTFB.",
      priority: "High",
      isQuickWin: false,
      effortLabel: "Engineering (2-4 hours)",
      impactScore: 98,
    });
  }

  if (typeof psiMetrics?.inpMs === "number" && psiMetrics.inpMs > 200) {
    detailedFindings.push({
      id: "perf-psi-inp",
      issueName: "Slow Interaction to Next Paint (INP > 200ms)",
      area: "Website Performance & Core Web Vitals",
      findingType: "Confirmed Issue",
      description: `Lighthouse mobile interaction test measured responsiveness latency at ${psiMetrics.inpMs}ms (Google target: <= 200ms).`,
      affectedUrlsCount: 1,
      exampleAffectedUrls: uniqueUrls([getPageUrl(primaryResult, websiteUrl)], 5),
      seoImpact: "Delays after taps or button clicks make menus and forms feel sluggish and hurt Google's Core Web Vitals INP score.",
      recommendedSolution: "Break up long JavaScript tasks, defer third-party widgets, and reduce DOM complexity.",
      priority: "High",
      isQuickWin: false,
      effortLabel: "Engineering (Half Day)",
      impactScore: 94,
    });
  }

  if (typeof psiMetrics?.performanceScore === "number" && psiMetrics.performanceScore < 60) {
    detailedFindings.push({
      id: "mobile-psi-score",
      issueName: `Low Mobile Lighthouse Performance Score (${psiMetrics.performanceScore}/100)`,
      area: "Mobile SEO",
      findingType: "Confirmed Issue",
      description: `Google PageSpeed Insights mobile audit scored ${psiMetrics.performanceScore}/100 on the tested landing page.`,
      affectedUrlsCount: 1,
      exampleAffectedUrls: uniqueUrls([getPageUrl(primaryResult, websiteUrl)], 5),
      seoImpact: "Because Google indexes websites mobile-first, sluggish mobile speed lowers rankings and ad quality scores.",
      recommendedSolution: "Combine Quick Win script deferral and image sizing with server edge caching and unused JS pruning.",
      priority: "High",
      isQuickWin: false,
      effortLabel: "Engineering (1 Sprint)",
      impactScore: 91,
    });
  }

  detailedFindings.sort(sortIssuesQuickWinsFirst);

  const confirmedIssues = detailedFindings.filter((f) => f.findingType === "Confirmed Issue");
  const recommendations = detailedFindings.filter((f) => f.findingType === "Optimization Recommendation");
  const quickWins = detailedFindings.filter((f) => f.isQuickWin);

  const primaryTtfb = primaryResult.pageSpeed?.responseTimeMs || 0;
  const estLcpSec = primaryTtfb > 0 ? Number(((primaryTtfb / 1000) * 2.2 + 0.8).toFixed(1)) : undefined;
  const clsRiskCount = pages.reduce((acc, p) => {
    const hasClsWarn = p.checks?.some((c) => c.id === "perf-cls" && (c.status === "fail" || c.status === "warn"));
    return acc + (hasClsWarn ? 1 : 0);
  }, 0);

  const avgScoreRaw =
    batchResults.length > 0
      ? Math.round(
          batchResults.reduce((sum, p) => sum + (typeof p.score === "number" ? p.score : 70), 0) / batchResults.length
        )
      : primaryResult.score ?? 70;
  const overallScore = Math.max(15, Math.min(100, avgScoreRaw));
  const grade =
    overallScore >= 95 ? "A+" : overallScore >= 88 ? "A" : overallScore >= 75 ? "B" : overallScore >= 60 ? "C" : overallScore >= 45 ? "D" : "F";

  const areaBreakdown: AreaHealthSummary[] = AUDIT_AREAS_ORDER.map((area) => {
    const areaItems = detailedFindings.filter((f) => f.area === area);
    const areaConfirmed = areaItems.filter((f) => f.findingType === "Confirmed Issue");
    const areaRecs = areaItems.filter((f) => f.findingType === "Optimization Recommendation");
    const areaQuickWins = areaItems.filter((f) => f.isQuickWin);
    const hasHigh = areaConfirmed.some((f) => f.priority === "High");
    const status: AreaHealthSummary["status"] =
      hasHigh ? "Critical" : areaConfirmed.length > 0 ? "Needs Attention" : areaRecs.length > 0 ? "Info" : "Healthy";

    const summary =
      areaConfirmed.length > 0
        ? `${areaConfirmed.length} confirmed issue(s) identified (${areaQuickWins.length} Quick Win${areaQuickWins.length === 1 ? "" : "s"}).`
        : areaRecs.length > 0
          ? `No critical blockers; ${areaRecs.length} optional enhancement(s) noted.`
          : `All audited checks in ${area} passed without issues.`;

    return {
      area,
      status,
      confirmedIssuesCount: areaConfirmed.length,
      recommendationsCount: areaRecs.length,
      quickWinsCount: areaQuickWins.length,
      summary,
    };
  });

  const criticalIssues = confirmedIssues.filter((f) => f.priority === "High");
  const quickWinsFirst = quickWins;
  const mediumTermFixes = detailedFindings.filter((f) => !f.isQuickWin && (f.priority === "High" || f.priority === "Medium"));
  const longerTermEngineering = detailedFindings.filter((f) => !f.isQuickWin && f.priority === "Low");

  const topQuickNames = quickWinsFirst.slice(0, 3).map((q) => q.issueName).join("; ");
  const executiveSummary =
    confirmedIssues.length === 0
      ? `This Technical SEO Audit evaluated ${pagesAudited} page${pagesAudited > 1 ? "s" : ""} on ${effectiveName} (${websiteUrl}) and recorded an overall Technical Health Score of ${overallScore}/100 (Grade ${grade}). No critical technical blockers were detected across the 9 core audit pillars; minor optional enhancements are outlined below.`
      : `This Technical SEO Audit evaluated ${pagesAudited} page${pagesAudited > 1 ? "s" : ""} on ${effectiveName} (${websiteUrl}) and recorded a Technical Health Score of ${overallScore}/100 (Grade ${grade}). We identified ${confirmedIssues.length} confirmed technical issue(s) (${criticalIssues.length} High Priority) and ${quickWinsFirst.length} high-ROI Quick Win(s) that can be fixed rapidly without a site rebuild${topQuickNames ? `, led by: ${topQuickNames}` : ""}. Prioritizing Quick Wins first delivers immediate gains in crawl efficiency, search snippet click-through rate, and user trust.`;

  const finalRecommendations: string[] = [
    quickWinsFirst.length > 0
      ? `Execute Phase 1 Quick Wins first (${quickWinsFirst.length} fast fix${quickWinsFirst.length === 1 ? "" : "es"}): start with ${quickWinsFirst.slice(0, 2).map((q) => q.issueName).join(" and ")} for immediate ranking and CTR lift.`
      : "Maintain clean on-page metadata, canonicals, and schema standards whenever publishing new pages.",
    mediumTermFixes.length > 0
      ? `Schedule Phase 2 Engineering upgrades (${mediumTermFixes.length} structural task${mediumTermFixes.length === 1 ? "" : "s"}) focusing on server speed caching, HTTPS/host redirects, and script optimization.`
      : "Monitor Core Web Vitals (LCP, INP, CLS) in Google Search Console monthly to protect speed benchmarks.",
    "Re-crawl all updated URLs after deployment and validate XML sitemap & Rich Results status inside Google Search Console.",
  ];

  return {
    generatedAt: new Date().toISOString(),
    domain,
    websiteUrl,
    businessName: effectiveName,
    pagesAudited,
    overallScore,
    grade,
    coreWebVitals: {
      ttfbMs: primaryTtfb,
      lcpSec: typeof psiMetrics?.lcpSec === "number" ? psiMetrics.lcpSec : estLcpSec,
      lcpSource: typeof psiMetrics?.lcpSec === "number" ? "measured" : "estimated",
      inpMs: psiMetrics?.inpMs,
      inpSource: typeof psiMetrics?.inpMs === "number" ? "measured" : "unavailable",
      clsScore: psiMetrics?.clsScore,
      clsRiskCount,
      clsSource: typeof psiMetrics?.clsScore === "number" ? "measured" : "estimated",
      performanceScore: psiMetrics?.performanceScore,
      htmlSizeKb: Math.round((primaryResult.pageSpeed?.htmlSizeBytes || 0) / 1024),
    },
    executiveSummary,
    healthOverview: {
      summary: `Evaluated ${pagesAudited} live URL(s) across all 9 Technical SEO Pillars. Confirmed Issues: ${confirmedIssues.length} | Quick Wins Ready Now: ${quickWinsFirst.length} | Optimization Recommendations: ${recommendations.length}.`,
      areaBreakdown,
      confirmedIssuesTotal: confirmedIssues.length,
      recommendationsTotal: recommendations.length,
      quickWinsTotal: quickWinsFirst.length,
    },
    detailedFindings,
    criticalIssues,
    actionPlan: {
      quickWinsFirst,
      mediumTermFixes,
      longerTermEngineering,
    },
    roadmap: {
      phase1QuickWins: {
        title: "Phase 1: Immediate Quick Wins (Highest ROI First)",
        timeline: "Week 1 (Fast CMS / Template Fixes)",
        items: quickWinsFirst,
      },
      phase2HighMedium: {
        title: "Phase 2: Core Engineering & Architecture Fixes",
        timeline: "Weeks 2-3 (Server, Caching & Redirects)",
        items: mediumTermFixes,
      },
      phase3LongTerm: {
        title: "Phase 3: Long-Term Optimization & Monitoring",
        timeline: "Ongoing / Month 2+",
        items: longerTermEngineering.length > 0 ? longerTermEngineering : recommendations,
      },
    },
    finalRecommendations,
  };
}
