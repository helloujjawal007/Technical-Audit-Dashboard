import { createClient } from "@supabase/supabase-js";
import { parseHTML } from "linkedom";


interface CheckResult {
  id: string;
  label: string;
  category: "on-page" | "off-page" | "technical" | "accessibility" | "best-practices" | "performance";
  status: "pass" | "fail" | "warn" | "info";
  detail: string;
  value?: string;
}

interface KeywordInfo {
  keyword: string;
  density: number;
  count: number;
  type: "primary" | "secondary" | "supporting";
}

interface SchemaInfo {
  type: string;
  source: "json-ld" | "microdata";
  raw: string;
}

interface PageSpeedInfo {
  responseTimeMs: number;
  htmlSizeBytes: number;
  estimatedTransferTimeSec: number;
  resources: number;
  scripts: number;
  stylesheets: number;
  images: number;
  mobileOptimized: boolean;
  hasViewport: boolean;
  recommendations: string[];
}

interface LinkAnalysis {
  internal: { href: string; text: string; rel: string }[];
  external: { href: string; text: string; rel: string }[];
  dofollow: { href: string; text: string }[];
  nofollow: { href: string; text: string }[];
  total: number;
}

interface NoindexInfo {
  indexable: boolean;
  source: "meta-robots" | "x-robots-tag" | "none" | null;
  directive: string | null;
  detail: string;
}

interface GoogleProperty {
  property: string;
  id: string | null;
  detail: string;
}

interface InternalLinkStatus {
  href: string;
  text: string;
  status: number | null;
  redirect: string | null;
  error: string | null;
}

interface SchemaValidation {
  type: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ContentRecommendation {
  element: "title" | "meta-description" | "h1";
  issue: string;
  currentContent: string;
  updatedContent: string;
  status: "pass" | "warn" | "fail";
}

interface KeywordMetric {
  keyword: string;
  searchVolume: string | null;
  competition: string | null;
  competitionIndex: string | null;
  lowTopOfPageBid: string | null;
  highTopOfPageBid: string | null;
  source: string;
}

interface CategoryScore {
  category: string;
  score: number;
  pass: number;
  warn: number;
  fail: number;
  info: number;
}

interface AuditResult {
  score: number;
  title: string | null;
  description: string | null;
  checks: CheckResult[];
  categoryScores: CategoryScore[];
  robotsContent: string | null;
  sitemapContent: string | null;
  sitemapUrl: string | null;
  headers: Record<string, string>;
  socialPreview: {
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    twitterCard: string | null;
    twitterTitle: string | null;
    twitterDescription: string | null;
    twitterImage: string | null;
  };
  links: { href: string; rel: string; text: string }[];
  headings: { level: number; text: string }[];
  images: { src: string; alt: string; width: string; height: string }[];
  keywords: KeywordInfo[];
  schema: SchemaInfo[];
  pageSpeed: PageSpeedInfo;
  linkAnalysis: LinkAnalysis;
  hasTOC: boolean;
  hasFAQ: boolean;
  hasInfographic: boolean;
  recommendations: { priority: "high" | "medium" | "low"; title: string; detail: string }[];
  noindex: NoindexInfo;
  googleProperties: GoogleProperty[];
  internalLinkStatuses: InternalLinkStatus[];
  schemaValidation: SchemaValidation[];
  contentRecommendations: ContentRecommendation[];
  keywordMetrics: KeywordMetric[];
  customAudit?: CustomAuditData;
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url) throw new Error("URL is required");
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return new URL(url).href;
}

function getMeta(doc: Document, selector: string, attr = "content"): string | null {
  const el = doc.querySelector(selector);
  if (!el) return null;
  return el.getAttribute(attr) || el.textContent?.trim() || null;
}

function stripHtml(html: string): { doc: Document; text: string } {
  const { document: doc } = parseHTML(html);
  doc.querySelectorAll("script, style, noscript, template").forEach((n) => n.remove());
  const text = doc.body?.textContent?.replace(/\s+/g, " ").trim() || "";
  return { doc: doc as unknown as Document, text };
}

function wordCount(text: string): number {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","must","can","this","that","these","those","i","you","he","she","it","we","they","what","which","who","when","where","why","how","all","each","every","both","few","more","most","other","some","such","no","nor","not","only","own","same","so","than","too","very","just","also","as","if","then","there","here","your","our","their","its","my","me","him","her","them","us",
]);

function extractKeywords(text: string): KeywordInfo[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (w.length < 3 || STOP_WORDS.has(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  const bigrams: Record<string, number> = {};
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length < 3 || words[i + 1].length < 3 || STOP_WORDS.has(words[i]) || STOP_WORDS.has(words[i + 1])) continue;
    const bg = words[i] + " " + words[i + 1];
    bigrams[bg] = (bigrams[bg] || 0) + 1;
  }
  const totalWords = words.length || 1;
  const candidates: { word: string; count: number }[] = [];
  for (const [w, c] of Object.entries(freq)) { if (c >= 2) candidates.push({ word: w, count: c }); }
  for (const [w, c] of Object.entries(bigrams)) { if (c >= 2) candidates.push({ word: w, count: c }); }
  candidates.sort((a, b) => b.count - a.count);
  return candidates.slice(0, 15).map((c, i) => ({
    keyword: c.word,
    count: c.count,
    density: Math.round((c.count / totalWords) * 1000) / 10,
    type: (i < 3 ? "primary" : i < 8 ? "secondary" : "supporting") as KeywordInfo["type"],
  }));
}

function detectTOC(doc: Document): boolean {
  const nav = doc.querySelector('nav, [class*="toc" i], [id*="toc" i], [class*="table-of-contents" i]');
  if (nav) return true;
  const lists = doc.querySelectorAll("ul, ol");
  for (const list of lists) {
    const items = list.querySelectorAll("li");
    if (items.length >= 3) {
      let anchorCount = 0;
      items.forEach((li) => { if (li.querySelector("a[href^='#']")) anchorCount++; });
      if (anchorCount >= 3) return true;
    }
  }
  return false;
}

function detectFAQ(doc: Document): boolean {
  const faqSelectors = doc.querySelectorAll('[class*="faq" i], [id*="faq" i], [class*="frequently-asked" i]');
  if (faqSelectors.length > 0) return true;
  const headings = doc.querySelectorAll("h2, h3, h4");
  let questionCount = 0;
  headings.forEach((h) => { if ((h.textContent?.trim() || "").endsWith("?")) questionCount++; });
  return questionCount >= 3;
}

function extractSchemaTypes(obj: unknown): string[] {
  const types: string[] = [];
  if (!obj || typeof obj !== "object") return types;
  const record = obj as Record<string, unknown>;
  if (record["@type"]) {
    if (Array.isArray(record["@type"])) types.push(...record["@type"].map(String));
    else types.push(String(record["@type"]));
  }
  if (record["@graph"] && Array.isArray(record["@graph"])) {
    for (const g of record["@graph"]) types.push(...extractSchemaTypes(g));
  }
  if (record["@id"] && !record["@type"] && !record["@graph"]) {
    // referenced entity, skip
  }
  // Recurse into nested objects (e.g. mainEntity, hasPart, itemListElement)
  for (const [key, val] of Object.entries(record)) {
    if (key.startsWith("@")) continue;
    if (Array.isArray(val)) {
      for (const v of val) types.push(...extractSchemaTypes(v));
    } else if (typeof val === "object" && val !== null) {
      types.push(...extractSchemaTypes(val));
    }
  }
  return types;
}

function detectSchemas(doc: Document): SchemaInfo[] {
  const schemas: SchemaInfo[] = [];
  const seen = new Set<string>();
  const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  jsonLdScripts.forEach((script) => {
    const raw = script.textContent || "";
    if (!raw.trim()) return;
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const types = extractSchemaTypes(item);
        for (const type of types) {
          const key = type + "|" + raw.slice(0, 100);
          if (!seen.has(key)) {
            seen.add(key);
            schemas.push({ type, source: "json-ld", raw: raw.slice(0, 500) });
          }
        }
      }
    } catch {
      schemas.push({ type: "Invalid JSON-LD", source: "json-ld", raw: raw.slice(0, 200) });
    }
  });
  const microdata = doc.querySelectorAll("[itemtype]");
  microdata.forEach((el) => {
    const itemType = el.getAttribute("itemtype") || "";
    const type = itemType.split("/").pop() || itemType;
    if (!seen.has(type + "|microdata")) {
      seen.add(type + "|microdata");
      schemas.push({ type, source: "microdata", raw: "" });
    }
  });
  return schemas;
}

function detectInfographic(images: { src: string; alt: string }[]): boolean {
  return images.some((img) => {
    const alt = img.alt.toLowerCase();
    const src = img.src.toLowerCase();
    return alt.includes("infographic") || src.includes("infographic") ||
           alt.includes("diagram") || alt.includes("chart") || alt.includes("graph");
  });
}

function resolveUrl(href: string, base: string): string {
  try { return new URL(href, base).href; } catch { return href; }
}

// Normalize hostname: strip leading www. so www.example.com and example.com are same domain
function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}

// Remove header, footer, and nav elements from the doc before extracting links
function removeHeaderFooterLinks(doc: Document): void {
  doc.querySelectorAll("header, footer, nav, [role='navigation'], [role='banner'], [role='contentinfo']").forEach((el) => el.remove());
}

// Fetch with sitemap fallback: try sitemap.xml, then sitemap_index.xml
async function fetchSitemap(origin: string): Promise<{ content: string | null; url: string | null }> {
  const candidates = ["/sitemap.xml", "/sitemap_index.xml"];
  for (const path of candidates) {
    try {
      const res = await fetch(origin + path, { headers: { "User-Agent": "SEO-Audit-Bot/1.0" } });
      if (res.ok) {
        const text = await res.text();
        if (text.trim()) return { content: text, url: origin + path };
      }
    } catch { /* try next */ }
  }
  return { content: null, url: null };
}

// Check if the XML is a sitemap index (links to other sitemaps) vs a urlset (actual page URLs)
function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

// Extract all URLs from a sitemap (handles both urlset and sitemapindex)
function extractSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const urlMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);
  for (const m of urlMatches) {
    const u = m[1].trim();
    if (u) urls.push(u);
  }
  return urls;
}

// Fetch a sitemap URL and return its XML content
async function fetchSitemapContent(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "SEO-Audit-Bot/1.0" } });
    if (res.ok) {
 const text = await res.text();
      if (text.trim()) return text;
    }
  } catch { /* ignore */ }
  return null;
}

// Recursively resolve sitemaps: if root is a sitemap index, fetch child sitemaps (up to 2 layers)
async function resolveAllSitemapUrls(rootXml: string, rootUrl: string): Promise<{ urls: string[]; sitemapsChecked: string[] }> {
  const sitemapsChecked: string[] = [rootUrl];
  const pageUrls: string[] = [];
  const seen = new Set<string>();

  if (!isSitemapIndex(rootXml)) {
    // It's a urlset - extract page URLs directly
    for (const u of extractSitemapUrls(rootXml)) {
      if (!seen.has(u)) { seen.add(u); pageUrls.push(u); }
    }
    return { urls: pageUrls, sitemapsChecked };
  }

  // Layer 1: sitemap index - get child sitemap URLs
  const childSitemapUrls = extractSitemapUrls(rootXml);

  // Layer 2: fetch each child sitemap and extract page URLs
  for (const childUrl of childSitemapUrls) {
    sitemapsChecked.push(childUrl);
    const childXml = await fetchSitemapContent(childUrl);
    if (!childXml) continue;

    if (isSitemapIndex(childXml)) {
      // Nested sitemap index - fetch its children too (still within 2 layers of actual sitemaps)
      const grandchildUrls = extractSitemapUrls(childXml);
      for (const gUrl of grandchildUrls) {
        sitemapsChecked.push(gUrl);
        const gXml = await fetchSitemapContent(gUrl);
        if (gXml) {
          for (const u of extractSitemapUrls(gXml)) {
            if (!seen.has(u)) { seen.add(u); pageUrls.push(u); }
          }
        }
      }
    } else {
      // Child is a urlset - extract page URLs
      for (const u of extractSitemapUrls(childXml)) {
        if (!seen.has(u)) { seen.add(u); pageUrls.push(u); }
      }
    }
  }

  return { urls: pageUrls, sitemapsChecked };
}

// ===== Noindex detection =====
function detectNoindex(doc: Document, headers: Record<string, string>): NoindexInfo {
  // Check X-Robots-Tag header
  const xRobotsTag = headers["x-robots-tag"];
  if (xRobotsTag) {
    const directives = xRobotsTag.toLowerCase();
    if (directives.includes("noindex")) {
      return { indexable: false, source: "x-robots-tag", directive: xRobotsTag, detail: `X-Robots-Tag: ${xRobotsTag}` };
    }
  }
  // Check meta robots tag
  const metaRobots = getMeta(doc, 'meta[name="robots"]');
  if (metaRobots) {
    const directives = metaRobots.toLowerCase();
    if (directives.includes("noindex")) {
      return { indexable: false, source: "meta-robots", directive: metaRobots, detail: `<meta name="robots" content="${metaRobots}">` };
    }
    if (directives.includes("none")) {
      return { indexable: false, source: "meta-robots", directive: metaRobots, detail: `<meta name="robots" content="${metaRobots}"> (none = noindex+nofollow)` };
    }
  }
  return { indexable: true, source: "none", directive: null, detail: "Page is indexable (no noindex directive found)" };
}

