import { useState, useMemo } from "react";
import { AlertCircle, Wrench, CheckCircle2, Flame, ShieldAlert, Info, Sparkles } from "lucide-react";
import { PRIORITY_META, type Recommendation } from "@/types";

type Priority = "high" | "medium" | "low";

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
}

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
  const [filter, setFilter] = useState<Priority | "all">("all");

  const safeRecommendations = useMemo(() => recommendations || [], [recommendations]);

  const sorted = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 };
    return [...safeRecommendations].sort((a, b) => order[a.priority] - order[b.priority]);
  }, [safeRecommendations]);

  const high = useMemo(() => sorted.filter((r) => r.priority === "high").length, [sorted]);
  const medium = useMemo(() => sorted.filter((r) => r.priority === "medium").length, [sorted]);
  const low = useMemo(() => sorted.filter((r) => r.priority === "low").length, [sorted]);

  const filtered = useMemo(() => {
    if (filter === "all") return sorted;
    return sorted.filter((r) => r.priority === filter);
  }, [sorted, filter]);

  if (safeRecommendations.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-md p-10 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 border border-emerald-100 flex items-center justify-center mx-auto mb-3 shadow-sm">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h4 className="text-base font-bold text-slate-800">No Critical Bottlenecks Found!</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Your page passed all major SEO, speed, meta tags, and indexing audits without critical flags.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header card with summary & filter pills */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-md p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Actionable Fix Recommendations
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                {recommendations.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Ranked systematically by impact on technical search visibility and rank
            </p>
          </div>
        </div>

        {/* Priority Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              filter === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({recommendations.length})
          </button>
          {high > 0 && (
            <button
              type="button"
              onClick={() => setFilter("high")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                filter === "high"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100"
              }`}
            >
              <Flame className="w-3 h-3" />
              {high} High
            </button>
          )}
          {medium > 0 && (
            <button
              type="button"
              onClick={() => setFilter("medium")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                filter === "medium"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100"
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              {medium} Medium
            </button>
          )}
          {low > 0 && (
            <button
              type="button"
              onClick={() => setFilter("low")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                filter === "low"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100"
              }`}
            >
              <Info className="w-3 h-3" />
              {low} Low
            </button>
          )}
        </div>
      </div>

      {/* Recommendations Cards */}
      <div className="space-y-3">
        {filtered.map((rec, i) => {
          const meta = PRIORITY_META[rec.priority];
          return (
            <div
              key={i}
              className={`rounded-2xl border ${meta.border} ${meta.bg} p-4.5 shadow-sm hover:shadow-md transition-all duration-200`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`p-2 rounded-xl bg-white shadow-xs border ${meta.border} mt-0.5`}>
                  <AlertCircle className={`w-4 h-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <h4 className="text-sm font-bold text-slate-900 tracking-tight">{rec.title}</h4>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${meta.color} bg-white/90 border ${meta.border}`}
                    >
                      {rec.priority === "high" && <Sparkles className="w-2.5 h-2.5" />}
                      {meta.label} Priority
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{rec.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
