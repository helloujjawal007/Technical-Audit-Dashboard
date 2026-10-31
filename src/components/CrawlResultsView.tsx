import { useState, useMemo } from "react";
import { Download, ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet, ExternalLink, Search, Pause, ListFilter, AlertTriangle, Link2, Zap, ChevronLeft, Wrench, Copy } from "lucide-react";
import type { CrawlPageResult, AuditResult, CheckResult } from "@/types";
import { scoreColor, CATEGORY_META, STATUS_META } from "@/types";
import { generateCrawlCsv, downloadCsv, downloadExcel, generateIssueCsv, generateDuplicateMissingCsv } from "@/lib/csv";
import { ResultsView } from "@/components/ResultsView";
import { CopyButton } from "@/components/CopyButton";
import { ScoreGauge } from "@/components/ScoreGauge";
import { SemrushFixModal } from "@/components/semrush/SemrushFixModal";
import { getIssueGuidance, type SemrushBottleneck } from "@/components/semrush/semrushTypes";

interface CrawlResultsViewProps {
  pages: CrawlPageResult[];
  baseUrl: string;
  sitemapUrl: string | null;
  crawlProgress: { completed: number; total: number };
  isCrawling: boolean;
  paused?: boolean;
  totalDiscoveredUrls?: number;
  onOpenStealthQueue?: () => void;
}

type ViewMode = "urls" | "issues" | "duplicates-missing";

type IssueGuidance = { explanation: string; fix: string };

const ISSUE_GUIDANCE: Record<string, IssueGuidance> = {
  title: { explanation: "The page title is missing, too short, too long, or not descriptive enough for search results.", fix: "Write one clear title for the page, keep it close to 50–60 characters, and place the main topic near the beginning." },
  "meta-description": { explanation: "Search engines may not have a useful summary to show below this page in results.", fix: "Add one specific summary of the page in about 120–160 characters with a clear reason to visit." },
  h1: { explanation: "The page does not have a clear main heading, or it has more than one competing main heading.", fix: "Use one visible H1 that describes the page topic, then use H2 and H3 headings for sections." },
  headings: { explanation: "The heading structure is difficult to follow or skips important heading levels.", fix: "Organize headings in order: one H1, then H2 sections, with H3 subsections only where needed." },
  canonical: { explanation: "Search engines may not know which version of this page should be treated as the primary version.", fix: "Add one canonical link that points to the preferred, absolute URL for this page." },
  "img-alt": { explanation: "Some images do not explain their purpose to visitors using screen readers, and search engines receive less context.", fix: "Add short, useful alt text to meaningful images. Use empty alt text only for decorative images." },
  "internal-links": { explanation: "The page has too few useful links connecting visitors and search engines to related pages.", fix: "Add relevant internal links with descriptive anchor text to important related pages." },
  "structured-data": { explanation: "The page is missing structured data that could help search engines understand its content.", fix: "Add valid JSON-LD that matches the visible content, such as Article, Product, FAQ, or Organization data." },
  noindex: { explanation: "A noindex instruction prevents this page from appearing in search results.", fix: "Remove the noindex meta tag or X-Robots-Tag unless keeping the page out of search is intentional." },
  "robots-meta": { explanation: "The robots meta tag is not defined on the page, leaving indexation and snippet rendering to search engine defaults.", fix: "Add <meta name='robots' content='index, follow, max-image-preview:large'> in the HTML <head> to explicitly guide search crawlers." },
  "author-publisher": { explanation: "Author or publisher metadata is missing, which weakens Google E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) scoring.", fix: "Add <meta name='author' content='Author Name'> or JSON-LD Person/Organization schema to attribute content to verifiable authors." },
  https: { explanation: "The page is not securely served over HTTPS.", fix: "Install a valid SSL certificate and redirect every HTTP URL to its HTTPS version." },
};

function guidanceFor(check: CheckResult): IssueGuidance {
  return ISSUE_GUIDANCE[check.id] || {
    explanation: `This check found a ${check.status === "fail" ? "serious problem" : "potential problem"} on the page. ${check.detail}`,
    fix: "Open the affected URL, review the check details, and apply the recommendation shown for this issue. Then run the audit again to confirm it is resolved.",
  };
}

