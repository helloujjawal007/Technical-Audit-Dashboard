import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Filter,
  Gauge,
  Globe,
  Info,
  Layers,
  ListChecks,
  Loader2,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import {
  type AuditIssuePriority,
  type AuditResult,
  type ClientAuditIssue,
  type ClientSeoAuditReport,
  type TechnicalAuditArea,
  scoreColor,
} from "@/types";
import { AUDIT_AREAS_ORDER, buildClientSeoAuditReport } from "@/lib/seoReportBuilder";

interface DuplicatesSummaryProp {
  duplicateTitles?: { title?: string; text?: string; count: number; urls: string[] }[];
  duplicateDescriptions?: { description?: string; text?: string; count: number; urls: string[] }[];
  duplicateH1s?: { h1?: string; text?: string; count: number; urls: string[] }[];
  orphanInboundUrls?: string[];
}

interface ClientAuditReportProps {
  websiteUrl: string;
  businessName?: string;
  primaryResult: Partial<AuditResult>;
  batchResults?: Partial<AuditResult>[];
  duplicatesSummary?: DuplicatesSummaryProp;
  prebuiltReport?: ClientSeoAuditReport;
}

const PRIORITY_STYLE: Record<AuditIssuePriority, string> = {
  High: "bg-red-50 text-red-700 border-red-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-slate-100 text-slate-600 border-slate-200",
};

const AREA_STATUS_STYLE: Record<string, string> = {
  Critical: "bg-red-50 text-red-700 border-red-200",
  "Needs Attention": "bg-amber-50 text-amber-700 border-amber-200",
  Healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Info: "bg-blue-50 text-blue-700 border-blue-200",
};

