import { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Circle,
  CheckCircle,
  Search,
  X,
  Sparkles,
  ChevronsUpDown,
} from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER, STATUS_META, type CheckCategory, type CheckResult } from "@/types";
import { CopyButton } from "@/components/CopyButton";

const STATUS_ICONS = {
  pass: CheckCircle2,
  fail: XCircle,
  warn: AlertTriangle,
  info: Info,
};

type FilterStatus = "all" | "actionable" | "fail" | "warn" | "pass" | "resolved";

interface ChecklistProps {
  checks: CheckResult[];
  auditId?: string;
}

export function Checklist({ checks, auditId }: ChecklistProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    if (auditId) {
      try {
        const stored = localStorage.getItem(`audit-tasks-${auditId}`);
        if (stored) setResolved(new Set(JSON.parse(stored)));
      } catch { /* ignore */ }
    }
  }, [auditId]);

  useEffect(() => {
    if (auditId) {
      try {
        localStorage.setItem(`audit-tasks-${auditId}`, JSON.stringify([...resolved]));
      } catch { /* ignore */ }
    }
  }, [resolved, auditId]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleResolved = (id: string) => {
    setResolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const safeChecks = useMemo(() => checks || [], [checks]);

  const actionableChecks = useMemo(() => {
    return safeChecks.filter((c) => c.status === "fail" || c.status === "warn");
  }, [safeChecks]);

  const resolvedCount = useMemo(() => {
    return actionableChecks.filter((c) => resolved.has(c.id)).length;
  }, [actionableChecks, resolved]);

  const progressPct = actionableChecks.length > 0
    ? Math.round((resolvedCount / actionableChecks.length) * 100)
    : 0;

  // Filter items
  const filteredChecks = useMemo(() => {
    return safeChecks.filter((c) => {
      // Category filter
      if (selectedCategory !== "all" && c.category !== selectedCategory) return false;

      // Status filter
      const isResolved = resolved.has(c.id);
      if (statusFilter === "actionable" && (c.status !== "fail" && c.status !== "warn")) return false;
      if (statusFilter === "fail" && c.status !== "fail") return false;
      if (statusFilter === "warn" && c.status !== "warn") return false;
      if (statusFilter === "pass" && c.status !== "pass") return false;
      if (statusFilter === "resolved" && !isResolved) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLabel = (c.label || "").toLowerCase().includes(q);
        const matchesDetail = (c.detail || "").toLowerCase().includes(q);
        const matchesVal = (c.value || "").toLowerCase().includes(q);
        if (!matchesLabel && !matchesDetail && !matchesVal) return false;
      }

      return true;
    });
  }, [safeChecks, selectedCategory, statusFilter, resolved, searchQuery]);

  // Group filtered checks by category
  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      items: filteredChecks.filter((c) => c.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [filteredChecks]);

  const toggleAllExpanded = () => {
    if (expanded.size > 0) {
      setExpanded(new Set());
    } else {
      const allWithValues = safeChecks.filter((c) => c.value && c.value.trim()).map((c) => c.id);
      setExpanded(new Set(allWithValues));
    }
  };

  const markAllActionableResolved = () => {
    setResolved(new Set(actionableChecks.map((c) => c.id)));
  };

  const clearAllResolved = () => {
    setResolved(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Modern Task Progress Card */}
      {actionableChecks.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-md p-5 shadow-sm">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-gradient-to-br from-emerald-200/30 to-teal-300/20 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-800 tracking-tight">Audit Remediation Progress</h4>
                  {progressPct === 100 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full animate-bounce">
                      <Sparkles className="w-3 h-3" /> All Done!
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {resolvedCount} of {actionableChecks.length} action items resolved
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={markAllActionableResolved}
                className="px-2.5 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg font-medium transition-colors border border-slate-200/80"
              >
                Mark all resolved
              </button>
              {resolved.size > 0 && (
                <button
                  type="button"
                  onClick={clearAllResolved}
                  className="px-2.5 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition-colors"
                >
                  Reset
                </button>
              )}
              <span className="text-sm font-extrabold text-slate-900 font-mono px-2 py-0.5 bg-slate-100 rounded-md">
                {progressPct}%
              </span>
            </div>
          </div>

          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-100">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-400 mt-2.5">
            Click the resolution circle next to any failed or warning check as you apply fixes to your code. Your checklist state persists automatically.
          </p>
        </div>
      )}

      {/* Modern Filter & Search Controls */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-md p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter checklist items, meta tags, schema..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
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

          {/* Quick Actions */}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={toggleAllExpanded}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
              {expanded.size > 0 ? "Collapse Details" : "Expand All Details"}
            </button>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Status:</span>
          {(
            [
              { id: "all", label: "All", count: safeChecks.length },
              { id: "actionable", label: "Actionable", count: actionableChecks.length },
              { id: "fail", label: "Failed", count: safeChecks.filter((c) => c.status === "fail").length },
              { id: "warn", label: "Warnings", count: safeChecks.filter((c) => c.status === "warn").length },
              { id: "pass", label: "Passed", count: safeChecks.filter((c) => c.status === "pass").length },
              { id: "resolved", label: "Resolved", count: resolved.size },
            ] as const
          ).map((filter) => {
            const isActive = statusFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70"
                }`}
              >
                <span>{filter.label}</span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Category Pill Filters */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Category:</span>
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
              selectedCategory === "all"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            All Categories
          </button>
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {CATEGORY_LABELS[cat as CheckCategory]}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {grouped.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-white/50">
          <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-700">No checklist items match your filters</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query, status filter, or category selector above.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setSelectedCategory("all");
            }}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg shadow-sm hover:bg-slate-800 transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      )}

      {/* Grouped Checklist Sections */}
      {grouped.map((group) => {
        const counts = group.items.reduce(
          (acc, c) => {
            acc[c.status] = (acc[c.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        return (
          <div key={group.category} className="space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200/70">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {CATEGORY_LABELS[group.category as CheckCategory]}
                </h3>
                <span className="text-xs text-slate-400 font-mono">({group.items.length})</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                {(["pass", "warn", "fail", "info"] as const).map((s) =>
                  counts[s] ? (
                    <span key={s} className={`inline-flex items-center gap-1 font-medium ${STATUS_META[s].color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[s].dot}`} />
                      {counts[s]}
                    </span>
                  ) : null,
                )}
              </div>
            </div>

            <div className="space-y-2">
              {group.items.map((check) => {
                const meta = STATUS_META[check.status];
                const Icon = STATUS_ICONS[check.status];
                const isExpanded = expanded.has(check.id);
                const hasValue = Boolean(check.value && check.value.trim());
                const isActionable = check.status === "fail" || check.status === "warn";
                const isResolved = resolved.has(check.id);

                return (
                  <div
                    key={check.id}
                    className={`group rounded-xl border transition-all duration-200 overflow-hidden ${
                      isResolved
                        ? "bg-emerald-50/40 border-emerald-200/70 shadow-[0_1px_3px_rgba(16,185,129,0.06)]"
                        : `${meta.bg} border-slate-200/80 hover:border-slate-300 hover:shadow-sm`
                    }`}
                  >
                    <div
                      className={`flex items-start gap-3 p-3.5 ${
                        hasValue ? "cursor-pointer select-none" : ""
                      }`}
                      onClick={hasValue ? () => toggle(check.id) : undefined}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <Icon className={`w-5 h-5 ${isResolved ? "text-emerald-500" : meta.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={`text-sm font-semibold transition-colors ${
                              isResolved ? "text-slate-400 line-through" : "text-slate-900"
                            }`}
                          >
                            {check.label}
                          </p>
                          <span
                            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${
                              isResolved
                                ? "bg-emerald-100 text-emerald-800"
                                : `${meta.color} bg-white/70 border border-slate-200/60`
                            }`}
                          >
                            {isResolved ? "Resolved" : meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{check.detail}</p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                        {isActionable && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleResolved(check.id);
                            }}
                            className={`p-1 rounded-lg transition-all ${
                              isResolved
                                ? "text-emerald-600 bg-emerald-100/70 hover:bg-emerald-200"
                                : "text-slate-300 hover:text-emerald-600 hover:bg-white"
                            }`}
                            title={isResolved ? "Mark as pending" : "Mark as resolved"}
                          >
                            {isResolved ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </button>
                        )}
                        {hasValue && (
                          <div className="p-1 text-slate-400 group-hover:text-slate-600 transition-colors">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {hasValue && isExpanded && (
                      <div className="px-4 pb-4 pt-1 pl-11 animate-fadeIn">
                        <div className="relative rounded-xl border border-slate-200/80 bg-slate-900 text-slate-100 p-3.5 font-mono text-xs shadow-inner">
                          <div className="absolute top-2.5 right-2.5">
                            <CopyButton
                              text={check.value || ""}
                              label="Copy data"
                              className="text-slate-400 hover:text-white hover:bg-slate-800"
                            />
                          </div>
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                            Detected Value / Payload:
                          </div>
                          <pre className="whitespace-pre-wrap break-words overflow-x-auto text-slate-200 font-mono text-[11px] leading-relaxed">
                            {check.value}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
