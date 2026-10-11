import { KeyRound, TrendingUp } from "lucide-react";
import { KEYWORD_TYPE_META, type KeywordInfo } from "@/types";

interface KeywordPanelProps {
  keywords: KeywordInfo[];
}

export function KeywordPanel({ keywords }: KeywordPanelProps) {
  if (keywords.length === 0) {
    return <div className="text-center py-12 text-slate-400 text-sm">No keywords could be extracted from the page content.</div>;
  }

  const primary = keywords.filter((k) => k.type === "primary");
  const secondary = keywords.filter((k) => k.type === "secondary");
  const supporting = keywords.filter((k) => k.type === "supporting");

  const maxDensity = Math.max(...keywords.map((k) => k.density), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-blue-500" />
        <h3 className="text-base font-semibold text-slate-800">Keyword Analysis</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CountCard label="Primary Keywords" count={primary.length} color="text-blue-600" bg="bg-blue-50" />
        <CountCard label="Secondary Keywords" count={secondary.length} color="text-violet-600" bg="bg-violet-50" />
        <CountCard label="Supporting Keywords" count={supporting.length} color="text-slate-600" bg="bg-slate-50" />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-slate-400" />
          <h4 className="text-sm font-semibold text-slate-700">Keyword Density</h4>
        </div>
        <div className="space-y-2">
          {keywords.map((kw, i) => {
            const meta = KEYWORD_TYPE_META[kw.type];
            const barWidth = (kw.density / maxDensity) * 100;
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="w-32 flex-shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${meta.bg} ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700 truncate">{kw.keyword}</span>
                    <span className="text-xs text-slate-400 ml-2 flex-shrink-0">{kw.density}% ({kw.count}x)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${kw.type === "primary" ? "bg-blue-500" : kw.type === "secondary" ? "bg-violet-500" : "bg-slate-400"} transition-all duration-500`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-600">Note:</strong> Search Volume (SV) and Keyword Difficulty (KD) require
          integration with a keyword research API (e.g. Ahrefs, SEMrush, Google Keyword Planner). The density shown
          is calculated from the page's extracted text content. Ideal primary keyword density is 0.5-3%.
        </p>
      </div>
    </div>
  );
}

function CountCard({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div className={`rounded-xl ${bg} p-4`}>
      <p className={`text-2xl font-bold ${color}`}>{count}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
