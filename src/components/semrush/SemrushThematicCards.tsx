import {
  Server,
  ShieldCheck,
  Gauge,
  Link2,
  Boxes,
  FileText,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import type { SemrushPillarData, SemrushPillarId } from "./semrushTypes";

interface SemrushThematicCardsProps {
  pillars: SemrushPillarData[];
  onSelectPillar: (pillarId: SemrushPillarId) => void;
  activePillarId?: SemrushPillarId | null;
}

const PILLAR_ICONS: Record<string, typeof Server> = {
  Server,
  ShieldCheck,
  Gauge,
  Link2,
  Boxes,
  FileText,
};

export function SemrushThematicCards({
  pillars,
  onSelectPillar,
  activePillarId,
}: SemrushThematicCardsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
            Thematic Health Pillars
          </h3>
          <p className="text-xs text-slate-400">
            SEMrush core diagnostic categories evaluating technical, indexing, and on-page integrity
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {pillars.map((pillar) => {
          const Icon = PILLAR_ICONS[pillar.icon] || Server;
          const isSelected = activePillarId === pillar.id;

          const scoreColor =
            pillar.score >= 80
              ? "text-emerald-600"
              : pillar.score >= 60
              ? "text-amber-600"
              : "text-rose-600";

          const strokeColor =
            pillar.score >= 80
              ? "#10b981"
              : pillar.score >= 60
              ? "#f59e0b"
              : "#f43f5e";

          const bgBadge =
            pillar.status === "good"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : pillar.status === "fair"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-rose-50 text-rose-700 border-rose-200";

          // Calculate circular progress svg
          const radius = 24;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (pillar.score / 100) * circumference;

          return (
            <div
              key={pillar.id}
              onClick={() => onSelectPillar(pillar.id)}
              className={`group p-4 rounded-3xl border transition-all duration-200 cursor-pointer text-left relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? "bg-gradient-to-br from-indigo-50/70 via-white to-white border-indigo-400 shadow-md ring-2 ring-indigo-500/20"
                  : "bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 group-hover:bg-slate-200"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {pillar.shortLabel}
                    </h4>
                    <span
                      className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.2 rounded-full border mt-0.5 ${bgBadge}`}
                    >
                      {pillar.status.toUpperCase()} ({pillar.grade})
                    </span>
                  </div>
                </div>

                {/* Circular Mini Gauge */}
                <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
                  <svg className="w-14 h-14 -rotate-90">
                    <circle
                      cx="28"
                      cy="28"
                      r={radius}
                      stroke="#f1f5f9"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r={radius}
                      stroke={strokeColor}
                      strokeWidth="5"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <span className={`absolute text-xs font-black ${scoreColor}`}>
                    {pillar.score}%
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                {pillar.description}
              </p>

              {/* Counts & Details link */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  {pillar.failCount > 0 ? (
                    <span className="flex items-center gap-1 text-rose-600">
                      <XCircle className="w-3 h-3 text-rose-500" />
                      {pillar.failCount}
                    </span>
                  ) : null}
                  {pillar.warnCount > 0 ? (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      {pillar.warnCount}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    {pillar.passedCount}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-indigo-600 font-bold group-hover:translate-x-0.5 transition-transform">
                  <span>Explore</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