function IssueCard({ issue, index }: { issue: ClientAuditIssue; index: number }) {
  return (
    <div
      className={`rounded-xl border p-4 transition-shadow hover:shadow-sm ${
        issue.isQuickWin && issue.findingType === "Confirmed Issue"
          ? "border-emerald-200 bg-emerald-50/20"
          : issue.priority === "High" && issue.findingType === "Confirmed Issue"
          ? "border-red-200/80 bg-white"
          : "border-slate-200 bg-white"
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold shrink-0 mt-0.5">
            {index + 1}
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-900 leading-snug">{issue.issueName}</h4>
            <p className="text-xs text-slate-500 mt-0.5">{issue.area}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {issue.isQuickWin && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Zap className="w-3 h-3" />
              Quick Win · {issue.effortLabel}
            </span>
          )}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
              issue.findingType === "Confirmed Issue"
                ? "bg-orange-50 text-orange-800 border-orange-200"
                : "bg-indigo-50 text-indigo-700 border-indigo-200"
            }`}
          >
            {issue.findingType}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${PRIORITY_STYLE[issue.priority]}`}>
            {issue.priority} Priority
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
            {issue.affectedUrlsCount} {issue.affectedUrlsCount === 1 ? "URL" : "URLs"}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-700 leading-relaxed mb-3">{issue.description}</p>

      {/* Impact + Solution grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            SEO & Business Impact
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{issue.seoImpact}</p>
        </div>

        <div className="rounded-lg bg-indigo-50/40 border border-indigo-200/70 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 mb-1">
            <Wrench className="w-3.5 h-3.5 text-indigo-600" />
            Recommended Solution
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{issue.recommendedSolution}</p>
        </div>
      </div>

      {/* Example Affected URLs */}
      {issue.exampleAffectedUrls.length > 0 && (
        <div className="pt-2.5 border-t border-slate-100">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            Example Affected URLs ({Math.min(issue.exampleAffectedUrls.length, 5)} shown of {issue.affectedUrlsCount})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {issue.exampleAffectedUrls.slice(0, 5).map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-700 max-w-full truncate transition-colors"
                title={u}
              >
                <span className="truncate max-w-[340px]">{u}</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0 text-slate-400" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientAuditReport({
  websiteUrl,
  businessName,
  primaryResult,
  batchResults,
  duplicatesSummary,
  prebuiltReport,
}: ClientAuditReportProps) {
  const [quickWinsOnly, setQuickWinsOnly] = useState(false);
  const [findingFilter, setFindingFilter] = useState<"all" | "Confirmed Issue" | "Optimization Recommendation">("all");
  const [priorityFilter, setPriorityFilter] = useState<"All" | AuditIssuePriority>("All");
  const [areaFilter, setAreaFilter] = useState<"All" | TechnicalAuditArea>("All");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const normalizedDuplicates = useMemo(() => {
    if (!duplicatesSummary) return undefined;
    return {
      duplicateTitles: (duplicatesSummary.duplicateTitles || []).map((d) => ({
        title: d.title || d.text || "",
        count: d.count,
        urls: d.urls,
      })),
      duplicateDescriptions: (duplicatesSummary.duplicateDescriptions || []).map((d) => ({
        description: d.description || d.text || "",
        count: d.count,
        urls: d.urls,
      })),
      duplicateH1s: (duplicatesSummary.duplicateH1s || []).map((d) => ({
        h1: d.h1 || d.text || "",
        count: d.count,
        urls: d.urls,
      })),
      orphanInboundUrls: duplicatesSummary.orphanInboundUrls,
    };
  }, [duplicatesSummary]);

  const report = useMemo(() => {
    if (prebuiltReport) return prebuiltReport;
    return buildClientSeoAuditReport({
      websiteUrl: websiteUrl || primaryResult.url || "",
      businessName,
      primaryResult,
      batchResults,
      duplicatesSummary: normalizedDuplicates,
    });
  }, [prebuiltReport, websiteUrl, businessName, primaryResult, batchResults, normalizedDuplicates]);

  const filteredFindings = useMemo(() => {
    return report.detailedFindings.filter((item) => {
      if (quickWinsOnly && !item.isQuickWin) return false;
      if (findingFilter !== "all" && item.findingType !== findingFilter) return false;
      if (priorityFilter !== "All" && item.priority !== priorityFilter) return false;
      if (areaFilter !== "All" && item.area !== areaFilter) return false;
      return true;
    });
  }, [report.detailedFindings, quickWinsOnly, findingFilter, priorityFilter, areaFilter]);

  const handleDownloadPdf = async () => {
    setExportingPdf(true);
    setPdfError(null);
    try {
      const response = await fetch("/functions/v1/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: report.domain,
          businessName: report.businessName,
          websiteUrl: report.websiteUrl,
          result: primaryResult,
          batchResults,
          duplicatesSummary: normalizedDuplicates,
          report,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.downloadUrl) {
        throw new Error(data?.error || `PDF export failed (${response.status})`);
      }
      window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Failed to generate client PDF report.");
    } finally {
      setExportingPdf(false);
    }
  };

  const cwv = report.coreWebVitals;
  const sColor = scoreColor(report.overallScore);

  return (
    <div className="space-y-6">
      {/* Top Banner + Download CTA */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-semibold">
              <Sparkles className="w-3 h-3" />
              Client-Ready Technical SEO Audit · Quick Wins Prioritized First
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {report.businessName} ({report.domain})
            </h2>
            <p className="text-xs text-slate-500">
              Evidence-based audit across {report.pagesAudited} audited {report.pagesAudited === 1 ? "page" : "pages"} · Generated{" "}
              {new Date(report.generatedAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50">
              <span className={`text-2xl font-bold tabular-nums ${sColor.text}`}>
                {report.overallScore}
              </span>
              <div className="text-xs leading-tight">
                <div className="font-semibold text-slate-800">Grade {report.grade}</div>
                <div className="text-slate-500">Health Score</div>
              </div>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-xs transition-colors"
            >
              {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {exportingPdf ? "Generating Client PDF..." : "Download Client Audit PDF"}
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{pdfError}</span>
          </div>
        )}
      </div>

      {/* SECTION 1: Executive Summary */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="w-6 h-6 rounded-md bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">1</span>
          <h3 className="text-base font-bold text-slate-900">Executive Summary</h3>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed">{report.executiveSummary}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3">
            <div className="text-[11px] font-medium text-orange-800">Confirmed Issues</div>
            <div className="text-2xl font-bold text-orange-700 tabular-nums mt-0.5">
              {report.healthOverview.confirmedIssuesTotal}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="text-[11px] font-medium text-emerald-800 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Quick Wins Available
            </div>
            <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-0.5">
              {report.healthOverview.quickWinsTotal}
            </div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
            <div className="text-[11px] font-medium text-red-800">Critical High-Priority</div>
            <div className="text-2xl font-bold text-red-700 tabular-nums mt-0.5">{report.criticalIssues.length}</div>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
            <div className="text-[11px] font-medium text-indigo-800">Recommendations</div>
            <div className="text-2xl font-bold text-indigo-700 tabular-nums mt-0.5">
              {report.healthOverview.recommendationsTotal}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Overall Technical SEO Health Overview */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="w-6 h-6 rounded-md bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">2</span>
          <h3 className="text-base font-bold text-slate-900">Overall Technical SEO Health Overview</h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">{report.healthOverview.summary}</p>

        {/* Core Web Vitals & Speed Fold */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/60">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Server TTFB</span>
              <Gauge className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className={`text-lg font-bold tabular-nums mt-1 ${cwv.ttfbMs > 400 ? "text-red-600" : cwv.ttfbMs > 200 ? "text-amber-600" : "text-emerald-600"}`}>
              {cwv.ttfbMs}ms
            </div>
            <div className="text-[10px] text-slate-400">Target: &lt; 200ms</div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/60">
            <div className="text-[11px] text-slate-500">LCP ({cwv.lcpSource})</div>
            <div className={`text-lg font-bold tabular-nums mt-1 ${cwv.lcpSec !== undefined && cwv.lcpSec > 2.5 ? "text-red-600" : "text-emerald-600"}`}>
              {cwv.lcpSec !== undefined ? `${cwv.lcpSec}s` : "N/A"}
            </div>
            <div className="text-[10px] text-slate-400">Target: &lt;= 2.5s</div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/60">
            <div className="text-[11px] text-slate-500">INP ({cwv.inpSource})</div>
            <div className={`text-lg font-bold tabular-nums mt-1 ${cwv.inpMs !== undefined ? (cwv.inpMs > 200 ? "text-red-600" : "text-emerald-600") : "text-slate-400"}`}>
              {cwv.inpMs !== undefined ? `${cwv.inpMs}ms` : "Run PSI"}
            </div>
            <div className="text-[10px] text-slate-400">Target: &lt;= 200ms</div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/60">
            <div className="text-[11px] text-slate-500">CLS ({cwv.clsSource})</div>
            <div className={`text-lg font-bold tabular-nums mt-1 ${cwv.clsScore !== undefined ? (cwv.clsScore > 0.1 ? "text-red-600" : "text-emerald-600") : cwv.clsRiskCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {cwv.clsScore !== undefined ? cwv.clsScore : `${cwv.clsRiskCount} risk`}
            </div>
            <div className="text-[10px] text-slate-400">Target: &lt;= 0.10</div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/60">
            <div className="text-[11px] text-slate-500">HTML Document Size</div>
            <div className="text-lg font-bold tabular-nums text-slate-800 mt-1">{cwv.htmlSizeKb} KB</div>
            <div className="text-[10px] text-slate-400">Keep lean &amp; compressed</div>
          </div>
        </div>

        {/* 9-Area Health Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {report.healthOverview.areaBreakdown.map((area) => (
            <button
              type="button"
              key={area.area}
              onClick={() => setAreaFilter(areaFilter === area.area ? "All" : area.area)}
              className={`text-left rounded-lg border p-3.5 transition-all ${
                areaFilter === area.area ? "ring-2 ring-indigo-500 border-indigo-300 bg-indigo-50/20" : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-slate-900 leading-snug">{area.area}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${AREA_STATUS_STYLE[area.status] || AREA_STATUS_STYLE.Info}`}>
                  {area.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed mb-2">{area.summary}</p>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 tabular-nums">
                <span>{area.confirmedIssuesCount} issues</span>
                <span>·</span>
                <span className="text-emerald-700 font-medium">{area.quickWinsCount} quick wins</span>
                <span>·</span>
                <span>{area.recommendationsCount} recs</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 4 (surfaced right before full explorer if any critical issues exist) — keeping exact numbering 1..7 in headings */}
      <section className="rounded-xl border border-red-200/80 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-red-100 pb-3">
          <span className="w-6 h-6 rounded-md bg-red-600 text-white text-xs font-bold flex items-center justify-center">4</span>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Critical Issues Requiring Immediate Attention
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">{report.criticalIssues.length}</span>
          </h3>
        </div>

        {report.criticalIssues.length === 0 ? (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>No confirmed critical High-Priority technical blockers were detected on the audited URLs. Focus on the Quick Wins and Medium-priority improvements below.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {report.criticalIssues.map((issue, idx) => (
              <IssueCard key={issue.id} issue={issue} index={idx} />
            ))}
          </div>
        )}
      </section>

      {/* SECTION 5: Recommended Fixes and Action Plan (Quick Wins First) */}
      <section className="rounded-xl border border-emerald-200/80 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-emerald-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">5</span>
            <h3 className="text-base font-bold text-slate-900">Recommended Fixes &amp; Action Plan (Quick Wins First)</h3>
          </div>
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            {report.actionPlan.quickWinsFirst.length} Fast-Turnaround Wins
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
              <Zap className="w-4 h-4 text-emerald-600" />
              A. Immediate Quick Wins ({report.actionPlan.quickWinsFirst.length})
            </div>
            {report.actionPlan.quickWinsFirst.length === 0 ? (
              <p className="text-xs text-slate-500">No fast quick wins remaining in this bucket.</p>
            ) : (
              <ul className="space-y-2">
                {report.actionPlan.quickWinsFirst.map((i) => (
                  <li key={i.id} className="text-xs bg-white border border-emerald-200/70 rounded-md p-2.5">
                    <div className="font-semibold text-slate-900">{i.issueName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {i.priority} · {i.effortLabel} · {i.affectedUrlsCount} URL(s)
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <Layers className="w-4 h-4 text-amber-600" />
              B. Medium-Term Fixes ({report.actionPlan.mediumTermFixes.length})
            </div>
            {report.actionPlan.mediumTermFixes.length === 0 ? (
              <p className="text-xs text-slate-500">No medium-term fixes flagged.</p>
            ) : (
              <ul className="space-y-2">
                {report.actionPlan.mediumTermFixes.map((i) => (
                  <li key={i.id} className="text-xs bg-white border border-amber-200/70 rounded-md p-2.5">
                    <div className="font-semibold text-slate-900">{i.issueName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {i.priority} · {i.effortLabel} · {i.affectedUrlsCount} URL(s)
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Globe className="w-4 h-4 text-indigo-600" />
              C. Engineering &amp; Enhancements ({report.actionPlan.longerTermEngineering.length})
            </div>
            {report.actionPlan.longerTermEngineering.length === 0 ? (
              <p className="text-xs text-slate-500">No long-term engineering tasks flagged.</p>
            ) : (
              <ul className="space-y-2">
                {report.actionPlan.longerTermEngineering.map((i) => (
                  <li key={i.id} className="text-xs bg-white border border-slate-200 rounded-md p-2.5">
                    <div className="font-semibold text-slate-900">{i.issueName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {i.findingType} · {i.effortLabel} · {i.affectedUrlsCount} URL(s)
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 3: Detailed Technical SEO Findings (All 9 Areas, Quick Wins & Evidence Explorer) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">3</span>
            <h3 className="text-base font-bold text-slate-900">
              Detailed Technical SEO Findings ({filteredFindings.length} of {report.detailedFindings.length})
            </h3>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQuickWinsOnly(!quickWinsOnly)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                quickWinsOnly
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Zap className="w-3 h-3" />
              Quick Wins Only
            </button>

            <div className="inline-flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              {(["all", "Confirmed Issue", "Optimization Recommendation"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFindingFilter(t)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    findingFilter === t ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t === "all" ? "All Types" : t === "Confirmed Issue" ? "Confirmed" : "Recommendations"}
                </button>
              ))}
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as "All" | AuditIssuePriority)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white"
              aria-label="Filter by priority"
            >
              <option value="All">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>

            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value as "All" | TechnicalAuditArea)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white max-w-[230px]"
              aria-label="Filter by audit area"
            >
              <option value="All">All 9 Audit Areas</option>
              {AUDIT_AREAS_ORDER.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredFindings.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 flex flex-col items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <span>No findings match the current filter combination.</span>
            <button
              type="button"
              onClick={() => {
                setQuickWinsOnly(false);
                setFindingFilter("all");
                setPriorityFilter("All");
                setAreaFilter("All");
              }}
              className="text-indigo-600 font-semibold hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFindings.map((issue, idx) => (
              <IssueCard key={issue.id} issue={issue} index={idx} />
            ))}
          </div>
        )}
      </section>

      {/* SECTION 6: Priority-Wise Implementation Roadmap */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="w-6 h-6 rounded-md bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">6</span>
          <h3 className="text-base font-bold text-slate-900">Priority-Wise Implementation Roadmap</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[report.roadmap.phase1QuickWins, report.roadmap.phase2HighMedium, report.roadmap.phase3LongTerm].map((phase, pIdx) => (
            <div key={phase.title} className="rounded-lg border border-slate-200 p-4 bg-slate-50/40 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">{phase.title}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" />
                  {phase.timeline}
                </span>
              </div>
              {phase.items.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No items scheduled for this phase.</p>
              ) : (
                <ul className="space-y-1.5">
                  {phase.items.slice(0, 8).map((item) => (
                    <li key={`${pIdx}-${item.id}`} className="text-xs text-slate-700 flex items-start gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <span>
                        <strong className="font-medium text-slate-900">{item.issueName}</strong>{" "}
                        <span className="text-slate-500">({item.affectedUrlsCount} URLs)</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 7: Final Recommendations */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="w-6 h-6 rounded-md bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">7</span>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Final Recommendations
            <ListChecks className="w-4 h-4 text-indigo-600" />
          </h3>
        </div>

        <ul className="space-y-2">
          {report.finalRecommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
              <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
