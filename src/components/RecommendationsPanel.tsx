import { AlertCircle, Wrench, CheckCircle2 } from "lucide-react";
import { PRIORITY_META, type Recommendation } from "@/types";

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
}

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
  if (recommendations.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600">No critical issues found!</p>
        <p className="text-xs text-slate-400 mt-1">Your page passed all major SEO checks.</p>
      </div>
    );
  }

  const sorted = [...recommendations].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  const high = sorted.filter((r) => r.priority === "high").length;
  const medium = sorted.filter((r) => r.priority === "medium").length;
  const low = sorted.filter((r) => r.priority === "low").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wrench className="w-5 h-5 text-blue-500" />
        <h3 className="text-base font-semibold text-slate-800">Recommendations ({recommendations.length})</h3>
      </div>

      <div className="flex gap-2 flex-wrap">
        {high > 0 && <span className="text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-medium">{high} High</span>}
        {medium > 0 && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">{medium} Medium</span>}
        {low > 0 && <span className="text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-medium">{low} Low</span>}
      </div>

      <div className="space-y-3">
        {sorted.map((rec, i) => {
          const meta = PRIORITY_META[rec.priority];
          return (
            <div key={i} className={`rounded-xl border ${meta.border} ${meta.bg} p-4`}>
              <div className="flex items-start gap-3">
                <AlertCircle className={`w-5 h-5 ${meta.color} flex-shrink-0 mt-0.5`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-slate-800">{rec.title}</h4>
                    <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                  </div>
                  <p className="text-sm text-slate-600">{rec.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