// ===== Google property detection from raw HTML =====
function detectGoogleProperties(rawHtml: string): GoogleProperty[] {
  const props: GoogleProperty[] = [];
  const seen = new Set<string>();

  function add(property: string, id: string | null, detail: string) {
    const key = property + "|" + (id || "");
    if (!seen.has(key)) { seen.add(key); props.push({ property, id, detail }); }
  }

  // GA4 / Universal Analytics
  const ga4Match = rawHtml.match(/G-[A-Z0-9]{8,}/g);
  if (ga4Match) for (const id of ga4Match) add("Google Analytics 4", id, `GA4 Measurement ID: ${id}`);
  const uaMatch = rawHtml.match(/UA-\d+-\d+/g);
  if (uaMatch) for (const id of uaMatch) add("Universal Analytics", id, `UA Tracking ID: ${id}`);
  const gtagGa = rawHtml.match(/gtag\([^)]*['"]config['"],\s*['"](G-[A-Z0-9]+|UA-\d+-\d+)['"]/g);
  if (gtagGa) for (const m of gtagGa) {
    const idMatch = m.match(/['"](G-[A-Z0-9]+|UA-\d+-\d+)['"]/);
    if (idMatch) add("Google Analytics", idMatch[1], `gtag config: ${idMatch[1]}`);
  }

  // Google Tag Manager
  const gtmMatch = rawHtml.match(/GTM-[A-Z0-9]+/g);
  if (gtmMatch) for (const id of gtmMatch) add("Google Tag Manager", id, `GTM Container ID: ${id}`);

  // Google Ads
  const adsIdMatch = rawHtml.match(/AW-\d+/g);
  if (adsIdMatch) for (const id of adsIdMatch) add("Google Ads", id, `Google Ads ID: ${id}`);
  const adsConversionMatch = rawHtml.match(/['"]conversion_id['"]:\s*['"](AW-\d+)['"]/g);
  if (adsConversionMatch) for (const m of adsConversionMatch) {
    const idM = m.match(/AW-\d+/);
    if (idM) add("Google Ads Conversion Tracking", idM[0], `Conversion ID: ${idM[0]}`);
  }
  const gtagAds = rawHtml.match(/gtag\([^)]*['"]config['"],\s*['"](AW-\d+)['"]/g);
  if (gtagAds) for (const m of gtagAds) {
    const idM = m.match(/AW-\d+/);
    if (idM) add("Google Ads", idM[0], `gtag config: ${idM[0]}`);
  }

  // Google Search Console verification
  const gscMeta = rawHtml.match(/<meta\s+name=["']google-site-verification["']\s+content=["']([^"']+)["']/i);
  if (gscMeta) add("Google Search Console", gscMeta[1], `Verification token: ${gscMeta[1].slice(0, 20)}...`);

  // Google Maps
  if (/maps\.google\.com|google\.com\/maps|gm_/.test(rawHtml)) {
    const mapEmbed = rawHtml.match(/maps\.google\.com\/maps\?[^"'\s]+/);
    add("Google Maps", null, mapEmbed ? `Map embed detected: ${mapEmbed[0].slice(0, 60)}...` : "Google Maps embed detected");
  }

  return props;
}

// ===== Internal link status checking with cache =====
const linkStatusCache = new Map<string, InternalLinkStatus>();

async function checkLinkStatus(href: string, text: string): Promise<InternalLinkStatus> {
  if (linkStatusCache.has(href)) return linkStatusCache.get(href)!;

  const result: InternalLinkStatus = { href, text, status: null, redirect: null, error: null };

  try {
    const res = await fetch(href, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": "SEO-Audit-Bot/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      result.redirect = location ? resolveUrl(location, href) : null;
      result.status = res.status;
    } else {
      result.status = res.status;
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : "Failed to check link";
  }

  linkStatusCache.set(href, result);
  return result;
}

async function checkInternalLinkStatuses(internalLinks: { href: string; text: string }[], maxLinks: number): Promise<InternalLinkStatus[]> {
  const uniqueLinks = [...new Map(internalLinks.map((l) => [l.href, l])).values()].slice(0, maxLinks);
  const results: InternalLinkStatus[] = [];
  for (const link of uniqueLinks) {
    results.push(await checkLinkStatus(link.href, link.text));
  }
  return results;
}

// ===== Schema validation (basic structural validation) =====
function validateSchema(schema: { type: string; source: string; raw: string }): SchemaValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (schema.type === "Invalid JSON-LD") {
    errors.push("JSON-LD is not valid JSON");
    return { type: schema.type, valid: false, errors, warnings };
  }

  // Basic structural checks based on type
  const type = schema.type;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(schema.raw.length > 500 ? schema.raw.slice(0, 500) : schema.raw);
  } catch {
    errors.push("Could not parse JSON-LD");
    return { type, valid: false, errors, warnings };
  }

  const obj = parsed as Record<string, unknown>;

  // Check for required @context
  if (!obj["@context"] && !obj["@graph"]) {
    warnings.push("Missing @context (recommended: https://schema.org)");
  }

  // Type-specific checks
  if (type === "Article" || type === "BlogPosting" || type === "NewsArticle") {
    if (!obj["headline"]) warnings.push("Missing 'headline' property");
    if (!obj["author"]) warnings.push("Missing 'author' property");
    if (!obj["datePublished"]) warnings.push("Missing 'datePublished' property");
    if (!obj["image"]) warnings.push("Missing 'image' property");
  } else if (type === "Product") {
    if (!obj["name"]) errors.push("Missing required 'name' property");
    if (!obj["offers"] && !obj["aggregateRating"]) warnings.push("Missing 'offers' or 'aggregateRating'");
  } else if (type === "BreadcrumbList") {
    if (!obj["itemListElement"]) errors.push("Missing required 'itemListElement' property");
  } else if (type === "FAQPage") {
    if (!obj["mainEntity"]) errors.push("Missing required 'mainEntity' property");
  } else if (type === "Organization") {
    if (!obj["name"]) warnings.push("Missing 'name' property");
    if (!obj["url"]) warnings.push("Missing 'url' property");
  } else if (type === "LocalBusiness") {
    if (!obj["name"]) warnings.push("Missing 'name' property");
    if (!obj["address"]) warnings.push("Missing 'address' property");
    if (!obj["telephone"]) warnings.push("Missing 'telephone' property");
  }

  return { type, valid: errors.length === 0, errors, warnings };
}

// ===== Deterministic content recommendations (no AI needed) =====
function generateContentRecommendations(
  title: string | null,
  description: string | null,
  h1s: string[],
  keywords: { keyword: string; count: number; type: string }[],
  bodyText: string,
): ContentRecommendation[] {
  const recs: ContentRecommendation[] = [];
  const primaryKw = keywords[0]?.keyword || "";
  const pageTopic = bodyText.slice(0, 200).trim();

  // Title recommendation
  if (!title) {
    const suggested = primaryKw
      ? primaryKw.charAt(0).toUpperCase() + primaryKw.slice(1) + " | Your Site Name"
      : "Your Page Title | Your Site Name";
    recs.push({ element: "title", issue: "Missing title tag", currentContent: "N/A", updatedContent: suggested.slice(0, 60), status: "fail" });
  } else if (title.length < 30) {
    const suggested = primaryKw
      ? `${primaryKw.charAt(0).toUpperCase() + primaryKw.slice(1)} - ${title}`.slice(0, 60)
      : `${title} | Complete Guide & Resources`.slice(0, 60);
    recs.push({ element: "title", issue: `Too short (${title.length} chars)`, currentContent: title, updatedContent: suggested, status: "warn" });
  } else if (title.length > 60) {
    const suggested = title.slice(0, 57) + "...";
    recs.push({ element: "title", issue: `Too long (${title.length} chars)`, currentContent: title, updatedContent: suggested, status: "warn" });
  } else {
    recs.push({ element: "title", issue: "OK", currentContent: title, updatedContent: "No change required", status: "pass" });
  }

  // Meta description recommendation
  if (!description) {
    const suggested = primaryKw
      ? `Learn about ${primaryKw}. ${pageTopic.slice(0, 100)}. Get expert insights and practical tips.`
      : `Discover ${pageTopic.slice(0, 120)}. Read our comprehensive guide.`
    recs.push({ element: "meta-description", issue: "Missing meta description", currentContent: "N/A", updatedContent: suggested.slice(0, 160), status: "fail" });
  } else if (description.length < 120) {
    const suggested = `${description} ${primaryKw ? `Learn more about ${primaryKw}.` : "Read our full guide."}`.slice(0, 160);
    recs.push({ element: "meta-description", issue: `Too short (${description.length} chars)`, currentContent: description, updatedContent: suggested, status: "warn" });
  } else if (description.length > 160) {
    const suggested = description.slice(0, 157) + "...";
    recs.push({ element: "meta-description", issue: `Too long (${description.length} chars)`, currentContent: description, updatedContent: suggested, status: "warn" });
  } else {
    recs.push({ element: "meta-description", issue: "OK", currentContent: description, updatedContent: "No change required", status: "pass" });
  }

  // H1 recommendation
  if (h1s.length === 0) {
    const suggested = primaryKw
      ? primaryKw.charAt(0).toUpperCase() + primaryKw.slice(1)
      : pageTopic.slice(0, 60) || "Page Heading";
    recs.push({ element: "h1", issue: "Missing H1 tag", currentContent: "N/A", updatedContent: suggested, status: "fail" });
  } else if (h1s.length > 1) {
    const best = h1s[0] || primaryKw || "Main Heading";
    recs.push({ element: "h1", issue: `${h1s.length} H1 tags found (use only one)`, currentContent: h1s.join(" / "), updatedContent: best, status: "warn" });
  } else {
    recs.push({ element: "h1", issue: "OK", currentContent: h1s[0], updatedContent: "No change required", status: "pass" });
  }

  return recs;
}

// ===== Google Ads Keyword Planner API =====
async function fetchKeywordMetrics(keywords: string[]): Promise<KeywordMetric[]> {
  const clientId = process.env["GOOGLE_ADS_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_ADS_CLIENT_SECRET"];
  const refreshToken = process.env["GOOGLE_ADS_REFRESH_TOKEN"];
  const developerToken = process.env["GOOGLE_ADS_DEVELOPER_TOKEN"];
  const customerId = process.env["GOOGLE_ADS_CUSTOMER_ID"];

  if (!clientId || !clientSecret || !refreshToken || !developerToken || !customerId) {
    return keywords.slice(0, 5).map((kw) => ({
      keyword: kw,
      searchVolume: null,
      competition: null,
      competitionIndex: null,
      lowTopOfPageBid: null,
      highTopOfPageBid: null,
      source: "Google Ads (not configured)",
    }));
  }

  try {
    // Step 1: Get access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) throw new Error("Failed to get Google Ads access token");
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Step 2: Query Keyword Plan API
    const planRes = await fetch(`https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          SELECT
            keyword_plan_historical_metrics.keyword_text,
            keyword_plan_historical_metrics.avg_monthly_searches,
            keyword_plan_historical_metrics.competition,
            keyword_plan_historical_metrics.competition_index,
            keyword_plan_historical_metrics.low_top_of_page_bid_micros,
            keyword_plan_historical_metrics.high_top_of_page_bid_micros
          FROM keyword_plan_historical_metrics
          WHERE keyword_plan_historical_metrics.keyword_text IN (${keywords.slice(0, 10).map((k) => `'${k.replace(/'/g, "")}'`).join(",")})
        `,
      }),
    });

    if (!planRes.ok) throw new Error("Google Ads API request failed");
    const planData = await planRes.json();
    const results: KeywordMetric[] = [];

    for (const batch of planData) {
      for (const row of batch.results || []) {
        const m = row.keywordPlanHistoricalMetrics || {};
        results.push({
          keyword: m.keywordText || "",
          searchVolume: m.avgMonthlySearches ? String(m.avgMonthlySearches) : null,
          competition: m.competition || null,
          competitionIndex: m.competitionIndex ? String(m.competitionIndex) : null,
          lowTopOfPageBid: m.lowTopOfPageBidMicros ? (Number(m.lowTopOfPageBidMicros) / 1_000_000).toFixed(2) : null,
          highTopOfPageBid: m.highTopOfPageBidMicros ? (Number(m.highTopOfPageBidMicros) / 1_000_000).toFixed(2) : null,
          source: "Google Ads Keyword Planner",
        });
      }
    }

    return results.length > 0 ? results : keywords.slice(0, 5).map((kw) => ({
      keyword: kw,
      searchVolume: null,
      competition: null,
      competitionIndex: null,
      lowTopOfPageBid: null,
      highTopOfPageBid: null,
      source: "Google Ads (no data returned)",
    }));
  } catch (e) {
    return keywords.slice(0, 5).map((kw) => ({
      keyword: kw,
      searchVolume: null,
      competition: null,
      competitionIndex: null,
      lowTopOfPageBid: null,
      highTopOfPageBid: null,
      source: `Google Ads (error: ${e instanceof Error ? e.message : "unknown"})`,
    }));
  }
}

interface CustomAuditData {
  pages: { url: string; title: string | null; description: string | null; h1: string[]; h2: string[]; canonical: string | null; robotsMeta: string | null }[];
  missingAlt: { page: string; src: string }[];
  redirects: { source: string; target: string | null; status: number }[];
  duplicates: { type: "title" | "description" | "h1"; value: string; pages: string[] }[];
  trackingCodes: { type: string; id: string | null; pages: string[] }[];
  forms: { page: string; action: string; method: string }[];
}

async function discoverCustomUrls(seedUrl: string, sitemapContent: string | null, sitemapUrl: string | null): Promise<string[]> {
  if (sitemapContent && sitemapUrl) {
    const crawled = await resolveAllSitemapUrls(sitemapContent, sitemapUrl);
    if (crawled.urls.length > 1) return [...new Set(crawled.urls)].slice(0, 100);
  }

  const seed = new URL(seedUrl);
  const seedHostname = normalizeHostname(seed.hostname);
  const seen = new Set<string>([seedUrl]);
  const queue = [seedUrl];
  while (queue.length > 0 && seen.size < 50) {
    const batch = queue.splice(0, 8);
    const discovered = await Promise.all(batch.map(async (url) => {
      try {
        const response = await fetch(url, { headers: { "User-Agent": "SEO-Audit-Bot/1.0" }, signal: AbortSignal.timeout(7000) });
        if (!response.ok) return [];
        const html = await response.text();
        const { document: doc } = parseHTML(html);
        return Array.from(doc.querySelectorAll("a[href]"))
          .map((anchor) => { try { return new URL(anchor.getAttribute("href") || "", url).href.split("#")[0]; } catch { return ""; } })
          .filter((href) => href && /^https?:$/i.test(new URL(href).protocol) && normalizeHostname(new URL(href).hostname) === seedHostname);
      } catch { return []; }
    }));
    for (const urls of discovered) for (const url of urls) if (!seen.has(url) && seen.size < 50) { seen.add(url); queue.push(url); }
  }
  return [...seen];
}

async function collectCustomAudit(urls: string[]): Promise<CustomAuditData> {
  const pages: CustomAuditData["pages"] = [];
  const missingAlt: CustomAuditData["missingAlt"] = [];
  const redirects: CustomAuditData["redirects"] = [];
  const forms: CustomAuditData["forms"] = [];
  const tracking = new Map<string, { type: string; id: string | null; pages: Set<string> }>();
  const detectors: { type: string; pattern: RegExp; idPattern?: RegExp }[] = [
    { type: "Google Tag Manager", pattern: /googletagmanager\.com|GTM-[A-Z0-9]+/i, idPattern: /GTM-[A-Z0-9]+/i },
    { type: "Google Analytics", pattern: /google-analytics\.com|gtag\(|GA-[A-Z0-9-]+/i, idPattern: /G-[A-Z0-9-]+|UA-\d+-\d+/i },
    { type: "Meta Pixel", pattern: /connect\.facebook\.net|fbq\(/i, idPattern: /[0-9]{8,}/ },
    { type: "LinkedIn Insight", pattern: /snap\.licdn\.com|linkedin\.com\/insight/i },
    { type: "Hotjar", pattern: /static\.hotjar\.com|hj\(/i },
  ];

  let nextIndex = 0;
  const scan = async (): Promise<void> => {
    while (nextIndex < urls.length && nextIndex < 100) {
      const url = urls[nextIndex++];
      try {
        const response = await fetch(url, { redirect: "manual", headers: { "User-Agent": "SEO-Audit-Bot/1.0" }, signal: AbortSignal.timeout(7000) });
        if (response.status >= 300 && response.status < 400) { redirects.push({ source: url, target: response.headers.get("location"), status: response.status }); continue; }
        if (!response.ok) continue;
        const html = await response.text();
        const { document: doc } = parseHTML(html);
        const title = doc.querySelector("title")?.textContent?.trim() || null;
        const description = doc.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || null;
        const h1 = Array.from(doc.querySelectorAll("h1")).map((el) => el.textContent?.trim() || "").filter(Boolean);
        const h2 = Array.from(doc.querySelectorAll("h2")).map((el) => el.textContent?.trim() || "").filter(Boolean);
        const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || null;
        const robotsMeta = doc.querySelector('meta[name="robots"]')?.getAttribute("content") || null;
        pages.push({ url, title, description, h1, h2, canonical, robotsMeta });
        for (const image of Array.from(doc.querySelectorAll("img"))) if (!image.getAttribute("alt")?.trim()) missingAlt.push({ page: url, src: image.getAttribute("src") || "(image source missing)" });
        for (const form of Array.from(doc.querySelectorAll("form"))) forms.push({ page: url, action: form.getAttribute("action") || url, method: (form.getAttribute("method") || "GET").toUpperCase() });
        const scriptsText = Array.from(doc.querySelectorAll("script")).map((script) => `${script.getAttribute("src") || ""} ${script.textContent || ""}`).join(" ");
        for (const detector of detectors) if (detector.pattern.test(scriptsText)) {
          const id = detector.idPattern?.exec(scriptsText)?.[0] || null;
          const key = `${detector.type}|${id || ""}`;
          if (!tracking.has(key)) tracking.set(key, { type: detector.type, id, pages: new Set() });
          tracking.get(key)!.pages.add(url);
        }
      } catch { /* keep the page visible through the other audit results */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, Math.max(1, urls.length)) }, () => scan()));

  const duplicateMap = new Map<string, { type: "title" | "description" | "h1"; value: string; pages: string[] }>();
  for (const page of pages) {
    for (const item of [
      { type: "title" as const, value: page.title },
      { type: "description" as const, value: page.description },
      ...page.h1.map((value) => ({ type: "h1" as const, value })),
    ]) {
      const value = item.value?.trim();
      if (!value) continue;
      const key = `${item.type}|${value.toLowerCase()}`;
      const current = duplicateMap.get(key) || { type: item.type, value, pages: [] };
      current.pages.push(page.url);
      duplicateMap.set(key, current);
    }
  }

  return {
    pages,
    missingAlt,
    redirects,
    duplicates: [...duplicateMap.values()].filter((item) => item.pages.length > 1),
    trackingCodes: [...tracking.values()].map((item) => ({ ...item, pages: [...item.pages] })),
    forms,
  };
}

// Core audit logic - extracted so it can be called for single page or per-URL in crawl
async function auditSinglePage(
  targetUrl: string,
  robotsContent: string | null,
  sitemapContent: string | null,
  sitemapUrl: string | null,
  staging: boolean = false,
  auditDepth: string = "deep",
): Promise<AuditResult> {
  const parsed = new URL(targetUrl);
  const baseHostname = normalizeHostname(parsed.hostname);

  let pageHtml = "";
  const pageHeaders: Record<string, string> = {};
  let pageOk = false;
  let pageStatus = 0;
  let fetchError: string | null = null;
  let responseTimeMs = 0;
  let htmlSizeBytes = 0;

  try {
    const start = Date.now();
    const res = await fetch(targetUrl, {
      headers: { "User-Agent": "SEO-Audit-Bot/1.0 (+https://bolt.new)" },
      redirect: "follow",
    });
    responseTimeMs = Date.now() - start;
    pageStatus = res.status;
    pageOk = res.ok;
    res.headers.forEach((v, k) => { pageHeaders[k.toLowerCase()] = v; });
    pageHtml = await res.text();
    htmlSizeBytes = pageHtml.length;
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to fetch URL";
  }

  const checks: CheckResult[] = [];
  const recommendations: { priority: "high" | "medium" | "low"; title: string; detail: string }[] = [];

  if (fetchError) throw new Error(fetchError);

  const { doc, text } = stripHtml(pageHtml);

  // Remove header/footer/nav links before link analysis
  removeHeaderFooterLinks(doc);

  const title = doc.querySelector("title")?.textContent?.trim() || null;
  const description = getMeta(doc, 'meta[name="description"]');
  const canonical = getMeta(doc, 'link[rel="canonical"]', "href");
  const viewport = getMeta(doc, 'meta[name="viewport"]');
  const charset = doc.querySelector("meta[charset]")?.getAttribute("charset") || getMeta(doc, 'meta[http-equiv="Content-Type"]');

  const ogTitle = getMeta(doc, 'meta[property="og:title"]');
  const ogDescription = getMeta(doc, 'meta[property="og:description"]');
  const ogImage = getMeta(doc, 'meta[property="og:image"]');
  const ogUrl = getMeta(doc, 'meta[property="og:url"]');

  const twitterCard = getMeta(doc, 'meta[name="twitter:card"]');
  const twitterTitle = getMeta(doc, 'meta[name="twitter:title"]');
  const twitterDescription = getMeta(doc, 'meta[name="twitter:description"]');
  const twitterImage = getMeta(doc, 'meta[name="twitter:image"]');

  const h1s = Array.from(doc.querySelectorAll("h1")).map((h) => h.textContent?.trim() || "");
  const h2s = Array.from(doc.querySelectorAll("h2")).map((h) => h.textContent?.trim() || "");
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => ({
    level: parseInt(h.tagName.slice(1)),
    text: h.textContent?.trim() || "",
  }));

  const imgs = Array.from(doc.querySelectorAll("img")).map((img) => ({
    src: img.getAttribute("src") || "",
    alt: img.getAttribute("alt") || "",
    width: img.getAttribute("width") || "",
    height: img.getAttribute("height") || "",
  }));

  const rawLinks = Array.from(doc.querySelectorAll("a[href]")).map((a) => ({
    href: a.getAttribute("href") || "",
    rel: a.getAttribute("rel") || "",
    text: a.textContent?.trim() || "",
  }));

  const links = rawLinks.map((l) => ({ ...l, href: resolveUrl(l.href, targetUrl) }));
  const words = wordCount(text);

  // Link analysis with www-normalization
  const internalLinks = links.filter((l) => {
    try { return normalizeHostname(new URL(l.href).hostname) === baseHostname; } catch { return false; }
  });
  const externalLinks = links.filter((l) => {
    try { return normalizeHostname(new URL(l.href).hostname) !== baseHostname; } catch { return false; }
  });
  const nofollowLinks = links.filter((l) => l.rel.includes("nofollow"));
  const dofollowLinks = links.filter((l) => !l.rel.includes("nofollow") && l.href && !l.href.startsWith("mailto:") && !l.href.startsWith("tel:"));
  const imagesWithoutAlt = imgs.filter((i) => !i.alt && i.src);
  const bodyLinks = links.filter((l) => l.href && !l.href.startsWith("mailto:") && !l.href.startsWith("tel:") && !l.href.startsWith("#"));

  const keywords = extractKeywords(text);
  const hasTOC = detectTOC(doc);
  const hasFAQ = detectFAQ(doc);
  const schemaTypes = detectSchemas(doc);
  const hasInfographic = detectInfographic(imgs);

  const scriptCount = doc.querySelectorAll("script").length;
  const stylesheetCount = doc.querySelectorAll('link[rel="stylesheet"]').length;
  const imgCount = imgs.length;
  const resourceCount = scriptCount + stylesheetCount + imgCount;
  const estimatedTransferTimeSec = Math.round((htmlSizeBytes / 50000) * 100) / 100;
  const speedRecs: string[] = [];
  if (scriptCount > 5) speedRecs.push(`Reduce JavaScript files (${scriptCount} scripts found). Defer non-critical scripts.`);
  if (stylesheetCount > 3) speedRecs.push(`Reduce CSS files (${stylesheetCount} stylesheets found). Consider critical CSS inlining.`);
  if (imgCount > 10) speedRecs.push(`Optimize images (${imgCount} images found). Use lazy loading and modern formats (WebP/AVIF).`);
  if (htmlSizeBytes > 200000) speedRecs.push(`HTML payload is large (${(htmlSizeBytes / 1024).toFixed(0)}KB). Minify HTML and reduce inline scripts.`);
  if (responseTimeMs > 1000) speedRecs.push(`Server response time is slow (${responseTimeMs}ms). Consider CDN caching and server optimization.`);
  if (!viewport) speedRecs.push("Add viewport meta tag for mobile rendering.");

  const pageSpeed: PageSpeedInfo = {
    responseTimeMs, htmlSizeBytes, estimatedTransferTimeSec,
    resources: resourceCount, scripts: scriptCount, stylesheets: stylesheetCount,
    images: imgCount, mobileOptimized: !!viewport, hasViewport: !!viewport,
    recommendations: speedRecs,
  };

  // ===== ON-PAGE CHECKS =====
  if (title) {
    const len = title.length;
    if (len >= 30 && len <= 60) checks.push({ id: "title", label: "Title Tag", category: "on-page", status: "pass", detail: `Found (${len} chars)`, value: title });
    else if (len < 30) { checks.push({ id: "title", label: "Title Tag", category: "on-page", status: "warn", detail: `Too short (${len} chars). Aim for 30-60 characters.`, value: title }); recommendations.push({ priority: "high", title: "Expand Title Tag", detail: `Your title is ${len} chars. Aim for 30-60 chars with primary keyword near the front.` }); }
    else { checks.push({ id: "title", label: "Title Tag", category: "on-page", status: "warn", detail: `Too long (${len} chars). Search engines truncate around 60 characters.`, value: title }); recommendations.push({ priority: "medium", title: "Shorten Title Tag", detail: `Your title is ${len} chars. Search engines truncate at ~60 chars. Move primary keyword to the front.` }); }
  } else {
    checks.push({ id: "title", label: "Title Tag", category: "on-page", status: "fail", detail: "Missing <title> tag. This is critical for SEO." });
    recommendations.push({ priority: "high", title: "Add Title Tag", detail: "No <title> tag found. This is the most important on-page SEO element. Add a 30-60 char title with your primary keyword." });
  }

  if (description) {
    const len = description.length;
    if (len >= 120 && len <= 160) checks.push({ id: "meta-description", label: "Meta Description", category: "on-page", status: "pass", detail: `Found (${len} chars)`, value: description });
    else if (len < 120) { checks.push({ id: "meta-description", label: "Meta Description", category: "on-page", status: "warn", detail: `Short (${len} chars). Aim for 120-160 characters.`, value: description }); recommendations.push({ priority: "medium", title: "Expand Meta Description", detail: `Your description is ${len} chars. Aim for 120-160 chars with a compelling CTA and primary keyword.` }); }
    else checks.push({ id: "meta-description", label: "Meta Description", category: "on-page", status: "warn", detail: `Too long (${len} chars). May be truncated.`, value: description });
  } else {
    checks.push({ id: "meta-description", label: "Meta Description", category: "on-page", status: "fail", detail: "Missing meta description." });
    recommendations.push({ priority: "high", title: "Add Meta Description", detail: "No meta description found. Add a 120-160 char description with your primary keyword and a call-to-action." });
  }

  if (h1s.length === 1) checks.push({ id: "h1", label: "Single H1", category: "on-page", status: "pass", detail: `One H1 found`, value: h1s[0] });
  else if (h1s.length === 0) { checks.push({ id: "h1", label: "Single H1", category: "on-page", status: "fail", detail: "No H1 tag found." }); recommendations.push({ priority: "high", title: "Add H1 Heading", detail: "No H1 tag found. Add exactly one H1 with your primary keyword." }); }
  else checks.push({ id: "h1", label: "Single H1", category: "on-page", status: "warn", detail: `${h1s.length} H1 tags found. Use only one.`, value: h1s.join("\n") });

  if (h2s.length > 0) checks.push({ id: "headings", label: "H2 Subheadings", category: "on-page", status: "pass", detail: `${h2s.length} H2 tags found.`, value: h2s.join("\n") });
  else { checks.push({ id: "headings", label: "H2 Subheadings", category: "on-page", status: "warn", detail: "No H2 tags." }); recommendations.push({ priority: "medium", title: "Add H2 Subheadings", detail: "No H2 tags found. Break content into sections with H2s containing secondary keywords." }); }

  if (words >= 300) checks.push({ id: "content-length", label: "Content Length", category: "on-page", status: "pass", detail: `${words} words of content detected.` });
  else if (words >= 100) { checks.push({ id: "content-length", label: "Content Length", category: "on-page", status: "warn", detail: `Only ${words} words. Aim for 300+.` }); recommendations.push({ priority: "medium", title: "Increase Content Length", detail: `Only ${words} words detected. Aim for 300+ words.` }); }
  else { checks.push({ id: "content-length", label: "Content Length", category: "on-page", status: "fail", detail: `Very little text (${words} words).` }); recommendations.push({ priority: "high", title: "Add Substantial Content", detail: `Only ${words} words found. Add 300+ words.` }); }

  if (imgs.length === 0) checks.push({ id: "img-alt", label: "Image Alt Text", category: "on-page", status: "info", detail: "No images found." });
  else if (imagesWithoutAlt.length === 0) checks.push({ id: "img-alt", label: "Image Alt Text", category: "on-page", status: "pass", detail: `All ${imgs.length} images have alt text.` });
  else { checks.push({ id: "img-alt", label: "Image Alt Text", category: "on-page", status: "warn", detail: `${imagesWithoutAlt.length} of ${imgs.length} images missing alt text.`, value: imagesWithoutAlt.map((i) => i.src).slice(0, 5).join("\n") }); recommendations.push({ priority: "medium", title: "Add Missing Alt Text", detail: `${imagesWithoutAlt.length} of ${imgs.length} images are missing alt text.` }); }

  if (imgs.length > 0 && keywords.length > 0) {
    const primaryKw = keywords[0]?.keyword.toLowerCase() || "";
    const relevantImgs = imgs.filter((i) => i.alt && primaryKw && i.alt.toLowerCase().includes(primaryKw));
    if (relevantImgs.length > 0) checks.push({ id: "img-relevance", label: "Image Relevance", category: "on-page", status: "pass", detail: `${relevantImgs.length} images reference primary keyword "${primaryKw}".` });
    else checks.push({ id: "img-relevance", label: "Image Relevance", category: "on-page", status: "warn", detail: `No images reference primary keyword "${primaryKw}" in alt text.` });
  }

  if (hasInfographic) checks.push({ id: "infographic", label: "Infographic Present", category: "on-page", status: "pass", detail: "Infographic or chart image detected." });
  else checks.push({ id: "infographic", label: "Infographic Present", category: "on-page", status: "info", detail: "No infographic detected. Infographics improve engagement and earn backlinks." });

  if (canonical) {
    // Validate canonical URL
    try {
      const canonicalUrl = new URL(canonical, targetUrl);
      if (canonicalUrl.href === targetUrl || canonicalUrl.origin === parsed.origin) {
        checks.push({ id: "canonical", label: "Canonical URL", category: "on-page", status: "pass", detail: `Valid canonical URL set`, value: canonical });
      } else {
        checks.push({ id: "canonical", label: "Canonical URL", category: "on-page", status: "warn", detail: `Canonical points to different origin: ${canonical}`, value: canonical });
      }
    } catch {
      checks.push({ id: "canonical", label: "Canonical URL", category: "on-page", status: "warn", detail: `Canonical URL is invalid: ${canonical}`, value: canonical });
    }
  } else { checks.push({ id: "canonical", label: "Canonical URL", category: "on-page", status: "warn", detail: "No canonical link tag." }); recommendations.push({ priority: "medium", title: "Add Canonical Tag", detail: "No canonical URL found. Add a <link rel='canonical'> tag." }); }

  // Hreflang check
  const hreflangLinks = Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]'));
  if (hreflangLinks.length > 0) {
    const invalidHreflangs = hreflangLinks.filter((l) => {
      const hreflang = l.getAttribute("hreflang") || "";
      const href = l.getAttribute("href") || "";
      return !hreflang || !href;
    });
    if (invalidHreflangs.length === 0) checks.push({ id: "hreflang", label: "Hreflang Tags", category: "on-page", status: "pass", detail: `${hreflangLinks.length} valid hreflang tags found.`, value: hreflangLinks.map((l) => `${l.getAttribute("hreflang")}: ${l.getAttribute("href")}`).join("\n") });
    else checks.push({ id: "hreflang", label: "Hreflang Tags", category: "on-page", status: "warn", detail: `${invalidHreflangs.length} invalid hreflang tags (missing href or hreflang).` });
  } else checks.push({ id: "hreflang", label: "Hreflang Tags", category: "on-page", status: "info", detail: "No hreflang tags found (only needed for multilingual pages)." });

  const ogCount = [ogTitle, ogDescription, ogImage, ogUrl].filter(Boolean).length;
  if (ogCount === 4) checks.push({ id: "open-graph", label: "Open Graph Tags", category: "on-page", status: "pass", detail: "All essential OG tags present." });
  else if (ogCount >= 2) { checks.push({ id: "open-graph", label: "Open Graph Tags", category: "on-page", status: "warn", detail: `${ogCount}/4 essential OG tags found.` }); recommendations.push({ priority: "low", title: "Complete Open Graph Tags", detail: `${ogCount}/4 OG tags found.` }); }
  else { checks.push({ id: "open-graph", label: "Open Graph Tags", category: "on-page", status: "fail", detail: "Missing Open Graph tags." }); recommendations.push({ priority: "medium", title: "Add Open Graph Tags", detail: "Missing OG tags. Add og:title, og:description, og:image, og:url." }); }

  if (twitterCard) checks.push({ id: "twitter-cards", label: "Twitter Card Tags", category: "on-page", status: "pass", detail: `Twitter card type: ${twitterCard}`, value: twitterCard });
  else checks.push({ id: "twitter-cards", label: "Twitter Card Tags", category: "on-page", status: "warn", detail: "No Twitter Card meta tags found." });

  if (hasTOC) checks.push({ id: "toc", label: "Table of Contents", category: "on-page", status: "pass", detail: "Table of contents detected." });
  else checks.push({ id: "toc", label: "Table of Contents", category: "on-page", status: "info", detail: "No table of contents detected." });

  if (hasFAQ) checks.push({ id: "faq", label: "FAQ Section", category: "on-page", status: "pass", detail: "FAQ section detected." });
  else { checks.push({ id: "faq", label: "FAQ Section", category: "on-page", status: "info", detail: "No FAQ section detected." }); recommendations.push({ priority: "low", title: "Add FAQ Section", detail: "No FAQ section found. Add a FAQ with 3+ questions." }); }

  if (keywords.length > 0) {
    const primary = keywords[0];
    if (primary.density >= 0.5 && primary.density <= 3) checks.push({ id: "keyword-density", label: "Primary Keyword Density", category: "on-page", status: "pass", detail: `"${primary.keyword}" appears ${primary.count} times (${primary.density}%).`, value: keywords.slice(0, 10).map((k) => `${k.keyword}: ${k.density}% (${k.count}x) [${k.type}]`).join("\n") });
    else if (primary.density > 3) { checks.push({ id: "keyword-density", label: "Primary Keyword Density", category: "on-page", status: "warn", detail: `"${primary.keyword}" density is ${primary.density}% - may be keyword stuffing.`, value: keywords.slice(0, 10).map((k) => `${k.keyword}: ${k.density}% (${k.count}x) [${k.type}]`).join("\n") }); recommendations.push({ priority: "medium", title: "Reduce Keyword Stuffing", detail: `"${primary.keyword}" appears at ${primary.density}% density. Reduce to 1-3%.` }); }
    else checks.push({ id: "keyword-density", label: "Primary Keyword Density", category: "on-page", status: "warn", detail: `"${primary.keyword}" density is only ${primary.density}%.`, value: keywords.slice(0, 10).map((k) => `${k.keyword}: ${k.density}% (${k.count}x) [${k.type}]`).join("\n") });
  }

  // ===== OFF-PAGE CHECKS =====
  if (internalLinks.length >= 3) checks.push({ id: "internal-links", label: "Internal Linking", category: "off-page", status: "pass", detail: `${internalLinks.length} internal links found.` });
  else if (internalLinks.length > 0) { checks.push({ id: "internal-links", label: "Internal Linking", category: "off-page", status: "warn", detail: `Only ${internalLinks.length} internal links.` }); recommendations.push({ priority: "medium", title: "Increase Internal Links", detail: `Only ${internalLinks.length} internal links found.` }); }
  else { checks.push({ id: "internal-links", label: "Internal Linking", category: "off-page", status: "fail", detail: "No internal links found." }); recommendations.push({ priority: "high", title: "Add Internal Links", detail: "No internal links found. Add links to related pages." }); }

  if (externalLinks.length > 0) checks.push({ id: "external-links", label: "External Links", category: "off-page", status: "pass", detail: `${externalLinks.length} external links found.` });
  else checks.push({ id: "external-links", label: "External Links", category: "off-page", status: "info", detail: "No external links." });

  checks.push({ id: "dofollow-links", label: "Dofollow Links", category: "off-page", status: "info", detail: `${dofollowLinks.length} dofollow links.` });
  checks.push({ id: "nofollow-links", label: "Nofollow Links", category: "off-page", status: "info", detail: `${nofollowLinks.length} nofollow links.` });

  const linkTexts = bodyLinks.map((l) => l.text.toLowerCase()).filter(Boolean);
  const genericTexts = linkTexts.filter((t) => ["click here", "read more", "learn more", "here", "more"].includes(t));
  if (linkTexts.length > 0 && genericTexts.length / linkTexts.length < 0.3) checks.push({ id: "anchor-text", label: "Anchor Text Quality", category: "off-page", status: "pass", detail: "Descriptive anchor text used." });
  else if (genericTexts.length > 0) { checks.push({ id: "anchor-text", label: "Anchor Text Quality", category: "off-page", status: "warn", detail: `${genericTexts.length} generic anchor texts.` }); recommendations.push({ priority: "low", title: "Improve Anchor Text", detail: `${genericTexts.length} generic anchor texts found.` }); }

  // ===== TECHNICAL CHECKS =====
  if (parsed.protocol === "https:") checks.push({ id: "https", label: "HTTPS", category: "technical", status: "pass", detail: "Page served over HTTPS." });
  else { checks.push({ id: "https", label: "HTTPS", category: "technical", status: "fail", detail: "Page not served over HTTPS." }); recommendations.push({ priority: "high", title: "Enable HTTPS", detail: "Page is not served over HTTPS. Install an SSL certificate." }); }

  if (pageOk) checks.push({ id: "status", label: "HTTP Status", category: "technical", status: "pass", detail: `Returned ${pageStatus} OK.` });
  else checks.push({ id: "status", label: "HTTP Status", category: "technical", status: "fail", detail: `Returned status ${pageStatus}.` });

  if (viewport) checks.push({ id: "viewport", label: "Mobile Viewport", category: "technical", status: "pass", detail: "Viewport meta tag present." });
  else { checks.push({ id: "viewport", label: "Mobile Viewport", category: "technical", status: "fail", detail: "Missing viewport meta tag." }); recommendations.push({ priority: "high", title: "Add Viewport Meta Tag", detail: "No viewport meta tag found." }); }

  if (charset) checks.push({ id: "charset", label: "Character Encoding", category: "technical", status: "pass", detail: `Charset: ${charset}` });
  else checks.push({ id: "charset", label: "Character Encoding", category: "technical", status: "warn", detail: "No charset declaration." });

  if (robotsContent) checks.push({ id: "robots-txt", label: "robots.txt", category: "technical", status: "pass", detail: "robots.txt file found." });
  else { checks.push({ id: "robots-txt", label: "robots.txt", category: "technical", status: "warn", detail: "No robots.txt found." }); recommendations.push({ priority: "medium", title: "Add robots.txt", detail: "No robots.txt file found." }); }

  if (sitemapContent) checks.push({ id: "sitemap", label: "Sitemap", category: "technical", status: "pass", detail: `Sitemap found at ${sitemapUrl}` });
  else { checks.push({ id: "sitemap", label: "Sitemap", category: "technical", status: "warn", detail: "No sitemap found (checked sitemap.xml and sitemap_index.xml)." }); recommendations.push({ priority: "medium", title: "Add Sitemap", detail: "No sitemap found. Create an XML sitemap." }); }

  if (robotsContent && robotsContent.toLowerCase().includes("sitemap")) checks.push({ id: "sitemap-in-robots", label: "Sitemap in robots.txt", category: "technical", status: "pass", detail: "Sitemap URL declared in robots.txt." });
  else if (robotsContent) checks.push({ id: "sitemap-in-robots", label: "Sitemap in robots.txt", category: "technical", status: "warn", detail: "robots.txt does not reference a sitemap." });

  const securityHeaders = ["strict-transport-security", "x-content-type-options", "x-frame-options", "content-security-policy"];
  const foundSecurity = securityHeaders.filter((h) => pageHeaders[h]);
  if (foundSecurity.length >= 3) checks.push({ id: "security-headers", label: "Security Headers", category: "technical", status: "pass", detail: `${foundSecurity.length}/4 security headers present.` });
  else if (foundSecurity.length > 0) checks.push({ id: "security-headers", label: "Security Headers", category: "technical", status: "warn", detail: `${foundSecurity.length}/4 present. Missing: ${securityHeaders.filter((h) => !pageHeaders[h]).join(", ")}` });
  else checks.push({ id: "security-headers", label: "Security Headers", category: "technical", status: "warn", detail: "No security headers detected." });

  if (pageHeaders["content-encoding"] && ["gzip", "br", "deflate"].includes(pageHeaders["content-encoding"])) checks.push({ id: "compression", label: "Content Compression", category: "technical", status: "pass", detail: `Compressed with ${pageHeaders["content-encoding"]}.` });
  else { checks.push({ id: "compression", label: "Content Compression", category: "technical", status: "warn", detail: "No content encoding detected." }); recommendations.push({ priority: "low", title: "Enable Compression", detail: "No gzip/brotli compression detected." }); }

  const htmlLang = doc.documentElement.getAttribute("lang");
  if (htmlLang) checks.push({ id: "html-lang", label: "HTML Language", category: "technical", status: "pass", detail: `Language: ${htmlLang}` });
  else checks.push({ id: "html-lang", label: "HTML Language", category: "technical", status: "warn", detail: "No lang attribute on <html>." });

  if (schemaTypes.length > 0) {
    const types = [...new Set(schemaTypes.map((s) => s.type))].join(", ");
    checks.push({ id: "structured-data", label: "Structured Data (Schema)", category: "technical", status: "pass", detail: `${schemaTypes.length} schema(s) found: ${types}`, value: schemaTypes.map((s) => `${s.type} (${s.source})`).join("\n") });
  } else { checks.push({ id: "structured-data", label: "Structured Data (Schema)", category: "technical", status: "warn", detail: "No structured data found." }); recommendations.push({ priority: "medium", title: "Add Structured Data", detail: "No Schema.org structured data found. Add JSON-LD." }); }

  const favicon = doc.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
  if (favicon) checks.push({ id: "favicon", label: "Favicon", category: "technical", status: "pass", detail: "Favicon declared." });
  else checks.push({ id: "favicon", label: "Favicon", category: "technical", status: "info", detail: "No favicon link tag found." });

  if (responseTimeMs < 500) checks.push({ id: "response-time", label: "Server Response Time", category: "technical", status: "pass", detail: `${responseTimeMs}ms. Excellent.` });
  else if (responseTimeMs < 1000) checks.push({ id: "response-time", label: "Server Response Time", category: "technical", status: "warn", detail: `${responseTimeMs}ms. Aim for under 500ms.` });
  else { checks.push({ id: "response-time", label: "Server Response Time", category: "technical", status: "fail", detail: `${responseTimeMs}ms. Slow.` }); recommendations.push({ priority: "high", title: "Improve Server Response Time", detail: `Server responded in ${responseTimeMs}ms. Aim for under 500ms.` }); }

  if (htmlSizeBytes < 100000) checks.push({ id: "html-size", label: "HTML Page Size", category: "technical", status: "pass", detail: `${(htmlSizeBytes / 1024).toFixed(1)}KB. Good.` });
  else if (htmlSizeBytes < 200000) checks.push({ id: "html-size", label: "HTML Page Size", category: "technical", status: "warn", detail: `${(htmlSizeBytes / 1024).toFixed(1)}KB. Consider minifying.` });
  else checks.push({ id: "html-size", label: "HTML Page Size", category: "technical", status: "fail", detail: `${(htmlSizeBytes / 1024).toFixed(1)}KB. Large.` });

  // ===== ACCESSIBILITY CHECKS =====
  // Accessible names for buttons, links, menu items
  const buttonsWithoutAriaLabel = Array.from(doc.querySelectorAll("button")).filter((b) => {
    const text = b.textContent?.trim() || "";
    const ariaLabel = b.getAttribute("aria-label") || "";
    const title = b.getAttribute("title") || "";
    return !text && !ariaLabel && !title;
  });
  if (buttonsWithoutAriaLabel.length === 0) checks.push({ id: "a11y-button-names", label: "Button Accessible Names", category: "accessibility", status: "pass", detail: "All buttons have accessible names." });
  else { checks.push({ id: "a11y-button-names", label: "Button Accessible Names", category: "accessibility", status: "warn", detail: `${buttonsWithoutAriaLabel.length} buttons lack accessible names (text, aria-label, or title).` }); recommendations.push({ priority: "medium", title: "Add Button Accessible Names", detail: `${buttonsWithoutAriaLabel.length} buttons have no text, aria-label, or title.` }); }

  // Links have descriptive text
  const linksWithoutText = bodyLinks.filter((l) => !l.text || l.text.length < 2);
  if (linksWithoutText.length === 0) checks.push({ id: "a11y-link-text", label: "Link Descriptive Text", category: "accessibility", status: "pass", detail: "All links have descriptive text." });
  else { checks.push({ id: "a11y-link-text", label: "Link Descriptive Text", category: "accessibility", status: "warn", detail: `${linksWithoutText.length} links lack descriptive text.` }); recommendations.push({ priority: "medium", title: "Add Link Text", detail: `${linksWithoutText.length} links have no or very short text.` }); }

  // ARIA attributes and roles
  const ariaElements = doc.querySelectorAll("[role], [aria-label], [aria-labelledby], [aria-describedby]");
  const invalidAriaRoles = Array.from(doc.querySelectorAll("[role]")).filter((el) => {
    const role = el.getAttribute("role") || "";
    const validRoles = ["alert","alertdialog","application","article","banner","button","cell","checkbox","columnheader","combobox","complementary","contentinfo","dialog","directory","document","feed","figure","form","grid","gridcell","group","heading","img","link","list","listbox","listitem","log","main","marquee","math","menu","menubar","menuitem","menuitemcheckbox","menuitemradio","navigation","none","note","option","presentation","progressbar","radio","radiogroup","region","row","rowgroup","rowheader","scrollbar","search","searchbox","separator","slider","spinbutton","status","switch","tab","tablist","tabpanel","textbox","timer","toolbar","tooltip","tree","treegrid","treeitem","navigation","main","banner","contentinfo","complementary","form"];
    return !validRoles.includes(role.toLowerCase());
  });
  if (invalidAriaRoles.length === 0) checks.push({ id: "a11y-aria", label: "ARIA Roles & Attributes", category: "accessibility", status: "pass", detail: `${ariaElements.length} ARIA elements, all roles valid.` });
  else { checks.push({ id: "a11y-aria", label: "ARIA Roles & Attributes", category: "accessibility", status: "warn", detail: `${invalidAriaRoles.length} elements with invalid ARIA roles.` }); recommendations.push({ priority: "medium", title: "Fix Invalid ARIA Roles", detail: `${invalidAriaRoles.length} elements use invalid ARIA roles.` }); }

  // Form field labels
  const inputs = Array.from(doc.querySelectorAll("input, select, textarea"));
  const inputsMissingLabel = inputs.filter((input) => {
    const id = input.getAttribute("id") || "";
    const ariaLabel = input.getAttribute("aria-label") || "";
    const ariaLabelledBy = input.getAttribute("aria-labelledby") || "";
    if (ariaLabel || ariaLabelledBy) return false;
    if (id && doc.querySelector(`label[for="${id}"]`)) return false;
    const parent = input.parentElement;
    if (parent && parent.tagName.toLowerCase() === "label") return false;
    return true;
  });
  if (inputs.length === 0) checks.push({ id: "a11y-form-labels", label: "Form Field Labels", category: "accessibility", status: "info", detail: "No form fields found." });
  else if (inputsMissingLabel.length === 0) checks.push({ id: "a11y-form-labels", label: "Form Field Labels", category: "accessibility", status: "pass", detail: `All ${inputs.length} form fields have labels.` });
  else { checks.push({ id: "a11y-form-labels", label: "Form Field Labels", category: "accessibility", status: "fail", detail: `${inputsMissingLabel.length} of ${inputs.length} form fields lack labels.` }); recommendations.push({ priority: "high", title: "Add Form Labels", detail: `${inputsMissingLabel.length} form fields lack associated labels.` }); }

  // Heading structure/order
  const headingLevels = headings.map((h) => h.level);
  let headingOrderOk = true;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] > headingLevels[i - 1] + 1) { headingOrderOk = false; break; }
  }
  if (headingOrderOk && h1s.length === 1) checks.push({ id: "a11y-heading-structure", label: "Heading Structure", category: "accessibility", status: "pass", detail: "Logical heading order with single H1." });
  else { checks.push({ id: "a11y-heading-structure", label: "Heading Structure", category: "accessibility", status: "warn", detail: headingOrderOk ? `${h1s.length} H1 tags found.` : "Heading levels skip (e.g., H2 to H4)." }); recommendations.push({ priority: "medium", title: "Fix Heading Structure", detail: "Ensure headings follow logical order without skipping levels." }); }

  // Image alt attributes (accessibility-specific)
  if (imgs.length === 0) checks.push({ id: "a11y-img-alt", label: "Image Alt Attributes", category: "accessibility", status: "info", detail: "No images found." });
  else if (imagesWithoutAlt.length === 0) checks.push({ id: "a11y-img-alt", label: "Image Alt Attributes", category: "accessibility", status: "pass", detail: `All ${imgs.length} images have alt text.` });
  else { checks.push({ id: "a11y-img-alt", label: "Image Alt Attributes", category: "accessibility", status: "fail", detail: `${imagesWithoutAlt.length} of ${imgs.length} images missing alt text.` }); recommendations.push({ priority: "high", title: "Add Image Alt Text", detail: `${imagesWithoutAlt.length} images missing alt attributes for accessibility.` }); }

  // HTML lang attribute
  if (htmlLang) checks.push({ id: "a11y-html-lang", label: "HTML Lang Attribute", category: "accessibility", status: "pass", detail: `Language declared: ${htmlLang}` });
  else { checks.push({ id: "a11y-html-lang", label: "HTML Lang Attribute", category: "accessibility", status: "fail", detail: "No lang attribute on <html> element." }); recommendations.push({ priority: "high", title: "Add HTML lang Attribute", detail: "Screen readers need the lang attribute to pronounce content correctly." }); }

  // Main landmark
  const mainLandmark = doc.querySelector("main, [role='main']");
  if (mainLandmark) checks.push({ id: "a11y-main-landmark", label: "Main Landmark", category: "accessibility", status: "pass", detail: "Main landmark found." });
  else { checks.push({ id: "a11y-main-landmark", label: "Main Landmark", category: "accessibility", status: "warn", detail: "No <main> element or role='main' found." }); recommendations.push({ priority: "medium", title: "Add Main Landmark", detail: "Add a <main> element so screen readers can skip to main content." }); }

  // Skip link
  const skipLink = doc.querySelector("a[href^='#main'], a[href^='#content'], a.skip-link, a[class*='skip']");
  if (skipLink) checks.push({ id: "a11y-skip-link", label: "Skip Link", category: "accessibility", status: "pass", detail: "Skip-to-content link found." });
  else { checks.push({ id: "a11y-skip-link", label: "Skip Link", category: "accessibility", status: "warn", detail: "No skip-to-content link found." }); recommendations.push({ priority: "low", title: "Add Skip Link", detail: "Add a skip-to-main-content link for keyboard navigation." }); }

  // Tabindex check (avoid positive tabindex)
  const positiveTabindex = doc.querySelectorAll("[tabindex]:not([tabindex='0']):not([tabindex='-1'])");
  if (positiveTabindex.length === 0) checks.push({ id: "a11y-tabindex", label: "Tab Order", category: "accessibility", status: "pass", detail: "No positive tabindex values found." });
  else { checks.push({ id: "a11y-tabindex", label: "Tab Order", category: "accessibility", status: "warn", detail: `${positiveTabindex.length} elements with positive tabindex (disrupts natural tab order).` }); recommendations.push({ priority: "low", title: "Fix Tab Order", detail: `${positiveTabindex.length} elements use positive tabindex which disrupts natural keyboard navigation.` }); }

  // Table accessibility
  const tables = doc.querySelectorAll("table");
  const tablesMissingCaption = Array.from(tables).filter((t) => !t.querySelector("caption"));
  if (tables.length === 0) checks.push({ id: "a11y-tables", label: "Table Accessibility", category: "accessibility", status: "info", detail: "No tables found." });
  else if (tablesMissingCaption.length === 0) checks.push({ id: "a11y-tables", label: "Table Accessibility", category: "accessibility", status: "pass", detail: `All ${tables.length} tables have captions.` });
  else { checks.push({ id: "a11y-tables", label: "Table Accessibility", category: "accessibility", status: "warn", detail: `${tablesMissingCaption.length} of ${tables.length} tables missing <caption>.` }); }

  // ARIA IDs - check for duplicate aria IDs
  const allAriaIds = Array.from(doc.querySelectorAll("[id]")).map((el) => el.getAttribute("id") || "").filter(Boolean);
  const duplicateIds = allAriaIds.filter((id, i) => allAriaIds.indexOf(id) !== i);
  if (duplicateIds.length === 0) checks.push({ id: "a11y-aria-ids", label: "ARIA IDs & Values", category: "accessibility", status: "pass", detail: "No duplicate element IDs found." });
  else { checks.push({ id: "a11y-aria-ids", label: "ARIA IDs & Values", category: "accessibility", status: "warn", detail: `${duplicateIds.length} duplicate IDs found: ${[...new Set(duplicateIds)].slice(0, 5).join(", ")}.` }); recommendations.push({ priority: "medium", title: "Fix Duplicate IDs", detail: `${duplicateIds.length} duplicate element IDs. ARIA references break with duplicate IDs.` }); }

  // Colour contrast - check for inline style with low contrast (basic heuristic)
  const inlineStyledElements = Array.from(doc.querySelectorAll("[style*='color']"));
  let lowContrastCount = 0;
  for (const el of inlineStyledElements) {
    const style = el.getAttribute("style") || "";
    const colorMatch = style.match(/color:\s*(#[0-9a-fA-F]{3,6}|[a-z]+)/);
    const bgColorMatch = style.match(/background[^:]*:\s*(#[0-9a-fA-F]{3,6}|[a-z]+)/);
    if (colorMatch && bgColorMatch) {
      const fg = colorMatch[1].toLowerCase();
      if (fg === "#ccc" || fg === "#ddd" || fg === "#eee" || fg === "lightgray" || fg === "lightgrey") lowContrastCount++;
    }
  }
  if (lowContrastCount === 0) checks.push({ id: "a11y-contrast", label: "Colour Contrast", category: "accessibility", status: "pass", detail: "No obvious low-contrast inline styles detected." });
  else { checks.push({ id: "a11y-contrast", label: "Colour Contrast", category: "accessibility", status: "warn", detail: `${lowContrastCount} elements with potentially low contrast.` }); recommendations.push({ priority: "medium", title: "Fix Colour Contrast", detail: `${lowContrastCount} elements may have insufficient contrast. Ensure 4.5:1 for normal text.` }); }

  // Touch target size - check for small interactive elements
  const interactiveElements = Array.from(doc.querySelectorAll("button, a, input[type='submit'], input[type='button'], input[type='checkbox'], input[type='radio']"));
  const smallTouchTargets = interactiveElements.filter((el) => {
    const style = el.getAttribute("style") || "";
    const wMatch = style.match(/width:\s*(\d+)px/);
    const hMatch = style.match(/height:\s*(\d+)px/);
    if (wMatch && parseInt(wMatch[1]) < 24) return true;
    if (hMatch && parseInt(hMatch[1]) < 24) return true;
    return false;
  });
  if (smallTouchTargets.length === 0) checks.push({ id: "a11y-touch-target", label: "Touch Target Size", category: "accessibility", status: "pass", detail: "No undersized touch targets detected." });
  else { checks.push({ id: "a11y-touch-target", label: "Touch Target Size", category: "accessibility", status: "warn", detail: `${smallTouchTargets.length} interactive elements smaller than 24px.` }); recommendations.push({ priority: "low", title: "Increase Touch Target Size", detail: `${smallTouchTargets.length} elements are too small for touch. Minimum 24x24px recommended.` }); }

  // Video captions
  const videos = doc.querySelectorAll("video");
  const videosMissingCaptions = Array.from(videos).filter((v) => !v.querySelector("track[kind='captions'], track[kind='subtitles']"));
  if (videos.length === 0) checks.push({ id: "a11y-video-captions", label: "Video Captions", category: "accessibility", status: "info", detail: "No videos found." });
  else if (videosMissingCaptions.length === 0) checks.push({ id: "a11y-video-captions", label: "Video Captions", category: "accessibility", status: "pass", detail: `All ${videos.length} videos have caption tracks.` });
  else { checks.push({ id: "a11y-video-captions", label: "Video Captions", category: "accessibility", status: "warn", detail: `${videosMissingCaptions.length} of ${videos.length} videos missing <track> captions.` }); recommendations.push({ priority: "medium", title: "Add Video Captions", detail: `${videosMissingCaptions.length} videos lack caption tracks for accessibility.` }); }

  // DOM/visual order - check for CSS that reorders content
  const reorderCss = pageHtml.match(/(order:\s*-?\d|flex-direction:\s*row-reverse|flex-direction:\s*column-reverse|direction:\s*rtl|float:\s*right)/gi);
  if (!reorderCss || reorderCss.length === 0) checks.push({ id: "a11y-dom-order", label: "DOM/Visual Order", category: "accessibility", status: "pass", detail: "No CSS reordering detected. DOM order matches visual order." });
  else checks.push({ id: "a11y-dom-order", label: "DOM/Visual Order", category: "accessibility", status: "info", detail: `${reorderCss.length} CSS properties may affect visual order vs DOM order.` });

  // Interactive controls - check for elements with onclick but no proper role
  const onclickElements = Array.from(doc.querySelectorAll("[onclick]:not(button):not(a):not(input):not(select):not(textarea)"));
  if (onclickElements.length === 0) checks.push({ id: "a11y-interactive", label: "Interactive Controls", category: "accessibility", status: "pass", detail: "No non-semantic interactive elements found." });
  else { checks.push({ id: "a11y-interactive", label: "Interactive Controls", category: "accessibility", status: "warn", detail: `${onclickElements.length} elements with onclick but no semantic role.` }); recommendations.push({ priority: "medium", title: "Fix Interactive Controls", detail: `${onclickElements.length} elements use onclick without proper semantic roles. Use <button> or add role and tabindex.` }); }

  // Custom control labels and ARIA roles
  const customControls = Array.from(doc.querySelectorAll("[role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='tab'], [role='slider'], [role='switch'], [role='spinbutton']"));
  const customControlsMissingLabel = customControls.filter((el) => {
    return !el.textContent?.trim() && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.getAttribute("title");
  });
  if (customControls.length === 0) checks.push({ id: "a11y-custom-controls", label: "Custom Control Labels", category: "accessibility", status: "info", detail: "No custom ARIA controls found." });
  else if (customControlsMissingLabel.length === 0) checks.push({ id: "a11y-custom-controls", label: "Custom Control Labels", category: "accessibility", status: "pass", detail: `All ${customControls.length} custom controls have accessible names.` });
  else { checks.push({ id: "a11y-custom-controls", label: "Custom Control Labels", category: "accessibility", status: "warn", detail: `${customControlsMissingLabel.length} of ${customControls.length} custom controls lack labels.` }); recommendations.push({ priority: "medium", title: "Label Custom Controls", detail: `${customControlsMissingLabel.length} ARIA controls lack accessible names.` }); }

  // ===== BEST PRACTICES CHECKS =====
  // HTTPS redirect
  if (parsed.protocol === "https:") {
    checks.push({ id: "bp-https-redirect", label: "HTTP to HTTPS Redirect", category: "best-practices", status: "pass", detail: "Page is served over HTTPS." });
  } else { checks.push({ id: "bp-https-redirect", label: "HTTP to HTTPS Redirect", category: "best-practices", status: "fail", detail: "Page is not served over HTTPS." }); recommendations.push({ priority: "high", title: "Redirect HTTP to HTTPS", detail: "Ensure all HTTP traffic redirects to HTTPS." }); }

  // HSTS
  if (pageHeaders["strict-transport-security"]) checks.push({ id: "bp-hsts", label: "HSTS", category: "best-practices", status: "pass", detail: "Strict-Transport-Security header present." });
  else { checks.push({ id: "bp-hsts", label: "HSTS", category: "best-practices", status: "warn", detail: "No HSTS header. Browsers may allow downgrade attacks." }); recommendations.push({ priority: "medium", title: "Add HSTS Header", detail: "Add Strict-Transport-Security to prevent protocol downgrade attacks." }); }

  // CSP against XSS
  if (pageHeaders["content-security-policy"]) checks.push({ id: "bp-csp", label: "CSP (XSS Protection)", category: "best-practices", status: "pass", detail: "Content-Security-Policy header present." });
  else { checks.push({ id: "bp-csp", label: "CSP (XSS Protection)", category: "best-practices", status: "warn", detail: "No Content-Security-Policy header." }); recommendations.push({ priority: "medium", title: "Add CSP Header", detail: "Content-Security-Policy prevents XSS and data injection attacks." }); }

  // Clickjacking protection (X-Frame-Options or CSP frame-ancestors)
  const hasFrameProtection = pageHeaders["x-frame-options"] || (pageHeaders["content-security-policy"] && pageHeaders["content-security-policy"].includes("frame-ancestors"));
  if (hasFrameProtection) checks.push({ id: "bp-clickjacking", label: "Clickjacking Protection", category: "best-practices", status: "pass", detail: "X-Frame-Options or CSP frame-ancestors detected." });
  else { checks.push({ id: "bp-clickjacking", label: "Clickjacking Protection", category: "best-practices", status: "warn", detail: "No clickjacking protection header." }); recommendations.push({ priority: "medium", title: "Add Clickjacking Protection", detail: "Add X-Frame-Options or CSP frame-ancestors to prevent clickjacking." }); }

  // COOP
  if (pageHeaders["cross-origin-opener-policy"]) checks.push({ id: "bp-coop", label: "COOP (Origin Isolation)", category: "best-practices", status: "pass", detail: "Cross-Origin-Opener-Policy header present." });
  else checks.push({ id: "bp-coop", label: "COOP (Origin Isolation)", category: "best-practices", status: "info", detail: "No Cross-Origin-Opener-Policy header." });

  // X-Content-Type-Options
  if (pageHeaders["x-content-type-options"]) checks.push({ id: "bp-content-type", label: "X-Content-Type-Options", category: "best-practices", status: "pass", detail: "X-Content-Type-Options: nosniff detected." });
  else { checks.push({ id: "bp-content-type", label: "X-Content-Type-Options", category: "best-practices", status: "warn", detail: "No X-Content-Type-Options header." }); recommendations.push({ priority: "low", title: "Add X-Content-Type-Options", detail: "Add X-Content-Type-Options: nosniff to prevent MIME sniffing." }); }

  // HTML doctype
  const hasDoctype = /<!doctype\s+html/i.test(pageHtml.slice(0, 500));
  if (hasDoctype) checks.push({ id: "bp-doctype", label: "HTML Doctype", category: "best-practices", status: "pass", detail: "<!DOCTYPE html> declared." });
  else { checks.push({ id: "bp-doctype", label: "HTML Doctype", category: "best-practices", status: "warn", detail: "No HTML5 doctype found." }); recommendations.push({ priority: "medium", title: "Add HTML5 Doctype", detail: "Add <!DOCTYPE html> to trigger standards mode." }); }

  // Charset (best practices)
  if (charset) checks.push({ id: "bp-charset", label: "Charset Declaration", category: "best-practices", status: "pass", detail: `Charset declared: ${charset}` });
  else { checks.push({ id: "bp-charset", label: "Charset Declaration", category: "best-practices", status: "warn", detail: "No charset declaration found." }); recommendations.push({ priority: "low", title: "Add Charset Declaration", detail: "Add a charset meta tag to prevent rendering issues." }); }

  // Deprecated HTML APIs
  const deprecatedAttrs = pageHtml.match(/\s(applet|marquee|dir|frame|frameset|noframes)\b/gi);
  if (!deprecatedAttrs || deprecatedAttrs.length === 0) checks.push({ id: "bp-deprecated", label: "Deprecated APIs", category: "best-practices", status: "pass", detail: "No deprecated HTML elements detected." });
  else { checks.push({ id: "bp-deprecated", label: "Deprecated APIs", category: "best-practices", status: "warn", detail: `${deprecatedAttrs.length} deprecated HTML elements found.` }); recommendations.push({ priority: "low", title: "Remove Deprecated Elements", detail: "Deprecated HTML elements like <applet>, <marquee>, <frame> found." }); }

  // Image aspect ratio
  const imgsWithoutDims = imgs.filter((i) => i.src && (!i.width || !i.height));
  if (imgs.length === 0) checks.push({ id: "bp-img-aspect-ratio", label: "Image Aspect Ratio", category: "best-practices", status: "info", detail: "No images found." });
  else if (imgsWithoutDims.length === 0) checks.push({ id: "bp-img-aspect-ratio", label: "Image Aspect Ratio", category: "best-practices", status: "pass", detail: "All images have width and height attributes." });
  else { checks.push({ id: "bp-img-aspect-ratio", label: "Image Aspect Ratio", category: "best-practices", status: "warn", detail: `${imgsWithoutDims.length} of ${imgs.length} images missing width/height (causes CLS).` }); recommendations.push({ priority: "medium", title: "Add Image Dimensions", detail: `${imgsWithoutDims.length} images lack width/height attributes, causing layout shifts.` }); }

  // Geolocation permission - check for geolocation API usage
  const usesGeolocation = /navigator\.geolocation/i.test(pageHtml);
  if (!usesGeolocation) checks.push({ id: "bp-geolocation", label: "Geolocation Permission", category: "best-practices", status: "pass", detail: "No geolocation API usage detected." });
  else checks.push({ id: "bp-geolocation", label: "Geolocation Permission", category: "best-practices", status: "info", detail: "Page uses geolocation API. Ensure permission is requested on user action." });

  // Notification permission
  const usesNotifications = /Notification\.requestPermission|new\s+Notification/i.test(pageHtml);
  if (!usesNotifications) checks.push({ id: "bp-notifications", label: "Notification Permission", category: "best-practices", status: "pass", detail: "No notification API usage detected." });
  else checks.push({ id: "bp-notifications", label: "Notification Permission", category: "best-practices", status: "info", detail: "Page uses notification API. Ensure permission is requested on user action." });

  // Trusted Types
  const usesTrustedTypes = /trustedTypes|require-trusted-types-for/i.test(pageHtml);
  if (usesTrustedTypes) checks.push({ id: "bp-trusted-types", label: "Trusted Types", category: "best-practices", status: "pass", detail: "Trusted Types policy detected." });
  else checks.push({ id: "bp-trusted-types", label: "Trusted Types", category: "best-practices", status: "info", detail: "No Trusted Types policy. Consider adding for XSS prevention." });

  // Ability to paste into input fields
  const pasteBlocked = /onpaste\s*=\s*["']?return\s+false|preventDefault\(\)[^}]*paste/i.test(pageHtml);
  if (!pasteBlocked) checks.push({ id: "bp-paste", label: "Paste Into Input Fields", category: "best-practices", status: "pass", detail: "No paste-blocking detected." });
  else { checks.push({ id: "bp-paste", label: "Paste Into Input Fields", category: "best-practices", status: "warn", detail: "Paste appears to be blocked on some inputs." }); recommendations.push({ priority: "low", title: "Allow Paste in Input Fields", detail: "Blocking paste harms usability and password manager integration." }); }

  // Image resolution - check for very large image sources (heuristic)
  const largeImageSrcs = imgs.filter((i) => {
    const w = parseInt(i.width) || 0;
    const h = parseInt(i.height) || 0;
    return w > 0 && h > 0 && w * h > 2000000;
  });
  if (imgs.length === 0) checks.push({ id: "bp-img-resolution", label: "Image Resolution", category: "best-practices", status: "info", detail: "No images found." });
  else if (largeImageSrcs.length === 0) checks.push({ id: "bp-img-resolution", label: "Image Resolution", category: "best-practices", status: "pass", detail: "No oversized images detected." });
  else { checks.push({ id: "bp-img-resolution", label: "Image Resolution", category: "best-practices", status: "warn", detail: `${largeImageSrcs.length} images may be oversized (>2MP).` }); recommendations.push({ priority: "low", title: "Optimize Image Resolution", detail: `${largeImageSrcs.length} images are very high resolution. Serve appropriately sized images.` }); }

  // Third-party cookies - check for Set-Cookie with SameSite=None
  const setCookieHeader = pageHeaders["set-cookie"] || "";
  if (setCookieHeader && /SameSite\s*=\s*None/i.test(setCookieHeader)) {
    checks.push({ id: "bp-third-party-cookies", label: "Third-Party Cookies", category: "best-practices", status: "warn", detail: "Set-Cookie with SameSite=None detected (third-party cookie)." });
    recommendations.push({ priority: "low", title: "Avoid Third-Party Cookies", detail: "SameSite=None cookies are blocked by modern browsers." });
  } else checks.push({ id: "bp-third-party-cookies", label: "Third-Party Cookies", category: "best-practices", status: "pass", detail: "No third-party cookies detected." });

  // Source maps - check for sourceMappingURL in scripts
  const hasSourceMaps = /\/\/[#@]\s*sourceMappingURL/i.test(pageHtml);
  if (hasSourceMaps) checks.push({ id: "bp-source-maps", label: "Source Maps", category: "best-practices", status: "info", detail: "Source maps detected in production. Consider removing for performance." });
  else checks.push({ id: "bp-source-maps", label: "Source Maps", category: "best-practices", status: "pass", detail: "No source maps detected in production HTML." });

  // ===== PERFORMANCE CHECKS =====
  // DOM size
  const domElementCount = doc.querySelectorAll("*").length;
  if (domElementCount < 1500) checks.push({ id: "perf-dom-size", label: "DOM Size", category: "performance", status: "pass", detail: `${domElementCount} DOM elements. Good.` });
  else if (domElementCount < 3000) checks.push({ id: "perf-dom-size", label: "DOM Size", category: "performance", status: "warn", detail: `${domElementCount} DOM elements. Consider reducing.` });
  else { checks.push({ id: "perf-dom-size", label: "DOM Size", category: "performance", status: "fail", detail: `${domElementCount} DOM elements. Large DOM hurts performance.` }); recommendations.push({ priority: "medium", title: "Reduce DOM Size", detail: `${domElementCount} DOM elements. Aim for under 1500.` }); }

  // Render-blocking resources (scripts without defer/async in head)
  const headScripts = Array.from(doc.querySelectorAll("head script[src]")).filter((s) => {
    const defer = s.getAttribute("defer");
    const asyncAttr = s.getAttribute("async");
    return !defer && !asyncAttr;
  });
  if (headScripts.length === 0) checks.push({ id: "perf-render-blocking", label: "Render-Blocking Scripts", category: "performance", status: "pass", detail: "No render-blocking scripts in <head>." });
  else { checks.push({ id: "perf-render-blocking", label: "Render-Blocking Scripts", category: "performance", status: "warn", detail: `${headScripts.length} render-blocking scripts in <head>.` }); recommendations.push({ priority: "medium", title: "Defer Head Scripts", detail: `${headScripts.length} scripts in <head> lack defer/async, blocking render.` }); }

  // Total resources count
  const totalResources = scriptCount + stylesheetCount + imgCount;
  if (totalResources < 20) checks.push({ id: "perf-resources", label: "Total Resources", category: "performance", status: "pass", detail: `${totalResources} resources (scripts, styles, images).` });
  else if (totalResources < 50) checks.push({ id: "perf-resources", label: "Total Resources", category: "performance", status: "warn", detail: `${totalResources} resources. Consider reducing.` });
  else { checks.push({ id: "perf-resources", label: "Total Resources", category: "performance", status: "fail", detail: `${totalResources} resources. Too many requests.` }); recommendations.push({ priority: "medium", title: "Reduce Resource Count", detail: `${totalResources} resources loaded. Bundle and reduce requests.` }); }

  // Document request latency (server response time)
  if (responseTimeMs < 600) checks.push({ id: "perf-server-latency", label: "Server Response Time (TTFB)", category: "performance", status: "pass", detail: `${responseTimeMs}ms TTFB. Good.` });
  else if (responseTimeMs < 1500) checks.push({ id: "perf-server-latency", label: "Server Response Time (TTFB)", category: "performance", status: "warn", detail: `${responseTimeMs}ms TTFB. Aim for under 600ms.` });
  else { checks.push({ id: "perf-server-latency", label: "Server Response Time (TTFB)", category: "performance", status: "fail", detail: `${responseTimeMs}ms TTFB. Slow.` }); recommendations.push({ priority: "high", title: "Improve TTFB", detail: `Server responded in ${responseTimeMs}ms. Aim for under 600ms.` }); }

  // Total network payload (HTML size as proxy)
  if (htmlSizeBytes < 50000) checks.push({ id: "perf-payload", label: "Network Payload", category: "performance", status: "pass", detail: `${(htmlSizeBytes / 1024).toFixed(1)}KB HTML payload.` });
  else if (htmlSizeBytes < 150000) checks.push({ id: "perf-payload", label: "Network Payload", category: "performance", status: "warn", detail: `${(htmlSizeBytes / 1024).toFixed(1)}KB HTML payload.` });
  else { checks.push({ id: "perf-payload", label: "Network Payload", category: "performance", status: "fail", detail: `${(htmlSizeBytes / 1024).toFixed(1)}KB HTML payload. Large.` }); recommendations.push({ priority: "medium", title: "Reduce Payload Size", detail: `HTML is ${(htmlSizeBytes / 1024).toFixed(0)}KB. Minify and reduce inline scripts.` }); }

  // Unused CSS (stylesheets count as proxy)
  if (stylesheetCount <= 3) checks.push({ id: "perf-css-count", label: "CSS Files", category: "performance", status: "pass", detail: `${stylesheetCount} stylesheets.` });
  else { checks.push({ id: "perf-css-count", label: "CSS Files", category: "performance", status: "warn", detail: `${stylesheetCount} stylesheets. Consider bundling.` }); recommendations.push({ priority: "low", title: "Reduce CSS Files", detail: `${stylesheetCount} stylesheets. Bundle to reduce requests.` }); }

  // JavaScript files
  if (scriptCount <= 5) checks.push({ id: "perf-js-count", label: "JavaScript Files", category: "performance", status: "pass", detail: `${scriptCount} scripts.` });
  else if (scriptCount <= 15) checks.push({ id: "perf-js-count", label: "JavaScript Files", category: "performance", status: "warn", detail: `${scriptCount} scripts. Consider bundling.` });
  else { checks.push({ id: "perf-js-count", label: "JavaScript Files", category: "performance", status: "fail", detail: `${scriptCount} scripts. Too many.` }); recommendations.push({ priority: "medium", title: "Reduce JavaScript Files", detail: `${scriptCount} scripts. Bundle and tree-shake.` }); }

  // Image delivery (count as proxy)
  if (imgCount <= 10) checks.push({ id: "perf-img-count", label: "Image Count", category: "performance", status: "pass", detail: `${imgCount} images.` });
  else if (imgCount <= 30) checks.push({ id: "perf-img-count", label: "Image Count", category: "performance", status: "warn", detail: `${imgCount} images. Consider lazy loading.` });
  else { checks.push({ id: "perf-img-count", label: "Image Count", category: "performance", status: "fail", detail: `${imgCount} images. Too many.` }); recommendations.push({ priority: "medium", title: "Optimize Images", detail: `${imgCount} images. Use lazy loading and modern formats.` }); }

  // Mobile viewport (performance)
  if (viewport) checks.push({ id: "perf-viewport", label: "Mobile Viewport", category: "performance", status: "pass", detail: "Viewport meta tag present." });
  else { checks.push({ id: "perf-viewport", label: "Mobile Viewport", category: "performance", status: "fail", detail: "Missing viewport meta tag." }); recommendations.push({ priority: "high", title: "Add Viewport Meta Tag", detail: "Without a viewport, mobile rendering is broken." }); }

  // Compression (performance)
  if (pageHeaders["content-encoding"] && ["gzip", "br", "deflate"].includes(pageHeaders["content-encoding"])) checks.push({ id: "perf-compression", label: "Content Compression", category: "performance", status: "pass", detail: `Compressed with ${pageHeaders["content-encoding"]}.` });
  else { checks.push({ id: "perf-compression", label: "Content Compression", category: "performance", status: "warn", detail: "No content encoding detected." }); recommendations.push({ priority: "medium", title: "Enable Compression", detail: "Enable gzip/brotli to reduce transfer size." }); }

  // Cache lifetime - check Cache-Control header
  const cacheControl = pageHeaders["cache-control"] || "";
  if (cacheControl) {
    if (/no-store|no-cache/i.test(cacheControl)) checks.push({ id: "perf-cache", label: "Cache Lifetime", category: "performance", status: "warn", detail: `Cache-Control: ${cacheControl}. Resources not cached.` });
    else if (/max-age=(\d+)/i.test(cacheControl)) {
      const maxAge = parseInt(cacheControl.match(/max-age=(\d+)/i)?.[1] || "0");
      if (maxAge >= 86400) checks.push({ id: "perf-cache", label: "Cache Lifetime", category: "performance", status: "pass", detail: `Cache-Control max-age: ${maxAge}s (${Math.round(maxAge / 3600)}h).` });
      else checks.push({ id: "perf-cache", label: "Cache Lifetime", category: "performance", status: "warn", detail: `Cache-Control max-age: ${maxAge}s. Consider longer cache.` });
    } else checks.push({ id: "perf-cache", label: "Cache Lifetime", category: "performance", status: "info", detail: `Cache-Control: ${cacheControl}` });
  } else { checks.push({ id: "perf-cache", label: "Cache Lifetime", category: "performance", status: "warn", detail: "No Cache-Control header." }); recommendations.push({ priority: "low", title: "Add Cache-Control Header", detail: "Set long cache lifetimes for static assets." }); }

  // Layout shifts - check for images without dimensions (CLS proxy)
  const clsRisk = imgs.filter((i) => i.src && (!i.width || !i.height)).length;
  if (clsRisk === 0) checks.push({ id: "perf-cls", label: "Cumulative Layout Shift", category: "performance", status: "pass", detail: "All images have dimensions. Low CLS risk." });
  else if (clsRisk <= 3) checks.push({ id: "perf-cls", label: "Cumulative Layout Shift", category: "performance", status: "warn", detail: `${clsRisk} images without dimensions. May cause layout shifts.` });
  else { checks.push({ id: "perf-cls", label: "Cumulative Layout Shift", category: "performance", status: "fail", detail: `${clsRisk} images without dimensions. High CLS risk.` }); recommendations.push({ priority: "medium", title: "Reduce CLS", detail: `${clsRisk} images lack dimensions, causing layout shifts.` }); }

  // Font display - check for font-display CSS
  const fontDisplayCss = pageHtml.match(/@font-face[^}]*font-display:\s*(swap|fallback|optional)/gi);
  const fontFaceCount = (pageHtml.match(/@font-face/gi) || []).length;
  if (fontFaceCount === 0) checks.push({ id: "perf-font-display", label: "Font Display", category: "performance", status: "info", detail: "No @font-face declarations found." });
  else if (fontDisplayCss && fontDisplayCss.length >= fontFaceCount) checks.push({ id: "perf-font-display", label: "Font Display", category: "performance", status: "pass", detail: `All ${fontFaceCount} @font-face rules use font-display.` });
  else { checks.push({ id: "perf-font-display", label: "Font Display", category: "performance", status: "warn", detail: `${fontFaceCount - (fontDisplayCss?.length || 0)} of ${fontFaceCount} @font-face rules missing font-display.` }); recommendations.push({ priority: "low", title: "Add font-display", detail: "Add font-display: swap to @font-face to prevent FOIT." }); }

  // Duplicated JavaScript - check for same script src loaded multiple times
  const scriptSrcs = Array.from(doc.querySelectorAll("script[src]")).map((s) => s.getAttribute("src") || "");
  const duplicateScripts = scriptSrcs.filter((src, i) => src && scriptSrcs.indexOf(src) !== i);
  if (duplicateScripts.length === 0) checks.push({ id: "perf-dup-js", label: "Duplicated JavaScript", category: "performance", status: "pass", detail: "No duplicate script sources found." });
  else { checks.push({ id: "perf-dup-js", label: "Duplicated JavaScript", category: "performance", status: "warn", detail: `${duplicateScripts.length} duplicate script sources.` }); recommendations.push({ priority: "low", title: "Remove Duplicate Scripts", detail: `${duplicateScripts.length} scripts loaded more than once.` }); }

  // Legacy JavaScript - check for IE-specific code
  const legacyJs = pageHtml.match(/<!--[^\]]*if\s+(?:gte\s+IE|IE\s)/gi);
  if (!legacyJs || legacyJs.length === 0) checks.push({ id: "perf-legacy-js", label: "Legacy JavaScript", category: "performance", status: "pass", detail: "No IE conditional comments detected." });
  else checks.push({ id: "perf-legacy-js", label: "Legacy JavaScript", category: "performance", status: "info", detail: `${legacyJs.length} IE conditional comments found. Modern browsers ignore these.` });

  // CSS minification - heuristic check
  const styleTags = Array.from(doc.querySelectorAll("style"));
  let unminifiedCss = 0;
  for (const tag of styleTags) {
    const css = tag.textContent || "";
    if (css.length > 200 && /\n\s{2,}/.test(css)) unminifiedCss++;
  }
  if (unminifiedCss === 0) checks.push({ id: "perf-css-min", label: "CSS Minification", category: "performance", status: "pass", detail: "Inline CSS appears minified." });
  else { checks.push({ id: "perf-css-min", label: "CSS Minification", category: "performance", status: "warn", detail: `${unminifiedCss} unminified <style> blocks.` }); recommendations.push({ priority: "low", title: "Minify CSS", detail: `${unminifiedCss} style blocks are not minified.` }); }

  // JavaScript minification - heuristic check
  const inlineScripts = Array.from(doc.querySelectorAll("script:not([src])"));
  let unminifiedJs = 0;
  for (const script of inlineScripts) {
    const js = script.textContent || "";
    if (js.length > 500 && /\n\s{2,}/.test(js)) unminifiedJs++;
  }
  if (unminifiedJs === 0) checks.push({ id: "perf-js-min", label: "JavaScript Minification", category: "performance", status: "pass", detail: "Inline JS appears minified." });
  else { checks.push({ id: "perf-js-min", label: "JavaScript Minification", category: "performance", status: "warn", detail: `${unminifiedJs} unminified inline <script> blocks.` }); recommendations.push({ priority: "low", title: "Minify JavaScript", detail: `${unminifiedJs} inline script blocks are not minified.` }); }

  // Unused CSS heuristic - check for very large inline style blocks
  const largeStyleBlocks = styleTags.filter((tag) => (tag.textContent || "").length > 50000);
  if (largeStyleBlocks.length === 0) checks.push({ id: "perf-unused-css", label: "Unused CSS", category: "performance", status: "pass", detail: "No excessively large inline CSS blocks." });
  else { checks.push({ id: "perf-unused-css", label: "Unused CSS", category: "performance", status: "warn", detail: `${largeStyleBlocks.length} inline style blocks >50KB. May contain unused CSS.` }); recommendations.push({ priority: "low", title: "Remove Unused CSS", detail: `${largeStyleBlocks.length} large style blocks may contain unused rules.` }); }

  // Unused JavaScript heuristic - check for very large inline scripts
  const largeScripts = inlineScripts.filter((script) => (script.textContent || "").length > 100000);
  if (largeScripts.length === 0) checks.push({ id: "perf-unused-js", label: "Unused JavaScript", category: "performance", status: "pass", detail: "No excessively large inline JS blocks." });
  else { checks.push({ id: "perf-unused-js", label: "Unused JavaScript", category: "performance", status: "warn", detail: `${largeScripts.length} inline script blocks >100KB. May contain unused code.` }); recommendations.push({ priority: "medium", title: "Remove Unused JavaScript", detail: `${largeScripts.length} large script blocks may contain dead code.` }); }

  // Image width/height (performance-specific)
  if (imgs.length === 0) checks.push({ id: "perf-img-dims", label: "Image Width/Height", category: "performance", status: "info", detail: "No images found." });
  else if (imgsWithoutDims.length === 0) checks.push({ id: "perf-img-dims", label: "Image Width/Height", category: "performance", status: "pass", detail: `All ${imgs.length} images have width and height.` });
  else { checks.push({ id: "perf-img-dims", label: "Image Width/Height", category: "performance", status: "warn", detail: `${imgsWithoutDims.length} of ${imgs.length} images missing width/height.` }); recommendations.push({ priority: "medium", title: "Add Image Dimensions", detail: `${imgsWithoutDims.length} images lack width/height, causing browser layout recalculations.` }); }

  // Redirects - check if the final URL differs from requested
  // (We can't fully detect redirects in this context, but we check for meta refresh)
  const metaRefresh = doc.querySelector('meta[http-equiv="refresh"]');
  if (metaRefresh) { checks.push({ id: "perf-redirects", label: "Redirects", category: "performance", status: "warn", detail: "Meta refresh redirect detected. Use 301 redirects instead." }); recommendations.push({ priority: "low", title: "Use 301 Redirects", detail: "Meta refresh redirects are slow. Use server-side 301 redirects." }); }
  else checks.push({ id: "perf-redirects", label: "Redirects", category: "performance", status: "pass", detail: "No meta refresh redirects detected." });

  const linkAnalysis: LinkAnalysis = {
    internal: internalLinks.map((l) => ({ href: l.href, text: l.text, rel: l.rel })),
    external: externalLinks.map((l) => ({ href: l.href, text: l.text, rel: l.rel })),
    dofollow: dofollowLinks.map((l) => ({ href: l.href, text: l.text })),
    nofollow: nofollowLinks.map((l) => ({ href: l.href, text: l.text })),
    total: links.length,
  };

  // ===== NEW: Noindex detection =====
  const noindexInfo = detectNoindex(doc, pageHeaders);
  if (!noindexInfo.indexable) {
    checks.push({ id: "noindex", label: "Indexability", category: "technical", status: "fail", detail: noindexInfo.detail });
    recommendations.push({ priority: "high", title: "Remove noindex directive", detail: noindexInfo.detail });
  } else {
    checks.push({ id: "noindex", label: "Indexability", category: "technical", status: "pass", detail: "Page is indexable." });
  }

  // ===== NEW: Google property detection =====
  const googleProps = detectGoogleProperties(pageHtml);

  // ===== NEW: Internal link status checking (staging mode only, cached) =====
  let internalLinkStatuses: InternalLinkStatus[] = [];
  if (staging && internalLinks.length > 0) {
    internalLinkStatuses = await checkInternalLinkStatuses(
      internalLinks.map((l) => ({ href: l.href, text: l.text })),
      30,
    );
  }

  // ===== NEW: Schema validation =====
  const schemaValidationResults = schemaTypes.map((s) => validateSchema(s));

  // ===== NEW: Content recommendations (deterministic, no AI) =====
  const contentRecs = generateContentRecommendations(title, description, h1s, keywords, text);

  // ===== NEW: Keyword metrics from Google Ads (staging mode only) =====
  let keywordMetrics: KeywordMetric[] = [];
  if (staging && keywords.length > 0) {
    keywordMetrics = await fetchKeywordMetrics(keywords.slice(0, 5).map((k) => k.keyword));
  }

  // ===== DUPLICATE CONTENT DETECTION (SEMrush/Ahrefs/Screaming Frog style) =====
  const duplicateContentIssues: string[] = [];

  // 1. Title vs H1 duplication
  if (title && h1s.length > 0) {
    const normalizedTitle = title.toLowerCase().trim();
    const normalizedH1 = h1s[0].toLowerCase().trim();
    if (normalizedTitle === normalizedH1) {
      duplicateContentIssues.push("Title tag and H1 are identical - search engines may see this as duplicate.");
    }
  }

  // 2. Meta description vs first paragraph duplication
  if (description && text) {
    const firstParagraph = text.slice(0, 300).toLowerCase().trim();
    const normalizedDesc = description.toLowerCase().trim();
    if (firstParagraph.includes(normalizedDesc) && normalizedDesc.length > 50) {
      duplicateContentIssues.push("Meta description is copied from page content - write a unique description.");
    }
  }

  // 3. Repeated content blocks within the page
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 100);
  const seenParagraphs = new Map<string, number>();
  for (const p of paragraphs) {
    const key = p.toLowerCase().slice(0, 150);
    seenParagraphs.set(key, (seenParagraphs.get(key) || 0) + 1);
  }
  const repeatedBlocks = [...seenParagraphs.entries()].filter(([, count]) => count > 1);
  if (repeatedBlocks.length > 0) {
    duplicateContentIssues.push(`${repeatedBlocks.length} repeated content block(s) found on this page.`);
  }

  // 4. Thin content check
  if (words > 0 && words < 50) {
    duplicateContentIssues.push("Very thin content detected - pages with minimal text are often flagged as low-quality.");
  }

  // 5. Boilerplate ratio check (nav/footer content vs main content)
  const mainContent = doc.querySelector("main, [role='main'], article")?.textContent?.trim() || "";
  if (mainContent && text) {
    const mainWords = mainContent.split(/\s+/).length;
    const totalWords = text.split(/\s+/).length;
    if (totalWords > 0) {
      const boilerplateRatio = 1 - (mainWords / totalWords);
      if (boilerplateRatio > 0.6) {
        duplicateContentIssues.push(`High boilerplate ratio (${Math.round(boilerplateRatio * 100)}%) - most content is from navigation/footer, not unique body content.`);
      }
    }
  }

  // 6. Check for duplicate meta tags
  const metaDescriptions = Array.from(doc.querySelectorAll('meta[name="description"]'));
  if (metaDescriptions.length > 1) {
    duplicateContentIssues.push(`${metaDescriptions.length} meta description tags found - only one is valid.`);
  }
  const canonicalLinks = Array.from(doc.querySelectorAll('link[rel="canonical"]'));
  if (canonicalLinks.length > 1) {
    duplicateContentIssues.push(`${canonicalLinks.length} canonical tags found - only one is valid.`);
  }

  // 7. Duplicate H1 tags (same text appearing on multiple H1s)
  const h1Counts = new Map<string, number>();
  for (const h of h1s) {
    const key = h.toLowerCase().trim();
    h1Counts.set(key, (h1Counts.get(key) || 0) + 1);
  }
  const dupH1s = [...h1Counts.entries()].filter(([, c]) => c > 1);
  if (dupH1s.length > 0) {
    duplicateContentIssues.push(`Duplicate H1 tags: ${dupH1s.map(([t, c]) => `"${t.slice(0, 50)}" (${c}x)`).join(", ")}.`);
  }

  // 8. Duplicate H2 tags (same text appearing on multiple H2s)
  const h2Counts = new Map<string, number>();
  for (const h of h2s) {
    const key = h.toLowerCase().trim();
    h2Counts.set(key, (h2Counts.get(key) || 0) + 1);
  }
  const dupH2s = [...h2Counts.entries()].filter(([, c]) => c > 1);
  if (dupH2s.length > 0) {
    duplicateContentIssues.push(`Duplicate H2 tags: ${dupH2s.map(([t, c]) => `"${t.slice(0, 50)}" (${c}x)`).join(", ")}.`);
  }

  // 9. Duplicate title tag (multiple <title> tags)
  const titleTags = Array.from(doc.querySelectorAll("title"));
  if (titleTags.length > 1) {
    duplicateContentIssues.push(`${titleTags.length} <title> tags found - only one is valid.`);
  }

  // 10. Duplicate meta descriptions (same content)
  if (metaDescriptions.length >= 2) {
    const descValues = metaDescriptions.map((m) => (m.getAttribute("content") || "").toLowerCase().trim()).filter(Boolean);
    const descCounts = new Map<string, number>();
    for (const d of descValues) descCounts.set(d, (descCounts.get(d) || 0) + 1);
    const dupDescs = [...descCounts.entries()].filter(([, c]) => c > 1);
    if (dupDescs.length > 0) {
      duplicateContentIssues.push(`Duplicate meta description content: ${dupDescs.map(([t]) => `"${t.slice(0, 50)}"`).join(", ")}.`);
    }
  }

  if (duplicateContentIssues.length === 0) {
    checks.push({ id: "duplicate-content", label: "Duplicate Content", category: "on-page", status: "pass", detail: "No duplicate content issues detected on this page." });
  } else {
    checks.push({ id: "duplicate-content", label: "Duplicate Content", category: "on-page", status: "warn", detail: duplicateContentIssues.join(" ") });
    recommendations.push({ priority: "high", title: "Fix Duplicate Content Issues", detail: duplicateContentIssues.join(" ") });
  }

  // ===== FILTER CHECKS BY AUDIT DEPTH =====
  const BASIC_CHECK_IDS = new Set([
    "title", "meta-description", "h1", "headings", "content-length", "img-alt",
    "canonical", "internal-links", "https", "status", "viewport",
    "robots-txt", "sitemap", "structured-data", "html-lang", "noindex",
  ]);

  const STANDARD_CHECK_IDS = new Set([
    ...BASIC_CHECK_IDS,
    "hreflang", "open-graph", "twitter-cards", "keyword-density",
    "external-links", "dofollow-links", "nofollow-links", "anchor-text",
    "charset", "sitemap-in-robots", "security-headers", "compression",
    "favicon", "response-time", "html-size", "duplicate-content",
  ]);

  let filteredChecks = checks;
  if (auditDepth === "basic") {
    filteredChecks = checks.filter((c) => BASIC_CHECK_IDS.has(c.id));
  } else if (auditDepth === "standard") {
    filteredChecks = checks.filter((c) => STANDARD_CHECK_IDS.has(c.id));
  }
  // deep = all checks (no filtering)

  // ===== SCORE (recalculate based on filtered checks) =====
  const weights: Record<string, number> = { pass: 0, info: 0, warn: -3, fail: -8 };
  let deduction = 0;
  for (const c of filteredChecks) deduction += weights[c.status] || 0;
  deduction = Math.min(Math.abs(deduction), 100);
  const score = Math.max(0, 100 - deduction);

  // Per-category scores
  const cats = ["on-page", "off-page", "technical", "accessibility", "best-practices", "performance"];
  const categoryScores: CategoryScore[] = cats.map((cat) => {
    const catChecks = filteredChecks.filter((c) => c.category === cat);
    let catDeduction = 0;
    for (const c of catChecks) catDeduction += weights[c.status] || 0;
    return {
      category: cat,
      score: Math.max(0, 100 - Math.min(Math.abs(catDeduction), 100)),
      pass: catChecks.filter((c) => c.status === "pass").length,
      warn: catChecks.filter((c) => c.status === "warn").length,
      fail: catChecks.filter((c) => c.status === "fail").length,
      info: catChecks.filter((c) => c.status === "info").length,
    };
  });

  return {
    score, title, description, checks: filteredChecks, categoryScores, robotsContent, sitemapContent, sitemapUrl,
    headers: pageHeaders,
    socialPreview: { ogTitle, ogDescription, ogImage, twitterCard, twitterTitle, twitterDescription, twitterImage },
    links: bodyLinks.slice(0, 100),
    headings: headings.slice(0, 50),
    images: imgs.slice(0, 50),
    keywords, schema: schemaTypes, pageSpeed, linkAnalysis,
    hasTOC, hasFAQ, hasInfographic, recommendations,
    noindex: noindexInfo,
    googleProperties: googleProps,
    internalLinkStatuses,
    schemaValidation: schemaValidationResults,
    contentRecommendations: contentRecs,
    keywordMetrics,
  };
}


export async function handleSeoAudit(body: Record<string, unknown>) {
  const rawUrl: string = typeof body.url === "string" ? body.url : "";
  const auditId: string | undefined = typeof body.auditId === "string" ? body.auditId : undefined;
  const mode: string = typeof body.mode === "string" ? body.mode : "single";
  const auditDepth: string = typeof body.auditDepth === "string" ? body.auditDepth : "deep";
  const extractionFields = body.extractionFields as Record<string, boolean> | undefined;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

  const targetUrl = normalizeUrl(rawUrl);
  const parsed = new URL(targetUrl);
  const origin = parsed.origin;

  if (auditId && supabase) {
    try {
      await supabase.from("seo_audits").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", auditId);
    } catch (err) {
      console.warn("Could not set audit to running:", err);
    }
  }

  let robotsContent: string | null = null;
  try {
    const robotsRes = await fetch(origin + "/robots.txt", { headers: { "User-Agent": "SEO-Audit-Bot/1.0" } });
    if (robotsRes.ok) robotsContent = await robotsRes.text();
  } catch { /* ignore */ }

  const { content: sitemapContent, url: sitemapUrl } = await fetchSitemap(origin);

  if (mode === "crawl") {
    if (!sitemapContent) {
      return {
        error: "No sitemap found. Cannot crawl without a sitemap.xml or sitemap_index.xml.",
        urls: [],
      };
    }
    const { urls, sitemapsChecked } = await resolveAllSitemapUrls(sitemapContent, sitemapUrl || "");
    return {
      urls,
      sitemapUrl,
      sitemapsChecked,
      robotsContent,
      sitemapContent,
    };
  }

  const result = await auditSinglePage(targetUrl, robotsContent, sitemapContent, sitemapUrl, mode === "staging", auditDepth);

  if (mode === "custom") {
    const customUrls = await discoverCustomUrls(targetUrl, sitemapContent, sitemapUrl);
    const customData = await collectCustomAudit(customUrls);
    if (extractionFields) {
      if (!extractionFields.metaTitle && !extractionFields.metaDescription && !extractionFields.h1 && !extractionFields.h2 && !extractionFields.canonical && !extractionFields.robotsMeta) customData.pages = [];
      if (!extractionFields.missingAlt) customData.missingAlt = [];
      if (!extractionFields.redirects) customData.redirects = [];
      if (!extractionFields.duplicates) customData.duplicates = [];
      if (!extractionFields.trackingCodes) customData.trackingCodes = [];
      if (!extractionFields.forms) customData.forms = [];
    }
    result.customAudit = customData;
  }

  if (mode === "custom" && extractionFields) {
    const fieldToCheckId: Record<string, string> = {
      metaTitle: "title",
      metaDescription: "meta-description",
      h1: "h1",
      h2: "headings",
      canonical: "canonical",
      robotsMeta: "noindex",
      missingAlt: "img-alt",
      duplicates: "duplicate-content",
    };
    const allowedIds = new Set<string>();
    for (const [field, enabled] of Object.entries(extractionFields)) {
      if (enabled && fieldToCheckId[field]) allowedIds.add(fieldToCheckId[field]);
    }
    result.checks = result.checks.filter((c) => allowedIds.has(c.id));
    const weights: Record<string, number> = { pass: 0, info: 0, warn: -3, fail: -8 };
    let deduction = 0;
    for (const c of result.checks) deduction += weights[c.status] || 0;
    result.score = Math.max(0, 100 - Math.min(Math.abs(deduction), 100));
  }

  let savedAuditId = auditId;
  if (auditId && supabase) {
    try {
      await supabase.from("seo_audits").update({
        status: "completed",
        score: result.score,
        title: result.title,
        description: result.description,
        checks: result.checks as unknown as Record<string, unknown>,
        result_data: result as unknown as Record<string, unknown>,
        error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", auditId);
    } catch (dbErr) {
      console.warn("Could not save audit to database:", dbErr);
    }
  } else if (!auditId && supabase) {
    try {
      const { data: newRow } = await supabase.from("seo_audits").insert({
        url: targetUrl,
        status: "completed",
        score: result.score,
        title: result.title,
        description: result.description,
        checks: result.checks as unknown as Record<string, unknown>,
        result_data: result as unknown as Record<string, unknown>,
        error: null,
        audit_type: mode || "single",
        audit_depth: auditDepth || "standard",
      }).select("id").single();
      if (newRow?.id) {
        savedAuditId = newRow.id;
      }
    } catch (dbErr) {
      console.warn("Could not auto-insert audit record:", dbErr);
    }
  }

  return { ...result, auditId: savedAuditId };
}

