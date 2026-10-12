import { useState } from "react";
import { Download, ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet, ExternalLink, Search, Pause, ListFilter, AlertTriangle, Link2 } from "lucide-react";
import type { CrawlPageResult, AuditResult, CheckResult } from "@/types";
import { scoreColor, CATEGORY_META, STATUS_META } from "@/types";
import { generateCrawlCsv, downloadCsv, downloadExcel, generateIssueCsv } from "@/lib/csv";
import { ResultsView } from "@/components/ResultsView";
import { CopyButton } from "@/components/CopyButton";

interface CrawlResultsViewProps {
  pages: CrawlPageResult[];
  baseUrl: string;
  sitemapUrl: string | null;
  crawlProgress: { completed: number; total: number };
  isCrawling: boolean;
  paused?: boolean;
}

type ViewMode = "urls" | "issues";

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
  https: { explanation: "The page is not securely served over HTTPS.", fix: "Install a valid SSL certificate and redirect every HTTP URL to its HTTPS version." },
};

function guidanceFor(check: CheckResult): IssueGuidance {
  return ISSUE_GUIDANCE[check.id] || {
    explanation: `This check found a ${check.status === "fail" ? "serious problem" : "potential problem"} on the page. ${check.detail}`,
    fix: "Open the affected URL, review the check details, and apply the recommendation shown for this issue. Then run the audit again to confirm it is resolved.",
  };
}

export function CrawlResultsView({ pages, baseUrl, sitemapUrl, crawlProgress, isCrawling, paused }: CrawlResultsViewProps) {
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "completed" | "failed" | "warnings">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("urls");
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const completed = pages.filter((p) => p.status === "completed");
  const failed = pages.filter((p) => p.status === "failed");
  const warnings = completed.filter((p) => p.result && p.result.score < 80);

  const filtered = pages.filter((p) => {
    if (filter === "completed") return p.status === "completed";
    if (filter === "failed") return p.status === "failed";
    if (filter === "warnings") return p.result && p.result.score < 80;
    return true;
  });

  const avgScore = completed.length > 0
    ? Math.round(completed.reduce((sum, p) => sum + (p.result?.score || 0), 0) / completed.length)
    : 0;

  const safeName = baseUrl.replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "_");
  const urlExportRows = [
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
  const issues = Array.from(issueMap.values()).sort((a, b) => {
    const order = { fail: 0, warn: 1, info: 2, pass: 3 };
    const statusDiff = order[a.check.status] - order[b.check.status];
    if (statusDiff !== 0) return statusDiff;
    return b.urls.length - a.urls.length;
  });

  const getIssueExportRows = (): string[][] => [
    ["Issue", "Status", "Category", "What it means", "How to fix", "Affected URL"],
    ...issues.flatMap(({ check, urls: issueUrls }) => {
      const guidance = guidanceFor(check);
      return issueUrls.map((url) => [check.label, check.status, check.category, guidance.explanation, guidance.fix, url]);
    }),
  ];
  const handleExportCsv = () => downloadCsv(`seo-audit_${safeName}.csv`, generateCrawlCsv(pages));
  const handleExportExcel = () => downloadExcel(`seo-audit_${safeName}.xls`, urlExportRows);
  const handleIssueExportCsv = () => downloadCsv(`seo-issues_${safeName}.csv`, generateIssueCsv(getIssueExportRows()));
  const handleIssueExportExcel = () => downloadExcel(`seo-issues_${safeName}.xls`, getIssueExportRows());

  return (
    <div className="space-y-4">
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
            onClick={viewMode === "issues" ? handleIssueExportCsv : handleExportCsv}
            disabled={completed.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            {viewMode === "issues" ? "Issues CSV" : "URLs CSV"}
          </button>
          <button
            onClick={viewMode === "issues" ? handleIssueExportExcel : handleExportExcel}
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

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Completed" value={completed.length} icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} />
        <StatBox label="Failed" value={failed.length} icon={<XCircle className="w-4 h-4 text-rose-500" />} />
        <StatBox label="Needs Work" value={warnings.length} icon={<AlertCircle className="w-4 h-4 text-amber-500" />} />
        <StatBox label="Issues Found" value={issues.length} icon={<AlertTriangle className="w-4 h-4 text-orange-500" />} />
      </div>

      {/* View mode toggle: URLs vs Issues */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setViewMode("urls")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === "urls" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            By URL
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
                onClick={() => setFilter(key)}
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
            {filtered.map((page) => {
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
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg flex-shrink-0">
                    {issueUrls.length} URL{issueUrls.length !== 1 ? "s" : ""}
                  </span>
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
