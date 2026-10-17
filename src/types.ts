export type CheckStatus = "pass" | "fail" | "warn" | "info";

export type CheckCategory = "on-page" | "off-page" | "technical" | "accessibility" | "best-practices" | "performance";

export interface CheckResult {
  id: string;
  label: string;
  category: CheckCategory;
  status: CheckStatus;
  detail: string;
  value?: string;
}

export interface SocialPreview {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
}

export interface LinkItem {
  href: string;
  rel: string;
  text: string;
}

export interface HeadingItem {
  level: number;
  text: string;
}

export interface ImageItem {
  src: string;
  alt: string;
  width: string;
  height: string;
}

export type KeywordType = "primary" | "secondary" | "supporting";

export interface KeywordInfo {
  keyword: string;
  density: number;
  count: number;
  type: KeywordType;
}

export interface SchemaInfo {
  type: string;
  source: "json-ld" | "microdata";
  raw: string;
}

export interface PageSpeedInfo {
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

export interface LinkAnalysis {
  internal: { href: string; text: string; rel: string }[];
  external: { href: string; text: string; rel: string }[];
  dofollow: { href: string; text: string }[];
  nofollow: { href: string; text: string }[];
  total: number;
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface NoindexInfo {
  indexable: boolean;
  source: "meta-robots" | "x-robots-tag" | "none" | null;
  directive: string | null;
  detail: string;
}

export interface GoogleProperty {
  property: string;
  id: string | null;
  detail: string;
}

export interface InternalLinkStatus {
  href: string;
  text: string;
  status: number | null;
  redirect: string | null;
  error: string | null;
}

export interface SchemaValidation {
  type: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ContentRecommendation {
  element: "title" | "meta-description" | "h1";
  issue: string;
  currentContent: string;
  updatedContent: string;
  status: "pass" | "warn" | "fail";
}

export interface KeywordMetric {
  keyword: string;
  searchVolume: string | null;
  competition: string | null;
  competitionIndex: string | null;
  lowTopOfPageBid: string | null;
  highTopOfPageBid: string | null;
  source: string;
}

export interface CategoryScore {
  category: CheckCategory;
  score: number;
  pass: number;
  warn: number;
  fail: number;
  info: number;
}

export interface AuditResult {
  score: number;
  title: string | null;
  description: string | null;
  checks: CheckResult[];
  categoryScores: CategoryScore[];
  robotsContent: string | null;
  sitemapContent: string | null;
  sitemapUrl: string | null;
  headers: Record<string, string>;
  socialPreview: SocialPreview;
  links: LinkItem[];
  headings: HeadingItem[];
  images: ImageItem[];
  keywords: KeywordInfo[];
  schema: SchemaInfo[];
  pageSpeed: PageSpeedInfo;
  linkAnalysis: LinkAnalysis;
  hasTOC: boolean;
  hasFAQ: boolean;
  hasInfographic: boolean;
  recommendations: Recommendation[];
  noindex: NoindexInfo;
  googleProperties: GoogleProperty[];
  internalLinkStatuses: InternalLinkStatus[];
  schemaValidation: SchemaValidation[];
  contentRecommendations: ContentRecommendation[];
  keywordMetrics: KeywordMetric[];
  customAudit?: CustomAuditData;
}

export interface AuditRow {
  id: string;
  url: string;
  status: "pending" | "running" | "completed" | "failed";
  score: number | null;
  title: string | null;
  description: string | null;
  checks: CheckResult[] | null;
  result_data: AuditResult | null;
  error: string | null;
  audit_type: string | null;
  audit_depth: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export const AUDIT_TYPE_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  single: { label: "Single Page", icon: "globe", color: "text-blue-600", bg: "bg-blue-50" },
  multiple: { label: "Multiple Pages", icon: "list", color: "text-slate-600", bg: "bg-slate-100" },
  crawl: { label: "Site Crawl", icon: "file-search", color: "text-emerald-600", bg: "bg-emerald-50" },
  staging: { label: "Staging", icon: "flask", color: "text-amber-600", bg: "bg-amber-50" },
  custom: { label: "Custom Audit", icon: "settings", color: "text-teal-600", bg: "bg-teal-50" },
};

export type AuditMode = "single" | "multiple" | "crawl" | "staging" | "custom";

export interface CustomExtractionFields {
  metaTitle: boolean;
  metaDescription: boolean;
  h1: boolean;
  h2: boolean;
  canonical: boolean;
  robotsMeta: boolean;
  redirects: boolean;
  missingAlt: boolean;
  duplicates: boolean;
  trackingCodes: boolean;
  forms: boolean;
}

export const DEFAULT_EXTRACTION_FIELDS: CustomExtractionFields = {
  metaTitle: true,
  metaDescription: true,
  h1: true,
  h2: true,
  canonical: true,
  robotsMeta: true,
  redirects: true,
  missingAlt: true,
  duplicates: true,
  trackingCodes: true,
  forms: true,
};

export const EXTRACTION_FIELD_LABELS: Record<keyof CustomExtractionFields, string> = {
  metaTitle: "Meta Title",
  metaDescription: "Meta Description",
  h1: "H1 Headings",
  h2: "H2 Headings",
  canonical: "Canonical URL",
  robotsMeta: "Robots Meta Tag",
  redirects: "Redirecting URLs",
  missingAlt: "Missing Image Alt Text",
  duplicates: "Duplicate Metadata",
  trackingCodes: "Tracking Codes",
  forms: "Forms by Page",
};

export interface CustomAuditPage {
  url: string;
  title: string | null;
  description: string | null;
  h1: string[];
  h2: string[];
  canonical: string | null;
  robotsMeta: string | null;
}

export interface CustomAuditData {
  pages: CustomAuditPage[];
  missingAlt: { page: string; src: string }[];
  redirects: { source: string; target: string | null; status: number }[];
  duplicates: { type: "title" | "description" | "h1"; value: string; pages: string[] }[];
  trackingCodes: { type: string; id: string | null; pages: string[] }[];
  forms: { page: string; action: string; method: string }[];
}

export type AuditDepth = "deep" | "standard" | "basic";

export type SiteType = "live" | "staging";

export const AUDIT_DEPTH_META: Record<AuditDepth, { label: string; description: string; icon: string; color: string; bg: string; border: string }> = {
  deep: { label: "Deep Audit", description: "Full SEO + Accessibility + Best Practices + Performance (90+ checks)", icon: "Microscope", color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200" },
  standard: { label: "SEMrush / Ahrefs / Screaming Frog", description: "Core technical & on-page SEO with duplicate detection (40+ checks)", icon: "Search", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  basic: { label: "Basic Audit", description: "Essential on-page SEO checks (15 checks)", icon: "Gauge", color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200" },
};

export interface CrawlPageResult {
  url: string;
  status: "pending" | "running" | "completed" | "failed";
  result: AuditResult | null;
  error: string | null;
}

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  "on-page": "On-Page SEO",
  "off-page": "Off-Page SEO",
  technical: "Technical SEO",
  accessibility: "Accessibility",
  "best-practices": "Best Practices",
  performance: "Performance",
};

export const CATEGORY_ORDER: CheckCategory[] = ["on-page", "off-page", "technical", "accessibility", "best-practices", "performance"];

export const CATEGORY_META: Record<CheckCategory, { label: string; color: string; bg: string; icon: string }> = {
  "on-page": { label: "On-Page SEO", color: "text-blue-700", bg: "bg-blue-50", icon: "FileText" },
  "off-page": { label: "Off-Page SEO", color: "text-emerald-700", bg: "bg-emerald-50", icon: "Link2" },
  technical: { label: "Technical SEO", color: "text-slate-700", bg: "bg-slate-100", icon: "Server" },
  accessibility: { label: "Accessibility", color: "text-violet-700", bg: "bg-violet-50", icon: "Accessibility" },
  "best-practices": { label: "Best Practices", color: "text-amber-700", bg: "bg-amber-50", icon: "ShieldCheck" },
  performance: { label: "Performance", color: "text-rose-700", bg: "bg-rose-50", icon: "Gauge" },
};

export const STATUS_META: Record<CheckStatus, { label: string; color: string; bg: string; dot: string }> = {
  pass: { label: "Passed", color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  fail: { label: "Failed", color: "text-rose-700", bg: "bg-rose-50", dot: "bg-rose-500" },
  warn: { label: "Warning", color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500" },
  info: { label: "Info", color: "text-sky-700", bg: "bg-sky-50", dot: "bg-sky-500" },
};

export const KEYWORD_TYPE_META: Record<KeywordType, { label: string; color: string; bg: string }> = {
  primary: { label: "Primary", color: "text-blue-700", bg: "bg-blue-50" },
  secondary: { label: "Secondary", color: "text-violet-700", bg: "bg-violet-50" },
  supporting: { label: "Supporting", color: "text-slate-600", bg: "bg-slate-50" },
};

export const PRIORITY_META: Record<Recommendation["priority"], { label: string; color: string; bg: string; border: string }> = {
  high: { label: "High Priority", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
  medium: { label: "Medium Priority", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  low: { label: "Low Priority", color: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200" },
};

export function scoreColor(score: number): { text: string; ring: string; bg: string; label: string } {
  if (score >= 80) return { text: "text-emerald-600", ring: "stroke-emerald-500", bg: "bg-emerald-500", label: "Good" };
  if (score >= 50) return { text: "text-amber-600", ring: "stroke-amber-500", bg: "bg-amber-500", label: "Needs Work" };
  return { text: "text-rose-600", ring: "stroke-rose-500", bg: "bg-rose-500", label: "Poor" };
}

export type SiteTypeCategory = "ecommerce" | "blog" | "saas" | "corporate" | "agency" | "portfolio" | "general";

export interface SiteDashboard {
  id: string;
  name: string;
  domain: string;
  url: string;
  siteType: SiteTypeCategory;
  targetKeywords: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

