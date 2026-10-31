import { useState } from "react";
import {
  Server,
  ShieldCheck,
  Gauge,
  Link2,
  Boxes,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
} from "lucide-react";
import type { SemrushPillarData, SemrushPillarId, SemrushBottleneck } from "./semrushTypes";

interface SemrushThematicReportsProps {
  pillars: SemrushPillarData[];
  url: string;
  selectedPillarId?: SemrushPillarId;
  onOpenFixModal: (bottleneck: SemrushBottleneck) => void;
  resolvedIds?: Set<string>;
  onToggleResolve?: (checkId: string) => void;
}

const PILLAR_ICONS: Record<string, typeof Server> = {
  Server,
  ShieldCheck,
  Gauge,
  Link2,
  Boxes,
  FileText,
};

export function SemrushThematicReports({
  pillars,
  url,
  selectedPillarId = "crawlability",
  onOpenFixModal,
  resolvedIds,
  onToggleResolve,
}: SemrushThematicReportsProps) {
  const [activePillar, setActivePillar] = useState<SemrushPillarId>(selectedPillarId);

  const currentPillar = pillars.find((p) => p.id === activePillar) || pillars[0];
  const Icon = PILLAR_ICONS[currentPillar.icon] || Server;

  const scoreColor =
    currentPillar.score >= 80
      ? "text-emerald-600"
      : currentPillar.score >= 60
      ? "text-amber-600"
      : "text-rose-600";

  const strokeColor =
    currentPillar.score >= 80
      ? "#10b981"
      : currentPillar.score >= 60
      ? "#f59e0b"
      : "#f43f5e";

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (currentPillar.score / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Pillar Selector Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {pillars.map((p) => {
          const PIcon = PILLAR_ICONS[p.icon] || Server;
          const isActive = p.id === activePillar;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePillar(p.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/20 scale-[1.02]"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <PIcon className={`w-3.5 h-3.5 ${isActive ? "text-orange-400" : "text-slate-400"}`} />
              <span>{p.shortLabel}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {p.score}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Pillar Overview Banner */}
      <div className="p-6 rounded-3xl border border-slate-200/90 bg-white shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">
                  {currentPillar.label}
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Grade {currentPillar.grade}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentPillar.description}
              </p>
            </div>
          </div>

          {/* Radial Score Gauge */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="relative w-18 h-18 flex items-center justify-center">
              <svg className="w-18 h-18 -rotate-90">
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  stroke="#f1f5f9"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  stroke={strokeColor}
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <span className={`absolute text-sm font-black ${scoreColor}`}>
                {currentPillar.score}%
              </span>
            </div>
          </div>
        </div>

        {/* Diagnostic Stat Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Audited Checks</span>
            <span className="text-xl font-black text-slate-800 mt-0.5 block">{currentPillar.totalChecks}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Passed Checks</span>
            <span className="text-xl font-black text-emerald-900 mt-0.5 block">{currentPillar.passedCount}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Warnings</span>
            <span className="text-xl font-black text-amber-900 mt-0.5 block">{currentPillar.warnCount}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Critical Errors</span>
            <span className="text-xl font-black text-rose-900 mt-0.5 block">{currentPillar.failCount}</span>
          </div>
        </div>
      </div>

      {/* Checks List under this Pillar */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
          Detailed Check Results ({currentPillar.checks.length})
        </h4>

        <div className="space-y-2">
          {currentPillar.checks.map((check) => {
            const isResolved = resolvedIds?.has(check.id);
            const isActionable = check.status === "fail" || check.status === "warn";

            return (
              <div
                key={check.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isResolved
                    ? "bg-emerald-50/40 border-emerald-200"
                    : check.status === "fail"
                    ? "bg-white border-rose-200 hover:border-rose-300"
                    : check.status === "warn"
                    ? "bg-white border-amber-200 hover:border-amber-300"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5 flex-shrink-0">
                    {check.status === "fail" ? (
                      <XCircle className="w-4 h-4 text-rose-500" />
                    ) : check.status === "warn" ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isResolved ? "line-through text-slate-400" : "text-slate-900"}`}>
                        {check.label}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.2 rounded-full ${
                          check.status === "fail"
                            ? "bg-rose-100 text-rose-800"
                            : check.status === "warn"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {check.status === "fail" ? "Failed" : check.status === "warn" ? "Warning" : "Passed"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {check.detail}
                    </p>
                  </div>
                </div>

                {isActionable && (
                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                    {onToggleResolve && (
                      <button
                        type="button"
                        onClick={() => onToggleResolve(check.id)}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          isResolved ? "bg-emerald-100 text-emerald-700" : "text-slate-300 hover:text-emerald-600"
                        }`}
                        title={isResolved ? "Resolved" : "Mark resolved"}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        onOpenFixModal({
                          check,
                          guidance: {
                            whyItMatters: check.detail,
                            howToFix: "Apply standard technical SEO remediation.",
                            difficulty: check.status === "fail" ? "Medium (15 mins)" : "Easy (5 mins)",
                            impactBoost: check.status === "fail" ? 5 : 3,
                          },
                          affectedUrls: [url],
                          severity: check.status === "fail" ? "error" : "warning",
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                    >
                      <Wrench className="w-3 h-3" />
                      <span>Why & Fix</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
