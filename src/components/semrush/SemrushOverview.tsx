import {
  Globe,
  Activity,
  Gauge,
  Link2,
  Boxes,
} from "lucide-react";
import type { AuditResult } from "@/types";
import {
  type SemrushPillarData,
  type SemrushPillarId,
  type SemrushBottleneck,
} from "./semrushTypes";
import { SemrushTopBottlenecks } from "./SemrushTopBottlenecks";
import { SemrushThematicCards } from "./SemrushThematicCards";
import { SemrushSerpSimulator } from "./SemrushSerpSimulator";

interface SemrushOverviewProps {
  result: AuditResult;
  url: string;
  pillars: SemrushPillarData[];
  bottlenecks: SemrushBottleneck[];
  onSelectPillar: (pillarId: SemrushPillarId) => void;
  onOpenFixModal: (bottleneck: SemrushBottleneck) => void;
  resolvedIds?: Set<string>;
  onToggleResolve?: (checkId: string) => void;
}

export function SemrushOverview({
  result,
  url,
  pillars,
  bottlenecks,
  onSelectPillar,
  onOpenFixModal,
  resolvedIds,
  onToggleResolve,
}: SemrushOverviewProps) {
  const hasSchemaFaq = (result.schema || []).some((s) => s.type.toLowerCase().includes("faq"));
  const hasSchemaRating = (result.schema || []).some(
    (s) => s.type.toLowerCase().includes("review") || s.type.toLowerCase().includes("rating") || s.type.toLowerCase().includes("product")
  );

  return (
    <div className="space-y-6">
      {/* 1. Prioritized Top Bottlenecks (SEMrush Action Plan) */}
      <SemrushTopBottlenecks
        bottlenecks={bottlenecks}
        onOpenFixModal={onOpenFixModal}
        resolvedIds={resolvedIds}
        onToggleResolve={onToggleResolve}
      />

      {/* 2. Thematic Health Pillars (6 Cards) */}
      <SemrushThematicCards
        pillars={pillars}
        onSelectPillar={onSelectPillar}
      />

      {/* 3. Google SERP Simulator (Desktop & Mobile Preview with Pixel Meters) */}
      <SemrushSerpSimulator
        url={url}
        initialTitle={result.title}
        initialDescription={result.description}
        hasSchemaRating={hasSchemaRating}
        hasSchemaFaq={hasSchemaFaq}
      />

      {/* 4. Core Technical Telemetry Matrix */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
          Core Technical Health Telemetry
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Protocol</span>
            <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-500" />
              <span>{url.startsWith("https") ? "HTTPS (SSL)" : "HTTP"}</span>
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Server TTFB</span>
            <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-500" />
              <span>{result.pageSpeed?.responseTimeMs || 0}ms</span>
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">HTML Payload</span>
            <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-indigo-500" />
              <span>{((result.pageSpeed?.htmlSizeBytes || 0) / 1024).toFixed(1)} KB</span>
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Internal Links</span>
            <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-purple-500" />
              <span>{result.linkAnalysis?.internal?.length || 0}</span>
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">External Links</span>
            <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-amber-500" />
              <span>{result.linkAnalysis?.external?.length || 0}</span>
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Schemas</span>
            <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-emerald-500" />
              <span>{(result.schema || []).length} Types</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
