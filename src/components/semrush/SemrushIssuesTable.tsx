import { useState, useMemo } from "react";
import {
  Search,
  X,
  XCircle,
  AlertTriangle,
  Info,
  Wrench,
  Download,
  CheckCircle2,
  ListFilter,
} from "lucide-react";
import type { AuditResult } from "@/types";
import { getIssueGuidance, type SemrushBottleneck } from "./semrushTypes";

interface SemrushIssuesTableProps {
  result: AuditResult;
  url: string;
  onOpenFixModal: (bottleneck: SemrushBottleneck) => void;
  resolvedIds?: Set<string>;
  onToggleResolve?: (checkId: string) => void;
}

export function SemrushIssuesTable({
  result,
  url,
  onOpenFixModal,
  resolvedIds,
  onToggleResolve,
}: SemrushIssuesTableProps) {
  const [severityFilter, setSeverityFilter] = useState<"all" | "errors" | "warnings" | "notices">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter issues into actionable items (errors, warnings, notices)
  const allIssues = useMemo(() => {
    const checks = result.checks || [];
    return checks
      .filter((c) => c.status === "fail" || c.status === "warn" || c.status === "info")
      .map((check) => {
        const guidance = getIssueGuidance(check);
        const severity: "error" | "warning" | "notice" =
          check.status === "fail"
            ? "error"
            : check.status === "warn"
            ? "warning"
            : "notice";
        return {
          check,
          guidance,
          affectedUrls: [url],
          severity,
        };
      })
      .sort((a, b) => {
        const order = { error: 0, warning: 1, notice: 2 };
        if (order[a.severity] !== order[b.severity]) {
          return order[a.severity] - order[b.severity];
        }
        return b.guidance.impactBoost - a.guidance.impactBoost;
      });
  }, [result.checks, url]);

  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warnCount = allIssues.filter((i) => i.severity === "warning").length;
  const noticeCount = allIssues.filter((i) => i.severity === "notice").length;

  // Filtered issues based on tab, category and search
  const filteredIssues = useMemo(() => {
    return allIssues.filter((item) => {
      // Severity
      if (severityFilter === "errors" && item.severity !== "error") return false;
      if (severityFilter === "warnings" && item.severity !== "warning") return false;
      if (severityFilter === "notices" && item.severity !== "notice") return false;

      // Category
      if (categoryFilter !== "all" && item.check.category !== categoryFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLabel = item.check.label.toLowerCase().includes(q);
        const matchesDetail = item.check.detail.toLowerCase().includes(q);
        const matchesCategory = item.check.category.toLowerCase().includes(q);
        if (!matchesLabel && !matchesDetail && !matchesCategory) return false;
      }

      return true;
    });
  }, [allIssues, severityFilter, categoryFilter, searchQuery]);

  // Export CSV
  const handleExportCsv = () => {
    const headers = ["Issue", "Severity", "Category", "Detail", "Impact Boost", "Affected URL"];
    const rows = filteredIssues.map((i) => [
      i.check.label,
      i.severity,
      i.check.category,
      i.check.detail,
      `+${i.guidance.impactBoost}%`,
      url,
    ]);
    const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const csvContent = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8" }));
    link.download = `semrush-issues-${new URL(url).hostname}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="p-4 rounded-3xl border border-slate-200/90 bg-white shadow-xs space-y-3">
        {/* Severity Tabs (SEMrush Signature) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl">
            <button
              type="button"
              onClick={() => setSeverityFilter("all")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                severityFilter === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>All Issues</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${severityFilter === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                {allIssues.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSeverityFilter("errors")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                severityFilter === "errors"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-rose-700 hover:bg-rose-50"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Errors</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${severityFilter === "errors" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-800"}`}>
                {errorCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSeverityFilter("warnings")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                severityFilter === "warnings"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Warnings</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${severityFilter === "warnings" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"}`}>
                {warnCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSeverityFilter("notices")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                severityFilter === "notices"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-sky-700 hover:bg-sky-50"
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Notices</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${severityFilter === "notices" ? "bg-white/20 text-white" : "bg-sky-100 text-sky-800"}`}>
                {noticeCount}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredIssues.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Issues CSV</span>
          </button>
        </div>

        {/* Search & Category Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search issues by name, category, or detail..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-slate-700 outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="technical">Technical SEO</option>
              <option value="on-page">On-Page SEO</option>
              <option value="performance">Performance</option>
              <option value="accessibility">Accessibility</option>
              <option value="best-practices">Best Practices</option>
              <option value="off-page">Off-Page SEO</option>
            </select>
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div className="rounded-3xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
        {filteredIssues.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-1">
            <p className="font-semibold text-slate-600 text-sm">No issues found matching your filters</p>
            <p>Try resetting the search query or selecting a different severity tab.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 border-b border-slate-100 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Issue Description</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-center">Score Boost</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredIssues.map((item) => {
                  const { check, guidance, severity } = item;
                  const isResolved = resolvedIds?.has(check.id);

                  return (
                    <tr
                      key={check.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isResolved ? "bg-emerald-50/30 text-slate-400" : ""
                      }`}
                    >
                      {/* Issue name & detail */}
                      <td className="py-3 px-4 min-w-[280px]">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex-shrink-0">
                            {severity === "error" ? (
                              <XCircle className="w-4 h-4 text-rose-500" />
                            ) : severity === "warning" ? (
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                            ) : (
                              <Info className="w-4 h-4 text-sky-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold ${
                                  isResolved ? "line-through text-slate-400" : "text-slate-900"
                                }`}
                              >
                                {check.label}
                              </span>
                              {isResolved && (
                                <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                  Resolved
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed max-w-xl">
                              {check.detail}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Severity Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            severity === "error"
                              ? "bg-rose-100 text-rose-800"
                              : severity === "warning"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {severity}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 whitespace-nowrap text-[11px] font-semibold text-slate-500">
                        {check.category}
                      </td>

                      {/* Score Boost */}
                      <td className="py-3 px-3 whitespace-nowrap text-center">
                        <span className="inline-block text-[11px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-lg">
                          +{guidance.impactBoost}%
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {onToggleResolve && (
                            <button
                              type="button"
                              onClick={() => onToggleResolve(check.id)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                isResolved
                                  ? "text-emerald-700 bg-emerald-100 hover:bg-emerald-200"
                                  : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                              }`}
                              title={isResolved ? "Mark pending" : "Mark resolved"}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onOpenFixModal(item)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Why & Fix</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
