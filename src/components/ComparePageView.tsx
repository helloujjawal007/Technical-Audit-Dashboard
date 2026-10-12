import { useState, useMemo } from "react";
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Zap,
} from "lucide-react";
import type { AuditRow } from "@/types";
import { CATEGORY_ORDER, CATEGORY_LABELS } from "@/types";
import { SAMPLE_AUDIT_ROWS } from "@/lib/benchmarkData";

interface ComparePageViewProps {
  audits: AuditRow[];
  onSelectAudit: (audit: AuditRow) => void;
}

export function ComparePageView({ audits, onSelectAudit }: ComparePageViewProps) {
  // Always combine user audits with rich benchmark profiles so comparison is never blank
  const completedAudits = useMemo(() => {
    const userCompleted = audits.filter((a) => a.result_data && a.score !== null);
    const existingIds = new Set(userCompleted.map((a) => a.id));
    const nonDupeBenchmarks = SAMPLE_AUDIT_ROWS.filter((b) => !existingIds.has(b.id));
    return [...userCompleted, ...nonDupeBenchmarks];
  }, [audits]);

  // Default to Pre vs Post optimization benchmark
  const [auditIdA, setAuditIdA] = useState<string>("benchmark-pre-opt");
  const [auditIdB, setAuditIdB] = useState<string>("benchmark-post-opt");

  const auditA = useMemo(
    () => completedAudits.find((a) => a.id === auditIdA) || completedAudits[0] || null,
    [completedAudits, auditIdA]
  );
  const auditB = useMemo(
    () => completedAudits.find((a) => a.id === auditIdB) || completedAudits[1] || null,
    [completedAudits, auditIdB]
  );

  const scoreDiff =
    auditA && auditB && auditA.score !== null && auditB.score !== null
      ? auditB.score - auditA.score
      : null;

  const resultA = auditA?.result_data;
  const resultB = auditB?.result_data;

  const speedA = resultA?.pageSpeed?.responseTimeMs || 0;
  const speedB = resultB?.pageSpeed?.responseTimeMs || 0;
  const speedDiff = speedA && speedB ? speedB - speedA : null;

  const handleSelectScenario = (idA: string, idB: string) => {
    setAuditIdA(idA);
    setAuditIdB(idB);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white shadow-xl relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30">
            <GitCompare className="w-3.5 h-3.5" />
            <span>Differential Analysis Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Compare Audits & Measure Impact</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Compare two audits side-by-side to verify SEO fixes, track score increases, or benchmark against competitor sites.
          </p>
        </div>
      </div>

      {/* Quick Comparison Scenario Chips */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            Quick Comparison Scenarios:
          </span>
          <span className="text-[11px] text-slate-400">Click to load benchmark</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            type="button"
            onClick={() => handleSelectScenario("benchmark-pre-opt", "benchmark-post-opt")}
            className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold border border-teal-200 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-teal-600" />
            <span>Before vs After Remediation (+30 pts)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectScenario("benchmark-stripe", "benchmark-github")}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 transition-colors cursor-pointer"
          >
            Stripe (92) vs GitHub (89)
          </button>

          <button
            type="button"
            onClick={() => handleSelectScenario("benchmark-pre-opt", "benchmark-stripe")}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 transition-colors cursor-pointer"
          >
            Acme Baseline (58) vs Stripe Leader (92)
          </button>
        </div>
      </div>

      {/* Selectors for Audit A and Audit B */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Audit A Selector */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Baseline Audit (A)
            </label>
            {auditA?.score !== null && (
              <span className="text-xs font-black font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-800">
                Score: {auditA?.score}
              </span>
            )}
          </div>
          <select
            value={auditIdA}
            onChange={(e) => setAuditIdA(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none cursor-pointer"
          >
            {completedAudits.map((a) => (
              <option key={a.id} value={a.id}>
                [{a.score ?? "N/A"}] {a.title || a.url} ({new Date(a.created_at).toLocaleDateString()})
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 font-mono truncate">{auditA?.url}</p>
        </div>

        {/* Audit B Selector */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Comparison Audit (B)
            </label>
            {auditB?.score !== null && (
              <span className="text-xs font-black font-mono px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                Score: {auditB?.score}
              </span>
            )}
          </div>
          <select
            value={auditIdB}
            onChange={(e) => setAuditIdB(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none cursor-pointer"
          >
            {completedAudits.map((a) => (
              <option key={a.id} value={a.id}>
                [{a.score ?? "N/A"}] {a.title || a.url} ({new Date(a.created_at).toLocaleDateString()})
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 font-mono truncate">{auditB?.url}</p>
        </div>
      </div>

      {/* Differential Score KPI Card */}
      {scoreDiff !== null && auditA && auditB && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <span className="text-xs font-bold text-slate-400 block mb-1">Baseline A</span>
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-2xl text-slate-800 font-mono border border-slate-200">
                {auditA.score}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <ArrowRight className="w-5 h-5 text-slate-400" />
            </div>

            <div className="text-center">
              <span className="text-xs font-bold text-slate-400 block mb-1">Comparison B</span>
              <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center font-black text-2xl text-teal-700 font-mono border border-teal-200 shadow-sm">
                {auditB.score}
              </div>
            </div>
          </div>

          {/* Differential Delta Pill */}
          <div className="flex items-center gap-3">
            <div
              className={`p-4 rounded-2xl flex items-center gap-3 border ${
                scoreDiff > 0
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : scoreDiff < 0
                  ? "bg-rose-50 text-rose-900 border-rose-200"
                  : "bg-slate-50 text-slate-900 border-slate-200"
              }`}
            >
              <div
                className={`p-2 rounded-xl text-white ${
                  scoreDiff > 0 ? "bg-emerald-600" : scoreDiff < 0 ? "bg-rose-600" : "bg-slate-600"
                }`}
              >
                {scoreDiff > 0 ? (
                  <TrendingUp className="w-6 h-6" />
                ) : scoreDiff < 0 ? (
                  <TrendingDown className="w-6 h-6" />
                ) : (
                  <CheckCircle2 className="w-6 h-6" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block">
                  {scoreDiff > 0 ? "Score Improvement" : scoreDiff < 0 ? "Score Regression" : "Scores Equal"}
                </span>
                <span className="text-2xl font-black font-mono">
                  {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff} Points
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Technical Differential Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Speed Delta */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Response Time (TTFB)
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500 font-mono">{speedA}ms → {speedB}ms</span>
            {speedDiff !== null && (
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  speedDiff <= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}
              >
                {speedDiff <= 0 ? `${speedDiff}ms (Faster)` : `+${speedDiff}ms (Slower)`}
              </span>
            )}
          </div>
        </div>

        {/* HTML Payload Delta */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            HTML Payload Weight
          </span>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-500 font-mono">
              {Math.round((resultA?.pageSpeed?.htmlSizeBytes || 0) / 1024)}KB →{" "}
              {Math.round((resultB?.pageSpeed?.htmlSizeBytes || 0) / 1024)}KB
            </span>
            <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
              {Math.round(
                ((resultB?.pageSpeed?.htmlSizeBytes || 0) - (resultA?.pageSpeed?.htmlSizeBytes || 0)) / 1024
              )}KB Delta
            </span>
          </div>
        </div>

        {/* Recommendations Count */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Critical Bottlenecks
          </span>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-500">
              {resultA?.recommendations?.length || 0} issues → {resultB?.recommendations?.length || 0} issues
            </span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              {Math.max(0, (resultA?.recommendations?.length || 0) - (resultB?.recommendations?.length || 0))} Resolved
            </span>
          </div>
        </div>
      </div>

      {/* Category Breakdown Comparison */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
          Category Score Breakdown & Differences
        </h3>

        <div className="space-y-3">
          {CATEGORY_ORDER.map((cat) => {
            const catScoreA = resultA?.categoryScores?.find((c) => c.category === cat)?.score ?? 0;
            const catScoreB = resultB?.categoryScores?.find((c) => c.category === cat)?.score ?? 0;
            const catDiff = catScoreB - catScoreA;

            return (
              <div key={cat} className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{CATEGORY_LABELS[cat]}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-500">
                      A: <strong>{catScoreA}</strong> | B: <strong>{catScoreB}</strong>
                    </span>
                    <span
                      className={`font-black font-mono px-2 py-0.5 rounded-md text-[11px] ${
                        catDiff > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : catDiff < 0
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {catDiff > 0 ? `+${catDiff}` : catDiff}
                    </span>
                  </div>
                </div>

                {/* Comparative Progress Bars */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-slate-600 rounded-full transition-all"
                      style={{ width: `${catScoreA}%` }}
                    />
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full transition-all"
                      style={{ width: `${catScoreB}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 text-xs">
        <span className="text-slate-500">Want to inspect either audit in depth?</span>
        <div className="flex items-center gap-2">
          {auditA && (
            <button
              type="button"
              onClick={() => onSelectAudit(auditA)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Open Baseline Audit (A) in Studio
            </button>
          )}
          {auditB && (
            <button
              type="button"
              onClick={() => onSelectAudit(auditB)}
              className="px-3 py-1.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition-colors shadow-sm"
            >
              Open Comparison Audit (B) in Studio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
