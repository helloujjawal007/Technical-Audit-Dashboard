import {
  TrendingUp,
  XCircle,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import type { SemrushBottleneck } from "./semrushTypes";

interface SemrushTopBottlenecksProps {
  bottlenecks: SemrushBottleneck[];
  onOpenFixModal: (bottleneck: SemrushBottleneck) => void;
  resolvedIds?: Set<string>;
  onToggleResolve?: (checkId: string) => void;
}

export function SemrushTopBottlenecks({
  bottlenecks,
  onOpenFixModal,
  resolvedIds,
  onToggleResolve,
}: SemrushTopBottlenecksProps) {
  // Show top 5 action items
  const topItems = bottlenecks.slice(0, 5);

  if (topItems.length === 0) {
    return (
      <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/40 p-6 text-center space-y-2">
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <Sparkles className="w-5 h-5 text-emerald-600" />
        </div>
        <h4 className="text-base font-extrabold text-slate-900">
          No Critical Technical Bottlenecks Found!
        </h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Your page satisfies all core technical, indexing, and on-page criteria with zero high-priority errors.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Top Bottlenecks to Fix First
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked by search ranking impact and estimated Site Health score boost
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {topItems.map((item) => {
          const { check, guidance, severity } = item;
          const isResolved = resolvedIds?.has(check.id);

          return (
            <div
              key={check.id}
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isResolved
                  ? "bg-emerald-50/50 border-emerald-200/80 shadow-xs"
                  : severity === "error"
                  ? "bg-white border-rose-200/80 hover:border-rose-300 hover:shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              {/* Left Details */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="mt-0.5 flex-shrink-0">
                  {severity === "error" ? (
                    <XCircle className="w-5 h-5 text-rose-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  )}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4
                      className={`text-sm font-bold truncate ${
                        isResolved ? "text-slate-400 line-through" : "text-slate-900"
                      }`}
                    >
                      {check.label}
                    </h4>

                    <span
                      className={`text-[10px] uppercase font-black px-2 py-0.2 rounded-full ${
                        severity === "error"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {severity === "error" ? "Critical Error" : "Warning"}
                    </span>

                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.2 rounded-md">
                      {check.category}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">
                    {check.detail}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {guidance.difficulty}
                    </span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      +{guidance.impactBoost}% Health Boost
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                {onToggleResolve && (
                  <button
                    type="button"
                    onClick={() => onToggleResolve(check.id)}
                    className={`p-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isResolved
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                    title={isResolved ? "Mark as unresolved" : "Mark as resolved"}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenFixModal(item)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Why & How to Fix</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