export function CrawlResultsView({
  pages,
  baseUrl,
  sitemapUrl,
  crawlProgress,
  isCrawling,
  paused,
  totalDiscoveredUrls,
  onOpenStealthQueue,
}: CrawlResultsViewProps) {
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "completed" | "failed" | "warnings">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("urls");
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [fixBottleneck, setFixBottleneck] = useState<SemrushBottleneck | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dupMissFilter, setDupMissFilter] = useState<"all" | "duplicates" | "missing">("all");
  const [expandedDupGroup, setExpandedDupGroup] = useState<string | null>(null);
  const [expandedMissKey, setExpandedMissKey] = useState<string | null>(null);

  const completed = useMemo(() => pages.filter((p) => p.status === "completed"), [pages]);
  const failed = useMemo(() => pages.filter((p) => p.status === "failed"), [pages]);
  const warnings = useMemo(() => completed.filter((p) => p.result && p.result.score < 80), [completed]);

  // Cross-Page Duplicate Analysis
  const duplicatesAnalysis = useMemo(() => {
    const titleMap = new Map<string, string[]>();
    const descMap = new Map<string, string[]>();
    const h1Map = new Map<string, string[]>();
    const multipleCanonicalPages: string[] = [];

    for (const page of completed) {
      if (!page.result) continue;
      const t = page.result.title?.trim();
      if (t) {
        const key = t.toLowerCase();
        if (!titleMap.has(key)) titleMap.set(key, []);
        titleMap.get(key)!.push(page.url);
      }
      const d = page.result.description?.trim();
      if (d) {
        const key = d.toLowerCase();
        if (!descMap.has(key)) descMap.set(key, []);
        descMap.get(key)!.push(page.url);
      }
      const firstH1 = page.result.headings?.find((h) => h.level === 1)?.text?.trim();
      if (firstH1) {
        const key = firstH1.toLowerCase();
        if (!h1Map.has(key)) h1Map.set(key, []);
        h1Map.get(key)!.push(page.url);
      }
      const dupCanon = page.result.checks?.find((c) => c.id === "duplicate-canonical" && c.status === "fail");
      if (dupCanon) multipleCanonicalPages.push(page.url);
    }

    const duplicateTitles = [...titleMap.entries()]
      .filter(([, urls]) => urls.length > 1)
      .map(([text, urls]) => ({ text, count: urls.length, urls }));

    const duplicateDescriptions = [...descMap.entries()]
      .filter(([, urls]) => urls.length > 1)
      .map(([text, urls]) => ({ text, count: urls.length, urls }));

    const duplicateH1s = [...h1Map.entries()]
      .filter(([, urls]) => urls.length > 1)
      .map(([text, urls]) => ({ text, count: urls.length, urls }));

    const totalDuplicatePages = new Set([
      ...duplicateTitles.flatMap((d) => d.urls),
      ...duplicateDescriptions.flatMap((d) => d.urls),
      ...duplicateH1s.flatMap((d) => d.urls),
      ...multipleCanonicalPages,
    ]).size;

    return {
      duplicateTitles,
      duplicateDescriptions,
      duplicateH1s,
      multipleCanonicalPages,
      totalDuplicatePages,
      totalGroups: duplicateTitles.length + duplicateDescriptions.length + duplicateH1s.length + multipleCanonicalPages.length,
    };
  }, [completed]);

  // Site-Wide Missing Elements Analysis
  const missingsAnalysis = useMemo(() => {
    const missingTitles: string[] = [];
    const missingDescriptions: string[] = [];
    const missingH1s: string[] = [];
    const missingCanonicals: string[] = [];
    const missingAlts: { url: string; count: number }[] = [];
    const missingRobotsMeta: string[] = [];
    const missingSchemas: string[] = [];
    const missingAuthorPublishers: string[] = [];

    for (const page of completed) {
      if (!page.result) continue;
      if (!page.result.title || !page.result.title.trim()) {
        missingTitles.push(page.url);
      }
      if (!page.result.description || !page.result.description.trim()) {
        missingDescriptions.push(page.url);
      }
      const hasH1 = page.result.headings?.some((h) => h.level === 1 && h.text.trim());
      if (!hasH1) {
        missingH1s.push(page.url);
      }
      const canonicalCheck = page.result.checks?.find((c) => c.id === "canonical");
      if (!canonicalCheck || canonicalCheck.status === "fail") {
        missingCanonicals.push(page.url);
      }
      const altCheck = page.result.checks?.find((c) => c.id === "img-alt");
      if (altCheck && altCheck.status === "warn") {
        const missingCount = page.result.images?.filter((i) => !i.alt).length || 1;
        missingAlts.push({ url: page.url, count: missingCount });
      }
      const robotsCheck = page.result.checks?.find((c) => c.id === "robots-meta");
      if (robotsCheck && (robotsCheck.status === "warn" || robotsCheck.detail.includes("not defined"))) {
        missingRobotsMeta.push(page.url);
      }
      if (!page.result.schema || page.result.schema.length === 0) {
        missingSchemas.push(page.url);
      }
      const authorCheck = page.result.checks?.find((c) => c.id === "author-publisher");
      if (authorCheck && authorCheck.status === "warn") {
        missingAuthorPublishers.push(page.url);
      }
    }

    const totalMissingPages = new Set([
      ...missingTitles,
      ...missingDescriptions,
      ...missingH1s,
      ...missingCanonicals,
      ...missingAlts.map((a) => a.url),
      ...missingRobotsMeta,
      ...missingSchemas,
      ...missingAuthorPublishers,
    ]).size;

    return {
      missingTitles,
      missingDescriptions,
      missingH1s,
      missingCanonicals,
      missingAlts,
      missingRobotsMeta,
      missingSchemas,
      missingAuthorPublishers,
      totalMissingPages,
    };
  }, [completed]);

  const filtered = useMemo(() => {
    if (filter === "completed") return pages.filter((p) => p.status === "completed");
    if (filter === "failed") return pages.filter((p) => p.status === "failed");
    if (filter === "warnings") return pages.filter((p) => p.result && p.result.score < 80);
    return pages;
  }, [pages, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedPages = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

  const avgScore = useMemo(() => {
    return completed.length > 0
      ? Math.round(completed.reduce((sum, p) => sum + (p.result?.score || 0), 0) / completed.length)
      : 0;
  }, [completed]);

  const safeName = baseUrl.replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "_");

  const getUrlExportRows = (): string[][] => [
    ["URL", "Score", "Page title", "Result", "Issue count"],
    ...pages.map((page) => [
      page.url,
      page.result ? String(page.result.score) : "",
      page.result?.title || "",
      page.status,
      page.result ? String((page.result.checks || []).filter((check) => check.status === "fail" || check.status === "warn").length) : "",
    ]),
  ];

  // Build issue-centric data: group by check ID across all completed pages
  const issues = useMemo(() => {
    const issueMap = new Map<string, { check: CheckResult; urls: string[] }>();
    for (const page of completed) {
      if (!page.result) continue;
      for (const check of page.result.checks || []) {
        if (check.status === "fail" || check.status === "warn") {
          const key = check.id;
          if (!issueMap.has(key)) {
            issueMap.set(key, { check, urls: [] });
          }
          issueMap.get(key)!.urls.push(page.url);
        }
      }
    }
    return Array.from(issueMap.values()).sort((a, b) => {
      const order = { fail: 0, warn: 1, info: 2, pass: 3 };
      const statusDiff = order[a.check.status] - order[b.check.status];
      if (statusDiff !== 0) return statusDiff;
      return b.urls.length - a.urls.length;
    });
  }, [completed]);

  const getIssueExportRows = (): string[][] => [
    ["Issue", "Status", "Category", "What it means", "How to fix", "Affected URL"],
    ...issues.flatMap(({ check, urls: issueUrls }) => {
      const guidance = guidanceFor(check);
      return issueUrls.map((url) => [check.label, check.status, check.category, guidance.explanation, guidance.fix, url]);
    }),
  ];

  const getDuplicateMissingExportRows = (): string[][] => {
    const rows: string[][] = [
      ["Type", "Issue", "Severity", "Value / Detail", "Occurrences", "Affected URL"],
    ];
    for (const item of duplicatesAnalysis.duplicateTitles) {
      for (const u of item.urls) rows.push(["Duplicate", "Duplicate Title Tag", "Error", item.text, String(item.count), u]);
    }
    for (const item of duplicatesAnalysis.duplicateDescriptions) {
      for (const u of item.urls) rows.push(["Duplicate", "Duplicate Meta Description", "Warning", item.text, String(item.count), u]);
    }
    for (const item of duplicatesAnalysis.duplicateH1s) {
      for (const u of item.urls) rows.push(["Duplicate", "Duplicate H1 Heading", "Warning", item.text, String(item.count), u]);
    }
    for (const u of duplicatesAnalysis.multipleCanonicalPages) {
      rows.push(["Duplicate", "Multiple Canonical Tags", "Error", "Multiple canonical tags defined", "1", u]);
    }
    for (const u of missingsAnalysis.missingTitles) {
      rows.push(["Missing", "Missing Title Tag", "Error", "Page has no <title> tag", "1", u]);
    }
    for (const u of missingsAnalysis.missingDescriptions) {
      rows.push(["Missing", "Missing Meta Description", "Warning", "Page has no meta description", "1", u]);
    }
    for (const u of missingsAnalysis.missingH1s) {
      rows.push(["Missing", "Missing H1 Heading", "Error", "Page has no H1 heading", "1", u]);
    }
    for (const u of missingsAnalysis.missingCanonicals) {
      rows.push(["Missing", "Missing Canonical Tag", "Error", "Page has no canonical tag", "1", u]);
    }
    for (const item of missingsAnalysis.missingAlts) {
      rows.push(["Missing", "Missing Image Alt Text", "Warning", `${item.count} images missing alt`, String(item.count), item.url]);
    }
    for (const u of missingsAnalysis.missingRobotsMeta) {
      rows.push(["Missing", "Missing Robots Meta Tag", "Notice", "Robots meta tag not defined", "1", u]);
    }
    for (const u of missingsAnalysis.missingSchemas) {
      rows.push(["Missing", "Missing Structured Data", "Notice", "No Schema.org markup found", "1", u]);
    }
    for (const u of missingsAnalysis.missingAuthorPublishers) {
      rows.push(["Missing", "Missing E-E-A-T Attribution", "Notice", "Author/publisher missing", "1", u]);
    }
    return rows;
  };

  const handleExportCsv = () => downloadCsv(`seo-audit_${safeName}.csv`, generateCrawlCsv(pages));
  const handleExportExcel = () => downloadExcel(`seo-audit_${safeName}.xls`, getUrlExportRows());
  const handleIssueExportCsv = () => downloadCsv(`seo-issues_${safeName}.csv`, generateIssueCsv(getIssueExportRows()));
  const handleIssueExportExcel = () => downloadExcel(`seo-issues_${safeName}.xls`, getIssueExportRows());
  const handleDuplicateMissingExportCsv = () => downloadCsv(`seo-duplicates-missing_${safeName}.csv`, generateDuplicateMissingCsv(getDuplicateMissingExportRows()));
  const handleDuplicateMissingExportExcel = () => downloadExcel(`seo-duplicates-missing_${safeName}.xls`, getDuplicateMissingExportRows());

  const handleFilterChange = (newFilter: "all" | "completed" | "failed" | "warnings") => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Big site stealth notification banner */}
      {Boolean(totalDiscoveredUrls && totalDiscoveredUrls > 100) && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 flex-shrink-0">
              <Zap className="w-5 h-5 text-indigo-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-white">
                  Big Site Detected ({totalDiscoveredUrls} total URLs found)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-400/20 text-indigo-200 border border-indigo-400/30">
                  Stealth Mode Active
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Auditing the top 100 priority pages immediately in &lt; 2 minutes. The full site ({totalDiscoveredUrls} pages) is enqueued in Stealth Mode and will continue in the background once foreground audits finish.
              </p>
            </div>
          </div>
          {onOpenStealthQueue && (
            <button
              type="button"
              onClick={onOpenStealthQueue}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition cursor-pointer flex-shrink-0"
            >
              <span>View Stealth Queue</span>
            </button>
          )}
        </div>
      )}

      {/* Summary header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Domain Audit Results</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {sitemapUrl ? `Sitemap: ${sitemapUrl}` : baseUrl}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Pages:</span>
            <span className="font-semibold text-slate-700">{pages.length}</span>
          </div>
          {completed.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Avg Score:</span>
              <span className={`font-bold ${scoreColor(avgScore).text}`}>{avgScore}</span>
            </div>
          )}
          <button
            onClick={
              viewMode === "duplicates-missing"
                ? handleDuplicateMissingExportCsv
                : viewMode === "issues"
                ? handleIssueExportCsv
                : handleExportCsv
            }
            disabled={completed.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            {viewMode === "duplicates-missing" ? "Dup & Miss CSV" : viewMode === "issues" ? "Issues CSV" : "URLs CSV"}
          </button>
          <button
            onClick={
              viewMode === "duplicates-missing"
                ? handleDuplicateMissingExportExcel
                : viewMode === "issues"
                ? handleIssueExportExcel
                : handleExportExcel
            }
            disabled={completed.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {isCrawling && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50">
          {paused ? <Pause className="w-5 h-5 text-amber-500 flex-shrink-0" /> : <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />}
          <div className="flex-1">
            <div className="flex justify-between text-xs text-blue-700 mb-1">
              <span className="font-medium">{paused ? "Audit paused — click Resume to continue" : "Auditing pages..."}</span>
              <span>{crawlProgress.completed} / {crawlProgress.total}</span>
            </div>
            <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${crawlProgress.total > 0 ? (crawlProgress.completed / crawlProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* SEMrush Domain Crawl Health Banner */}
      {completed.length > 0 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-950 via-[#111322] to-[#1c1836] text-white border border-slate-800/80 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <ScoreGauge score={avgScore} size={110} />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-500 text-white">
                  SEMrush Domain Health
                </span>
                <span className="text-[10px] font-bold text-slate-300">
                  {completed.length} / {pages.length} Pages Audited
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-white">{avgScore}</span>
                <span className="text-slate-400 text-xs font-bold">/100 Average Health Score</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Audited across {issues.length} distinct technical issue categories
              </p>
            </div>
          </div>

          {/* Benchmark */}
          <div className="w-full md:w-64 p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs space-y-2">
            <div className="flex justify-between text-slate-300 font-bold">
              <span>Competitive Benchmark</span>
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Top 10% Sites</span>
                <span className="text-emerald-400 font-bold">92%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: "92%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>This Domain</span>
                <span className="text-orange-400 font-bold">{avgScore}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full rounded-full" style={{ width: `${avgScore}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Completed" value={completed.length} icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} />
        <StatBox label="Failed" value={failed.length} icon={<XCircle className="w-4 h-4 text-rose-500" />} />
        <StatBox label="Needs Work" value={warnings.length} icon={<AlertCircle className="w-4 h-4 text-amber-500" />} />
        <StatBox label="Issues Found" value={issues.length} icon={<AlertTriangle className="w-4 h-4 text-orange-500" />} />
      </div>

      {/* View mode toggle: URLs vs Issues vs Duplicates & Missing */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setViewMode("urls")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === "urls" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            By URL ({pages.length})
          </button>
          <button
            onClick={() => setViewMode("issues")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === "issues" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            By Issue ({issues.length})
          </button>
          <button
            onClick={() => setViewMode("duplicates-missing")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === "duplicates-missing" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            Duplicates & Missing ({duplicatesAnalysis.totalDuplicatePages + missingsAnalysis.totalMissingPages})
          </button>
        </div>
      </div>

      {/* URL view (original) */}
      {viewMode === "urls" && (
        <>
          {/* Filter tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {([
              ["all", `All (${pages.length})`],
              ["completed", `Passed (${completed.length - warnings.length})`],
              ["warnings", `Needs Work (${warnings.length})`],
              ["failed", `Failed (${failed.length})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleFilterChange(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  filter === key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Page list */}
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">
                {isCrawling ? "Waiting for results..." : "No pages match this filter."}
              </div>
            )}
            {paginatedPages.map((page) => {
              const isExpanded = expandedUrl === page.url;
              const sc = page.result ? scoreColor(page.result.score) : null;
              const validatorUrl = `https://validator.schema.org/#url=${encodeURIComponent(page.url)}`;
              const richResultsUrl = `https://search.google.com/test/rich-results?url=${encodeURIComponent(page.url)}`;
              return (
                <div key={page.url} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left">
                    <button
                      onClick={() => setExpandedUrl(isExpanded ? null : page.url)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate font-medium">{page.url}</p>
                        {page.result?.title && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{page.result.title}</p>
                        )}
                        {page.error && (
                          <p className="text-xs text-rose-500 truncate mt-0.5">{page.error}</p>
                        )}
                      </div>
                    </button>
                    <CopyButton text={page.url} />
                    <a
                      href={validatorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex-shrink-0"
                      title="Validate schema on validator.schema.org"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={richResultsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex-shrink-0"
                      title="Test rich results on Google"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Search className="w-3.5 h-3.5" />
                    </a>
                    {page.status === "running" && <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}
                    {page.status === "completed" && page.result && sc && (
                      <span className={`text-sm font-bold ${sc.text} flex-shrink-0`}>{page.result.score}</span>
                    )}
                    {page.status === "failed" && <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />}
                  </div>

                  {isExpanded && page.result && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50">
                      <ResultsView result={page.result as AuditResult} url={page.url} />
                    </div>
                  )}
                  {isExpanded && !page.result && page.error && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50">
                      <div className="flex items-center gap-2 text-sm text-rose-600">
                        <XCircle className="w-4 h-4" />
                        <span>{page.error}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>
                  Showing {Math.min((safeCurrentPage - 1) * pageSize + 1, filtered.length)}–
                  {Math.min(safeCurrentPage * pageSize, filtered.length)} of {filtered.length} pages
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1.5">
                  Per page:
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-xs text-slate-700 outline-none cursor-pointer focus:border-blue-500"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={500}>All (500)</option>
                  </select>
                </span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-slate-700 px-2">
                    Page {safeCurrentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Issues view (Screaming Frog style) */}
      {viewMode === "issues" && (
        <div className="space-y-2">
          {issues.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              {isCrawling ? "Waiting for results..." : "No issues found across audited pages."}
            </div>
          )}
          {issues.map(({ check, urls: issueUrls }) => {
            const isExpanded = expandedIssue === check.id;
            const statusMeta = STATUS_META[check.status];
            const catMeta = CATEGORY_META[check.category as keyof typeof CATEGORY_META] || { label: check.category, color: "text-slate-700", bg: "bg-slate-50", icon: "Info" };
            return (
              <div key={check.id} className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpandedIssue(isExpanded ? null : check.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <div className={`w-2.5 h-2.5 rounded-full ${statusMeta.dot} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-700">{check.label}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusMeta.bg} ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${catMeta.bg} ${catMeta.color}`}>
                        {catMeta.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{guidanceFor(check).explanation}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {issueUrls.length} URL{issueUrls.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFixBottleneck({
                          check,
                          guidance: getIssueGuidance(check),
                          affectedUrls: issueUrls,
                          severity: check.status === "fail" ? "error" : "warning",
                        });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                    >
                      <Wrench className="w-3 h-3" />
                      <span>Why & Fix</span>
                    </button>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50">
                    <div className="p-4 border-b border-slate-200 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What this means</p>
                        <p className="text-sm text-slate-600 mt-1">{guidanceFor(check).explanation}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">How to fix it</p>
                        <p className="text-sm text-slate-600 mt-1">{guidanceFor(check).fix}</p>
                      </div>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {issueUrls.map((url) => (
                        <div key={url} className="flex items-center gap-2 text-sm">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline truncate flex-1 min-w-0"
                          >
                            {url}
                          </a>
                          <CopyButton text={url} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Duplicates & Missing View */}
      {viewMode === "duplicates-missing" && (
        <div className="space-y-4">
          {/* SEMrush Duplicate & Missing Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500">Duplicate Titles</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${duplicatesAnalysis.duplicateTitles.length > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {duplicatesAnalysis.duplicateTitles.length > 0 ? "Error" : "Clean"}
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900">{duplicatesAnalysis.duplicateTitles.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{duplicatesAnalysis.duplicateTitles.reduce((a, b) => a + b.count, 0)} pages affected</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500">Duplicate Descriptions</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${duplicatesAnalysis.duplicateDescriptions.length > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {duplicatesAnalysis.duplicateDescriptions.length > 0 ? "Warning" : "Clean"}
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900">{duplicatesAnalysis.duplicateDescriptions.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{duplicatesAnalysis.duplicateDescriptions.reduce((a, b) => a + b.count, 0)} pages affected</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500">Missing Titles</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${missingsAnalysis.missingTitles.length > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {missingsAnalysis.missingTitles.length > 0 ? "Critical" : "Clean"}
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900">{missingsAnalysis.missingTitles.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Pages without &lt;title&gt;</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500">Missing Descriptions</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${missingsAnalysis.missingDescriptions.length > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {missingsAnalysis.missingDescriptions.length > 0 ? "Warning" : "Clean"}
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900">{missingsAnalysis.missingDescriptions.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Pages without meta desc</p>
            </div>
          </div>

          {/* Subfilter buttons */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              onClick={() => setDupMissFilter("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                dupMissFilter === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              All Duplicates & Missing ({duplicatesAnalysis.totalDuplicatePages + missingsAnalysis.totalMissingPages})
            </button>
            <button
              onClick={() => setDupMissFilter("duplicates")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                dupMissFilter === "duplicates" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Duplicates ({duplicatesAnalysis.totalDuplicatePages})
            </button>
            <button
              onClick={() => setDupMissFilter("missing")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                dupMissFilter === "missing" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Missing ({missingsAnalysis.totalMissingPages})
            </button>
          </div>

          {/* List of items */}
          <div className="space-y-3">
            {/* Duplicates Section */}
            {(dupMissFilter === "all" || dupMissFilter === "duplicates") && (
              <>
                {/* Duplicate Titles */}
                {duplicatesAnalysis.duplicateTitles.map((item, idx) => {
                  const key = `dup-title-${idx}`;
                  const isExpanded = expandedDupGroup === key;
                  return (
                    <div key={key} className="rounded-xl border border-rose-200 bg-white overflow-hidden shadow-xs">
                      <div
                        onClick={() => setExpandedDupGroup(isExpanded ? null : key)}
                        className="flex items-center justify-between p-3.5 hover:bg-rose-50/50 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-rose-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                                Duplicate Title
                              </span>
                              <span className="text-xs font-bold text-slate-700 truncate">
                                "{item.text}"
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Shared across {item.count} pages. Canonicalization / ranking cannibalization risk.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {item.count} Pages
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const dummyCheck: CheckResult = {
                                id: "duplicate-title",
                                label: "Duplicate Title Tags",
                                category: "on-page",
                                status: "fail",
                                detail: `Title "${item.text}" is duplicated on ${item.count} pages.`,
                              };
                              setFixBottleneck({
                                check: dummyCheck,
                                guidance: getIssueGuidance(dummyCheck),
                                affectedUrls: item.urls,
                                severity: "error",
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Why & Fix</span>
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-rose-100 bg-rose-50/30 p-3.5 space-y-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-600">Affected URLs ({item.urls.length})</span>
                            <CopyButton text={item.urls.join("\n")} />
                          </div>
                          <div className="space-y-1.5">
                            {item.urls.map((u) => (
                              <div key={u} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200">
                                <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                  {u}
                                </a>
                                <CopyButton text={u} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Duplicate Descriptions */}
                {duplicatesAnalysis.duplicateDescriptions.map((item, idx) => {
                  const key = `dup-desc-${idx}`;
                  const isExpanded = expandedDupGroup === key;
                  return (
                    <div key={key} className="rounded-xl border border-amber-200 bg-white overflow-hidden shadow-xs">
                      <div
                        onClick={() => setExpandedDupGroup(isExpanded ? null : key)}
                        className="flex items-center justify-between p-3.5 hover:bg-amber-50/50 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-amber-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                Duplicate Description
                              </span>
                              <span className="text-xs font-bold text-slate-700 truncate">
                                "{item.text}"
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Shared across {item.count} pages. Lowers search snippet uniqueness.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {item.count} Pages
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const dummyCheck: CheckResult = {
                                id: "duplicate-meta-description",
                                label: "Duplicate Meta Descriptions",
                                category: "on-page",
                                status: "warn",
                                detail: `Meta description is duplicated on ${item.count} pages.`,
                              };
                              setFixBottleneck({
                                check: dummyCheck,
                                guidance: getIssueGuidance(dummyCheck),
                                affectedUrls: item.urls,
                                severity: "warning",
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Why & Fix</span>
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-amber-100 bg-amber-50/30 p-3.5 space-y-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-600">Affected URLs ({item.urls.length})</span>
                            <CopyButton text={item.urls.join("\n")} />
                          </div>
                          <div className="space-y-1.5">
                            {item.urls.map((u) => (
                              <div key={u} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200">
                                <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                  {u}
                                </a>
                                <CopyButton text={u} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Duplicate H1s */}
                {duplicatesAnalysis.duplicateH1s.map((item, idx) => {
                  const key = `dup-h1-${idx}`;
                  const isExpanded = expandedDupGroup === key;
                  return (
                    <div key={key} className="rounded-xl border border-amber-200 bg-white overflow-hidden shadow-xs">
                      <div
                        onClick={() => setExpandedDupGroup(isExpanded ? null : key)}
                        className="flex items-center justify-between p-3.5 hover:bg-amber-50/50 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-amber-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                Duplicate H1 Heading
                              </span>
                              <span className="text-xs font-bold text-slate-700 truncate">
                                "{item.text}"
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Shared across {item.count} pages. Topic hierarchy dilution.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {item.count} Pages
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const dummyCheck: CheckResult = {
                                id: "duplicate-h1",
                                label: "Duplicate H1 Headings",
                                category: "on-page",
                                status: "warn",
                                detail: `H1 heading is duplicated on ${item.count} pages.`,
                              };
                              setFixBottleneck({
                                check: dummyCheck,
                                guidance: getIssueGuidance(dummyCheck),
                                affectedUrls: item.urls,
                                severity: "warning",
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Why & Fix</span>
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-amber-100 bg-amber-50/30 p-3.5 space-y-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-600">Affected URLs ({item.urls.length})</span>
                            <CopyButton text={item.urls.join("\n")} />
                          </div>
                          <div className="space-y-1.5">
                            {item.urls.map((u) => (
                              <div key={u} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200">
                                <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                  {u}
                                </a>
                                <CopyButton text={u} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Multiple Canonical Tags */}
                {duplicatesAnalysis.multipleCanonicalPages.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-white overflow-hidden shadow-xs">
                    <div
                      onClick={() => setExpandedDupGroup(expandedDupGroup === "dup-canon" ? null : "dup-canon")}
                      className="flex items-center justify-between p-3.5 hover:bg-rose-50/50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {expandedDupGroup === "dup-canon" ? <ChevronDown className="w-4 h-4 text-rose-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                              Multiple Canonical Tags
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              Conflicting canonical declarations
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Search engines ignore all canonical declarations when multiples exist.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {duplicatesAnalysis.multipleCanonicalPages.length} Pages
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const dummyCheck: CheckResult = {
                              id: "duplicate-canonical",
                              label: "Multiple Canonical Tags",
                              category: "technical",
                              status: "fail",
                              detail: "Multiple canonical tags detected on this page.",
                            };
                            setFixBottleneck({
                              check: dummyCheck,
                              guidance: getIssueGuidance(dummyCheck),
                              affectedUrls: duplicatesAnalysis.multipleCanonicalPages,
                              severity: "error",
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Why & Fix</span>
                        </button>
                      </div>
                    </div>

                    {expandedDupGroup === "dup-canon" && (
                      <div className="border-t border-rose-100 bg-rose-50/30 p-3.5 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-600">Affected URLs ({duplicatesAnalysis.multipleCanonicalPages.length})</span>
                          <CopyButton text={duplicatesAnalysis.multipleCanonicalPages.join("\n")} />
                        </div>
                        <div className="space-y-1.5">
                          {duplicatesAnalysis.multipleCanonicalPages.map((u) => (
                            <div key={u} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200">
                              <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                {u}
                              </a>
                              <CopyButton text={u} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Missings Section */}
            {(dupMissFilter === "all" || dupMissFilter === "missing") && (
              <>
                {/* Missing Titles */}
                {missingsAnalysis.missingTitles.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-white overflow-hidden shadow-xs">
                    <div
                      onClick={() => setExpandedMissKey(expandedMissKey === "miss-title" ? null : "miss-title")}
                      className="flex items-center justify-between p-3.5 hover:bg-rose-50/50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {expandedMissKey === "miss-title" ? <ChevronDown className="w-4 h-4 text-rose-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                              Missing Title Tag
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              Pages with no &lt;title&gt; element
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Critical ranking signal. Google will generate arbitrary or empty search headlines.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {missingsAnalysis.missingTitles.length} Pages
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const dummyCheck: CheckResult = {
                              id: "title",
                              label: "Title Tag",
                              category: "on-page",
                              status: "fail",
                              detail: "Missing <title> tag.",
                            };
                            setFixBottleneck({
                              check: dummyCheck,
                              guidance: getIssueGuidance(dummyCheck),
                              affectedUrls: missingsAnalysis.missingTitles,
                              severity: "error",
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Why & Fix</span>
                        </button>
                      </div>
                    </div>

                    {expandedMissKey === "miss-title" && (
                      <div className="border-t border-rose-100 bg-rose-50/30 p-3.5 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-600">Affected URLs ({missingsAnalysis.missingTitles.length})</span>
                          <CopyButton text={missingsAnalysis.missingTitles.join("\n")} />
                        </div>
                        <div className="space-y-1.5">
                          {missingsAnalysis.missingTitles.map((u) => (
                            <div key={u} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200">
                              <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                {u}
                              </a>
                              <CopyButton text={u} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Missing Meta Descriptions */}
                {missingsAnalysis.missingDescriptions.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-white overflow-hidden shadow-xs">
                    <div
                      onClick={() => setExpandedMissKey(expandedMissKey === "miss-desc" ? null : "miss-desc")}
                      className="flex items-center justify-between p-3.5 hover:bg-amber-50/50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {expandedMissKey === "miss-desc" ? <ChevronDown className="w-4 h-4 text-amber-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              Missing Meta Description
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              Pages with no &lt;meta name="description"&gt;
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Missed organic CTR opportunity. Google extracts random page snippets.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {missingsAnalysis.missingDescriptions.length} Pages
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const dummyCheck: CheckResult = {
                              id: "meta-description",
                              label: "Meta Description",
                              category: "on-page",
                              status: "warn",
                              detail: "Missing meta description.",
                            };
                            setFixBottleneck({
                              check: dummyCheck,
                              guidance: getIssueGuidance(dummyCheck),
                              affectedUrls: missingsAnalysis.missingDescriptions,
                              severity: "warning",
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Why & Fix</span>
                        </button>
                      </div>
                    </div>

                    {expandedMissKey === "miss-desc" && (
                      <div className="border-t border-amber-100 bg-amber-50/30 p-3.5 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-600">Affected URLs ({missingsAnalysis.missingDescriptions.length})</span>
                          <CopyButton text={missingsAnalysis.missingDescriptions.join("\n")} />
                        </div>
                        <div className="space-y-1.5">
                          {missingsAnalysis.missingDescriptions.map((u) => (
                            <div key={u} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200">
                              <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                {u}
                              </a>
                              <CopyButton text={u} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Missing H1 Headings */}
                {missingsAnalysis.missingH1s.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-white overflow-hidden shadow-xs">
                    <div
                      onClick={() => setExpandedMissKey(expandedMissKey === "miss-h1" ? null : "miss-h1")}
                      className="flex items-center justify-between p-3.5 hover:bg-rose-50/50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {expandedMissKey === "miss-h1" ? <ChevronDown className="w-4 h-4 text-rose-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                              Missing H1 Heading
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              Pages with no primary &lt;h1&gt;
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Search crawlers cannot identify primary topic hierarchy.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {missingsAnalysis.missingH1s.length} Pages
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const dummyCheck: CheckResult = {
                              id: "h1",
                              label: "Single H1 Heading",
                              category: "on-page",
                              status: "fail",
                              detail: "No H1 tag found.",
                            };
                            setFixBottleneck({
                              check: dummyCheck,
                              guidance: getIssueGuidance(dummyCheck),
                              affectedUrls: missingsAnalysis.missingH1s,
                              severity: "error",
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Why & Fix</span>
                        </button>
                      </div>
                    </div>

                    {expandedMissKey === "miss-h1" && (
                      <div className="border-t border-rose-100 bg-rose-50/30 p-3.5 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-600">Affected URLs ({missingsAnalysis.missingH1s.length})</span>
                          <CopyButton text={missingsAnalysis.missingH1s.join("\n")} />
                        </div>
                        <div className="space-y-1.5">
                          {missingsAnalysis.missingH1s.map((u) => (
                            <div key={u} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200">
                              <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                {u}
                              </a>
                              <CopyButton text={u} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Missing Canonicals */}
                {missingsAnalysis.missingCanonicals.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-white overflow-hidden shadow-xs">
                    <div
                      onClick={() => setExpandedMissKey(expandedMissKey === "miss-canon" ? null : "miss-canon")}
                      className="flex items-center justify-between p-3.5 hover:bg-rose-50/50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {expandedMissKey === "miss-canon" ? <ChevronDown className="w-4 h-4 text-rose-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                              Missing Canonical Tag
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              Pages without self-referencing canonical
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Leaves URLs vulnerable to duplicate indexing across protocol, www, and query params.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {missingsAnalysis.missingCanonicals.length} Pages
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const dummyCheck: CheckResult = {
                              id: "canonical",
                              label: "Canonical URL",
                              category: "technical",
                              status: "fail",
                              detail: "Canonical URL is missing.",
                            };
                            setFixBottleneck({
                              check: dummyCheck,
                              guidance: getIssueGuidance(dummyCheck),
                              affectedUrls: missingsAnalysis.missingCanonicals,
                              severity: "error",
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Why & Fix</span>
                        </button>
                      </div>
                    </div>

                    {expandedMissKey === "miss-canon" && (
                      <div className="border-t border-rose-100 bg-rose-50/30 p-3.5 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-600">Affected URLs ({missingsAnalysis.missingCanonicals.length})</span>
                          <CopyButton text={missingsAnalysis.missingCanonicals.join("\n")} />
                        </div>
                        <div className="space-y-1.5">
                          {missingsAnalysis.missingCanonicals.map((u) => (
                            <div key={u} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200">
                              <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                {u}
                              </a>
                              <CopyButton text={u} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Missing Image Alt Text */}
                {missingsAnalysis.missingAlts.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-white overflow-hidden shadow-xs">
                    <div
                      onClick={() => setExpandedMissKey(expandedMissKey === "miss-alt" ? null : "miss-alt")}
                      className="flex items-center justify-between p-3.5 hover:bg-amber-50/50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {expandedMissKey === "miss-alt" ? <ChevronDown className="w-4 h-4 text-amber-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              Missing Image Alt Text
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              Pages with images lacking alt attributes
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Harms visual accessibility and image search discovery.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {missingsAnalysis.missingAlts.length} Pages
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const dummyCheck: CheckResult = {
                              id: "img-alt",
                              label: "Image Alt Text",
                              category: "on-page",
                              status: "warn",
                              detail: "Images are missing alt text.",
                            };
                            setFixBottleneck({
                              check: dummyCheck,
                              guidance: getIssueGuidance(dummyCheck),
                              affectedUrls: missingsAnalysis.missingAlts.map((a) => a.url),
                              severity: "warning",
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Why & Fix</span>
                        </button>
                      </div>
                    </div>

                    {expandedMissKey === "miss-alt" && (
                      <div className="border-t border-amber-100 bg-amber-50/30 p-3.5 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-600">Affected URLs ({missingsAnalysis.missingAlts.length})</span>
                          <CopyButton text={missingsAnalysis.missingAlts.map((a) => a.url).join("\n")} />
                        </div>
                        <div className="space-y-1.5">
                          {missingsAnalysis.missingAlts.map((item) => (
                            <div key={item.url} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200">
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                {item.url}
                              </a>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-amber-600 font-bold px-1.5 py-0.5 rounded bg-amber-50">
                                  {item.count} images missing alt
                                </span>
                                <CopyButton text={item.url} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Missing Robots Meta */}
                {missingsAnalysis.missingRobotsMeta.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div
                      onClick={() => setExpandedMissKey(expandedMissKey === "miss-robots" ? null : "miss-robots")}
                      className="flex items-center justify-between p-3.5 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {expandedMissKey === "miss-robots" ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                              Missing Robots Meta Tag
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              Pages without explicit &lt;meta name="robots"&gt;
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Recommended to explicitly declare index, follow, max-image-preview:large.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {missingsAnalysis.missingRobotsMeta.length} Pages
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const dummyCheck: CheckResult = {
                              id: "robots-meta",
                              label: "Robots Meta Tag",
                              category: "technical",
                              status: "warn",
                              detail: "Robots meta tag is not defined.",
                            };
                            setFixBottleneck({
                              check: dummyCheck,
                              guidance: getIssueGuidance(dummyCheck),
                              affectedUrls: missingsAnalysis.missingRobotsMeta,
                              severity: "notice",
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Why & Fix</span>
                        </button>
                      </div>
                    </div>

                    {expandedMissKey === "miss-robots" && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-3.5 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-600">Affected URLs ({missingsAnalysis.missingRobotsMeta.length})</span>
                          <CopyButton text={missingsAnalysis.missingRobotsMeta.join("\n")} />
                        </div>
                        <div className="space-y-1.5">
                          {missingsAnalysis.missingRobotsMeta.map((u) => (
                            <div key={u} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200">
                              <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                {u}
                              </a>
                              <CopyButton text={u} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Missing Schema Structured Data */}
                {missingsAnalysis.missingSchemas.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div
                      onClick={() => setExpandedMissKey(expandedMissKey === "miss-schema" ? null : "miss-schema")}
                      className="flex items-center justify-between p-3.5 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {expandedMissKey === "miss-schema" ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                              Missing Structured Data
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              Pages without Schema.org JSON-LD
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Reduces rich snippet eligibility in Google SERPs.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {missingsAnalysis.missingSchemas.length} Pages
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const dummyCheck: CheckResult = {
                              id: "structured-data",
                              label: "Structured Data (Schema)",
                              category: "technical",
                              status: "warn",
                              detail: "No structured data found.",
                            };
                            setFixBottleneck({
                              check: dummyCheck,
                              guidance: getIssueGuidance(dummyCheck),
                              affectedUrls: missingsAnalysis.missingSchemas,
                              severity: "notice",
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Why & Fix</span>
                        </button>
                      </div>
                    </div>

                    {expandedMissKey === "miss-schema" && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-3.5 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-600">Affected URLs ({missingsAnalysis.missingSchemas.length})</span>
                          <CopyButton text={missingsAnalysis.missingSchemas.join("\n")} />
                        </div>
                        <div className="space-y-1.5">
                          {missingsAnalysis.missingSchemas.map((u) => (
                            <div key={u} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200">
                              <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                {u}
                              </a>
                              <CopyButton text={u} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Missing Author / Publisher Attribution */}
                {missingsAnalysis.missingAuthorPublishers.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div
                      onClick={() => setExpandedMissKey(expandedMissKey === "miss-author" ? null : "miss-author")}
                      className="flex items-center justify-between p-3.5 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {expandedMissKey === "miss-author" ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                              Missing E-E-A-T Attribution
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              Pages without author or publisher meta
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Author attribution strengthens Google Experience, Expertise, Authoritativeness trust signals.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {missingsAnalysis.missingAuthorPublishers.length} Pages
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const dummyCheck: CheckResult = {
                              id: "author-publisher",
                              label: "Author & Publisher Attribution",
                              category: "on-page",
                              status: "warn",
                              detail: "Author and publisher metadata are missing.",
                            };
                            setFixBottleneck({
                              check: dummyCheck,
                              guidance: getIssueGuidance(dummyCheck),
                              affectedUrls: missingsAnalysis.missingAuthorPublishers,
                              severity: "notice",
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Why & Fix</span>
                        </button>
                      </div>
                    </div>

                    {expandedMissKey === "miss-author" && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-3.5 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-600">Affected URLs ({missingsAnalysis.missingAuthorPublishers.length})</span>
                          <CopyButton text={missingsAnalysis.missingAuthorPublishers.join("\n")} />
                        </div>
                        <div className="space-y-1.5">
                          {missingsAnalysis.missingAuthorPublishers.map((u) => (
                            <div key={u} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200">
                              <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                {u}
                              </a>
                              <CopyButton text={u} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* All clean state */}
            {duplicatesAnalysis.totalDuplicatePages === 0 && missingsAnalysis.totalMissingPages === 0 && (
              <div className="text-center py-12 p-8 rounded-2xl bg-white border border-slate-200">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-base font-bold text-slate-800">100% Clean! No Duplicates or Missing Essentials</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Every audited page on this domain has unique titles, meta descriptions, H1 headings, canonical tags, and structured markup.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEMrush Prescriptive Fix Modal */}
      <SemrushFixModal
        bottleneck={fixBottleneck}
        onClose={() => setFixBottleneck(null)}
      />
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white">
      {icon}
      <div>
        <p className="text-lg font-bold text-slate-700">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}
