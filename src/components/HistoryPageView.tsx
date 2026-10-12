import { useState, useMemo } from "react";
import {
  Search,
  Trash2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Globe,
  Clock,
  Sparkles,
  Download,
  Filter,
} from "lucide-react";
import type { AuditRow } from "@/types";
import { scoreColor } from "@/types";

interface HistoryPageViewProps {
  audits: AuditRow[];
  onSelectAudit: (audit: AuditRow) => void;
  onDeleteAudit: (id: string) => void;
  onStartNewAudit: () => void;
}

export function HistoryPageView({
  audits,
  onSelectAudit,
  onDeleteAudit,
  onStartNewAudit,
}: HistoryPageViewProps) {
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<"all" | "good" | "warn" | "poor">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return audits.filter((a) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchesUrl = a.url.toLowerCase().includes(q);
        const matchesTitle = a.title ? a.title.toLowerCase().includes(q) : false;
        if (!matchesUrl && !matchesTitle) return false;
      }
      // Score filter
      if (scoreFilter === "good" && (a.score === null || a.score < 80)) return false;
      if (scoreFilter === "warn" && (a.score === null || a.score < 50 || a.score >= 80)) return false;
      if (scoreFilter === "poor" && (a.score === null || a.score >= 50)) return false;
      // Type filter
      if (typeFilter !== "all" && a.audit_type !== typeFilter) return false;

      return true;
    });
  }, [audits, search, scoreFilter, typeFilter]);

  const stats = useMemo(() => {
    const scored = audits.filter((a) => typeof a.score === "number");
    const avgScore =
      scored.length > 0
        ? Math.round(scored.reduce((sum, a) => sum + (a.score || 0), 0) / scored.length)
        : 0;
    const goodCount = scored.filter((a) => (a.score || 0) >= 80).length;
    return { total: audits.length, avgScore, goodCount };
  }, [audits]);

  const handleExportCSV = () => {
    const rows = [
      ["URL", "Score", "Type", "Status", "Date"],
      ...filtered.map((a) => [
        a.url,
        a.score ?? "N/A",
        a.audit_type || "single",
        a.status,
        new Date(a.created_at).toISOString(),
      ]),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `seo_audits_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-teal-500/10 to-transparent pointer-events-none" />

        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Audit Archive & Records</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Audit History & Reports</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Review, compare, and manage past inspections across all domains.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onStartNewAudit}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white text-xs font-bold shadow-md shadow-teal-500/30 transition-all active:scale-95 cursor-pointer"
          >
            <span>+ New Audit</span>
          </button>
        </div>
      </div>

      {/* Aggregate Stats Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-200/50">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800">{stats.total}</p>
            <p className="text-xs font-semibold text-slate-400">Total Audits Stored</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/50">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800">{stats.avgScore} / 100</p>
            <p className="text-xs font-semibold text-slate-400">Average SEO Health</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/50">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800">{stats.goodCount}</p>
            <p className="text-xs font-semibold text-slate-400">High-Scoring Audits (≥80)</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audits by URL or title..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <span className="px-2 text-slate-400 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Score:
            </span>
            {(["all", "good", "warn", "poor"] as const).map((sc) => (
              <button
                key={sc}
                onClick={() => setScoreFilter(sc)}
                className={`px-2.5 py-1 rounded-lg transition-all capitalize ${
                  scoreFilter === sc
                    ? "bg-white text-slate-900 shadow-xs"
                    : "hover:text-slate-900 text-slate-500"
                }`}
              >
                {sc === "good" ? "≥80" : sc === "warn" ? "50-79" : sc === "poor" ? "<50" : "All"}
              </button>
            ))}
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Modes</option>
            <option value="single">Single Page</option>
            <option value="multiple">Multiple Pages</option>
            <option value="crawl">Site Crawl</option>
            <option value="staging">Staging</option>
          </select>
        </div>
      </div>

      {/* Audit List Table / Cards */}
      {filtered.length === 0 ? (
        <div className="p-16 rounded-3xl bg-white border border-slate-200/80 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-700">No Audits Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {search || scoreFilter !== "all" || typeFilter !== "all"
              ? "No audits matched your current search or filter criteria."
              : "You haven't run any audits yet. Start an audit from the Studio!"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((audit) => {
            const sc = audit.score !== null ? scoreColor(audit.score) : null;
            return (
              <div
                key={audit.id}
                onClick={() => onSelectAudit(audit)}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-teal-300 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
              >
                {/* Left: Score Badge + Details */}
                <div className="flex items-center gap-4 min-w-0">
                  {audit.score !== null && sc ? (
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-lg border flex-shrink-0 ${sc.bg}/15 ${sc.text} border-current/20 shadow-xs`}
                    >
                      {audit.score}
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs bg-slate-100 text-slate-400 flex-shrink-0">
                      N/A
                    </div>
                  )}

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate group-hover:text-teal-700 transition-colors">
                        {audit.title || audit.url}
                      </p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase tracking-wider flex-shrink-0">
                        {audit.audit_type || "single"}
                      </span>
                    </div>

                    <p className="text-xs font-mono text-slate-400 truncate max-w-md sm:max-w-xl">
                      {audit.url}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(audit.created_at).toLocaleDateString()} at{" "}
                        {new Date(audit.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span>•</span>
                      <span
                        className={`capitalize font-semibold ${
                          audit.status === "completed"
                            ? "text-emerald-600"
                            : audit.status === "failed"
                            ? "text-rose-600"
                            : "text-amber-600"
                        }`}
                      >
                        {audit.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(audit.url, "_blank");
                    }}
                    title="Open live URL"
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAudit(audit.id);
                    }}
                    title="Delete audit"
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="p-2 rounded-xl text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

