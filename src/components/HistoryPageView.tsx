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
  AlertTriangle,
  User,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import type { AuditRow } from "@/types";
import { scoreColor } from "@/types";
import { SAMPLE_AUDIT_ROWS } from "@/lib/benchmarkData";

interface HistoryPageViewProps {
  audits: AuditRow[];
  userEmail?: string | null;
  onSelectAudit: (audit: AuditRow) => void;
  onDeleteAudit: (id: string) => void;
  onDeleteSelected?: (ids: string[]) => void;
  onClearAllHistory?: () => void;
  onStartNewAudit: () => void;
}

export function HistoryPageView({
  audits,
  userEmail,
  onSelectAudit,
  onDeleteAudit,
  onDeleteSelected,
  onClearAllHistory,
  onStartNewAudit,
}: HistoryPageViewProps) {
  const [activeTab, setActiveTab] = useState<"user" | "benchmarks">(
    audits.length > 0 ? "user" : "user"
  );
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<"all" | "good" | "warn" | "poor">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Tab dataset
  const currentDataset = useMemo(() => {
    if (activeTab === "benchmarks") {
      return SAMPLE_AUDIT_ROWS;
    }
    return audits;
  }, [activeTab, audits]);

  // Filtered dataset
  const filtered = useMemo(() => {
    return currentDataset.filter((a) => {
      // Search
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

      return true;
    });
  }, [currentDataset, search, scoreFilter]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const scored = audits.filter((a) => typeof a.score === "number");
    const avgScore =
      scored.length > 0
        ? Math.round(scored.reduce((sum, a) => sum + (a.score || 0), 0) / scored.length)
        : 0;
    const goodCount = scored.filter((a) => (a.score || 0) >= 80).length;
    return { total: audits.length, avgScore, goodCount };
  }, [audits]);

  // Selection toggles
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (onDeleteSelected) {
      onDeleteSelected(ids);
    } else {
      ids.forEach((id) => onDeleteAudit(id));
    }
    setSelectedIds(new Set());
  };

  const handleConfirmClearAll = () => {
    if (onClearAllHistory) {
      onClearAllHistory();
    }
    setSelectedIds(new Set());
    setShowClearConfirm(false);
  };

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
    link.setAttribute("download", `seo_audits_${activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-teal-500/10 to-transparent pointer-events-none" />

        <div className="space-y-1.5 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30">
            <User className="w-3.5 h-3.5" />
            <span>{userEmail ? `User Account: ${userEmail}` : "Personal Audit Vault"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Audit History & Archive</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Manage your personal inspections, delete outdated audit logs, and benchmark against industry leaders.
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

      {/* Aggregate KPI Summary Cards (User history) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              My Saved Audits
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
              Average SEO Health
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
              High Performers (≥80)
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

      {/* Primary Scope Tabs: My History vs Benchmark Demos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-200/60 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("user");
              setSelectedIds(new Set());
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "user"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <User className="w-4 h-4 text-teal-600" />
            <span>My Personal History ({audits.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("benchmarks");
              setSelectedIds(new Set());
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "benchmarks"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <Compass className="w-4 h-4 text-teal-600" />
            <span>Industry Benchmarks ({SAMPLE_AUDIT_ROWS.length})</span>
          </button>
        </div>

        {/* Bulk Delete & Clear All Actions for Personal History */}
        {activeTab === "user" && audits.length > 0 && (
          <div className="flex items-center gap-2 pr-1">
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All History</span>
            </button>
          </div>
        )}
      </div>

      {/* Search & Score Filter Controls */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audited URLs, page titles, domains..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Score Filter:
            </span>
            {(
              [
                { id: "all", label: "All", count: currentDataset.length },
                { id: "good", label: "Good (≥80)", count: currentDataset.filter((a) => (a.score || 0) >= 80).length },
                { id: "warn", label: "Moderate (50-79)", count: currentDataset.filter((a) => (a.score || 0) >= 50 && (a.score || 0) < 80).length },
                { id: "poor", label: "Needs Attention (<50)", count: currentDataset.filter((a) => (a.score || 0) < 50).length },
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

          {activeTab === "user" && filtered.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-semibold text-slate-600 hover:text-teal-700 flex items-center gap-1.5 cursor-pointer"
            >
              {selectedIds.size === filtered.length ? (
                <CheckSquare className="w-4 h-4 text-teal-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{selectedIds.size === filtered.length ? "Deselect All" : "Select All"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Audit Records List */}
      {filtered.length === 0 ? (
        <div className="p-16 rounded-3xl bg-white border border-slate-200/80 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto text-teal-600">
            <Globe className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              {activeTab === "user"
                ? `No Audits Found for ${userEmail || "Your Account"}`
                : "No Benchmark Audits Match Filter"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {activeTab === "user"
                ? "You haven't run any inspections under your account yet. Run an audit in the Studio to start your history log, or view benchmark profiles."
                : "No benchmark profiles matched your current search."}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={onStartNewAudit}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Run Audit in Studio
            </button>
            {activeTab === "user" && (
              <button
                type="button"
                onClick={() => setActiveTab("benchmarks")}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Explore Benchmark Profiles
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((audit) => {
            const sc = audit.score !== null ? scoreColor(audit.score) : null;
            const isBenchmark = audit.id.startsWith("benchmark-");
            const isSelected = selectedIds.has(audit.id);

            return (
              <div
                key={audit.id}
                onClick={() => onSelectAudit(audit)}
                className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group shadow-xs hover:shadow-md ${
                  isSelected ? "border-teal-400 bg-teal-50/20" : "border-slate-200/80 hover:border-teal-300"
                }`}
              >
                {/* Left: Checkbox + Score + Details */}
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Select Checkbox (only on user tab) */}
                  {activeTab === "user" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectOne(audit.id);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-teal-600 transition-colors flex-shrink-0 cursor-pointer"
                      title={isSelected ? "Deselect" : "Select for bulk action"}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-teal-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                    </button>
                  )}

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
                          Industry Benchmark
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
                      disabled={deletingId === audit.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingId(audit.id);
                        onDeleteAudit(audit.id);
                      }}
                      title="Delete this audit from history"
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer disabled:opacity-50"
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

      {/* Confirmation Modal for Clear All History */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-slate-900">
                Delete All Personal Audit History?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This will permanently delete all {audits.length} audit records associated with your account (
                <strong className="text-slate-800">{userEmail || "your login"}</strong>). This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
