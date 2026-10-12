import { useState } from "react";
import { Link2, ExternalLink, ArrowRight, Check, X } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import type { LinkAnalysis } from "@/types";

interface LinkAnalysisPanelProps {
  linkAnalysis: LinkAnalysis;
}

export function LinkAnalysisPanel({ linkAnalysis }: LinkAnalysisPanelProps) {
  const [tab, setTab] = useState<"internal" | "external" | "dofollow" | "nofollow">("internal");

  const tabs = [
    { id: "internal" as const, label: "Internal", count: linkAnalysis?.internal?.length || 0, icon: ArrowRight },
    { id: "external" as const, label: "External", count: linkAnalysis?.external?.length || 0, icon: ExternalLink },
    { id: "dofollow" as const, label: "Dofollow", count: linkAnalysis?.dofollow?.length || 0, icon: Check },
    { id: "nofollow" as const, label: "Nofollow", count: linkAnalysis?.nofollow?.length || 0, icon: X },
  ];

  const current = linkAnalysis?.[tab] || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="w-5 h-5 text-blue-500" />
        <h3 className="text-base font-semibold text-slate-800">Link Analysis ({linkAnalysis?.total || 0} total)</h3>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                tab === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              <span className="ml-1 text-slate-400">{t.count}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {current.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No {tab} links found.</div>
        ) : (
          current.map((link, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-white hover:bg-slate-50 transition-colors">
              {tab === "internal" ? <ArrowRight className="w-4 h-4 text-blue-400 flex-shrink-0" /> :
               tab === "external" ? <ExternalLink className="w-4 h-4 text-violet-400 flex-shrink-0" /> :
               tab === "dofollow" ? <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /> :
               <X className="w-4 h-4 text-rose-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 truncate">{link.text || "(no anchor text)"}</p>
                <p className="text-xs text-slate-400 truncate font-mono">{link.href}</p>
              </div>
              <CopyButton text={link.href} />
              {"rel" in link && link.rel && (
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">{link.rel}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
