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
  Plus,
  Compass,
} from "lucide-react";
import type { AuditRow } from "@/types";
import { scoreColor } from "@/types";
import { SAMPLE_AUDIT_ROWS } from "@/lib/benchmarkData";

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
  const [includeBenchmarks, setIncludeBenchmarks] = useState(true);

  // If user has zero audits, automatically show benchmarks so the page is never blank
  const effectiveAudits = useMemo(() => {
    if (audits.length === 0) {
      return SAMPLE_AUDIT_ROWS;
    }
    if (includeBenchmarks) {
      // Merge unique
      const existingUrls = new Set(audits.map((a) => a.url));
      const nonDuplicateBenchmarks = SAMPLE_AUDIT_ROWS.filter((b) => !existingUrls.has(b.url));
      return [...audits, ...nonDuplicateBenchmarks];
    }
    return audits;
  }, [audits, includeBenchmarks]);

  const isShowingSampleFallback = audits.length === 0;

  const filtered = useMemo(() => {
    return effectiveAudits.filter((a) => {
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
  }, [effectiveAudits, search, scoreFilter, typeFilter]);

  const stats = useMemo(() => {
    const scored = effectiveAudits.filter((a) => typeof a.score === "number");
    const avgScore =
      scored.length > 0
        ? Math.round(scored.reduce((sum, a) => sum + (a.score || 0), 0) / scored.length)
        : 0;
    const goodCount = scored.filter((a) => (a.score || 0) >= 80).length;
    return { total: effectiveAudits.length, avgScore, goodCount };
  }, [effectiveAudits]);

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
            <span>Audit Archive & Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Audit History & Reports</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Review past inspections, monitor score evolutions over time, and export CSV audit manifests.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10">
          <button
            type="button"
            onClick={onStartNewAudit}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-teal-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Run New Audit</span>
          </button>
        </div>
      </div>

      {/* Demo Notice Banner if using initial benchmark showcase */}
      {isShowingSampleFallback && (
        <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-100 text-teal-700">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-teal-950">Pre-Populated Industry Benchmark Audits</p>
              <p className="text-teal-700">
                You haven't run any custom scans yet, so we loaded industry benchmark audits (Stripe, GitHub, Acme Shop) for you to inspect.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onStartNewAudit}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            Scan Your Own URL
          </button>
        </div>
      )}

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Total Audits Cataloged
            </span>
            <span className="text-3xl font-black text-slate-900 font-mono">{stats.total}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Globe className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Average SEO Health Score
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-teal-600 font-mono">{stats.avgScore}</span>
              <span className="text-xs font-bold text-slate-400">/ 100</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              High Performance Audits (≥80)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-600 font-mono">{stats.goodCount}</span>
              <span className="text-xs text-slate-400 font-medium">of {stats.total}</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audited URLs, titles, keywords..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
            />
          </div>

          {/* Export and Benchmarks Toggle */}
          <div className="flex items-center gap-2">
            {audits.length > 0 && (
              <button
                type="button"
                onClick={() => setIncludeBenchmarks(!includeBenchmarks)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${
                  includeBenchmarks
                    ? "bg-teal-50 text-teal-700 border-teal-200"
                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                }`}
              >
                {includeBenchmarks ? "Benchmarks Included" : "Include Benchmarks"}
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Score Tier:
          </span>
          {(
            [
              { id: "all", label: "All Tiers", count: effectiveAudits.length },
              { id: "good", label: "Good (≥80)", count: effectiveAudits.filter((a) => (a.score || 0) >= 80).length },
              { id: "warn", label: "Moderate (50-79)", count: effectiveAudits.filter((a) => (a.score || 0) >= 50 && (a.score || 0) < 80).length },
              { id: "poor", label: "Needs Work (<50)", count: effectiveAudits.filter((a) => (a.score || 0) < 50).length },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setScoreFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                scoreFilter === f.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
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
            No audits matched your current search criteria.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setScoreFilter("all");
              setTypeFilter("all");
            }}
            className="mt-2 text-xs font-bold text-teal-600 hover:underline"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((audit) => {
            const sc = audit.score !== null ? scoreColor(audit.score) : null;
            const isBenchmark = audit.id.startsWith("benchmark-");

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
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border flex-shrink-0 ${sc.bg}/15 ${sc.text} border-current/20 shadow-xs`}
                    >
                      {audit.score}
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs bg-slate-100 text-slate-400 flex-shrink-0">
                      N/A
                    </div>
                  )}

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-800 truncate group-hover:text-teal-700 transition-colors">
                        {audit.title || audit.url}
                      </p>
                      {isBenchmark && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-200/60 uppercase tracking-wider flex-shrink-0">
                          Benchmark Profile
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase tracking-wider flex-shrink-0">
                        {audit.audit_depth || "deep"}
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
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>

                  {!isBenchmark && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAudit(audit.id);
                      }}
                      title="Delete audit"
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

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
