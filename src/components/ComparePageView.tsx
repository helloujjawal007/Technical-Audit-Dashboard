import { useState, useMemo } from "react";
import { GitCompare, TrendingUp, TrendingDown, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { AuditRow } from "@/types";
import { scoreColor } from "@/types";

interface ComparePageViewProps {
  audits: AuditRow[];
  onSelectAudit: (audit: AuditRow) => void;
}

export function ComparePageView({ audits, onSelectAudit }: ComparePageViewProps) {
  const completedAudits = useMemo(
    () => audits.filter((a) => a.result_data && a.score !== null),
    [audits]
  );

  const [auditIdA, setAuditIdA] = useState<string>(completedAudits[0]?.id || "");
  const [auditIdB, setAuditIdB] = useState<string>(completedAudits[1]?.id || "");

  const auditA = useMemo(
    () => completedAudits.find((a) => a.id === auditIdA) || null,
    [completedAudits, auditIdA]
  );
  const auditB = useMemo(
    () => completedAudits.find((a) => a.id === auditIdB) || null,
    [completedAudits, auditIdB]
  );

  const scoreDiff =
    auditA && auditB && auditA.score !== null && auditB.score !== null
      ? auditB.score - auditA.score
      : null;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white shadow-xl relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30">
            <GitCompare className="w-3.5 h-3.5" />
            <span>Side-by-Side Audit Compare</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Compare Audits & Measure Impact</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Compare two audits to verify fixes, track score improvements, or benchmark against competitors.
          </p>
        </div>
      </div>

      {completedAudits.length < 2 ? (
        <div className="p-16 rounded-3xl bg-white border border-slate-200/80 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <GitCompare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-700">Need At Least 2 Completed Audits</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Run at least two audits from the Audit Studio to compare performance before and after optimization.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Audit Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Base Audit A */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Baseline Audit (A)
              </label>
              <select
                value={auditIdA}
                onChange={(e) => setAuditIdA(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none cursor-pointer"
              >
                {completedAudits.map((a) => (
                  <option key={a.id} value={a.id}>
                    Score: {a.score} — {a.title || a.url} ({new Date(a.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Audit B */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Comparison Audit (B)
              </label>
              <select
                value={auditIdB}
                onChange={(e) => setAuditIdB(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none cursor-pointer"
              >
                {completedAudits.map((a) => (
                  <option key={a.id} value={a.id}>
                    Score: {a.score} — {a.title || a.url} ({new Date(a.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Delta Score Banner */}
          {auditA && auditB && scoreDiff !== null && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold shadow-sm ${
                    scoreDiff > 0
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : scoreDiff < 0
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {scoreDiff > 0 ? (
                    <TrendingUp className="w-7 h-7" />
                  ) : scoreDiff < 0 ? (
                    <TrendingDown className="w-7 h-7" />
                  ) : (
                    "="
                  )}
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                    Score Delta:
                    <span
                      className={`font-black ${
                        scoreDiff > 0
                          ? "text-emerald-600"
                          : scoreDiff < 0
                          ? "text-rose-600"
                          : "text-slate-600"
                      }`}
                    >
                      {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff} points
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comparing Baseline ({auditA.score}/100) vs Comparison ({auditB.score}/100)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectAudit(auditA)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  View Audit A
                </button>
                <button
                  type="button"
                  onClick={() => onSelectAudit(auditB)}
                  className="px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition-all cursor-pointer"
                >
                  View Audit B
                </button>
              </div>
            </div>
          )}

          {/* Side-by-Side Breakdown Cards */}
          {auditA && auditB && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AuditSummaryCard audit={auditA} label="Baseline (A)" />
              <AuditSummaryCard audit={auditB} label="Comparison (B)" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AuditSummaryCard({ audit, label }: { audit: AuditRow; label: string }) {
  const sc = audit.score !== null ? scoreColor(audit.score) : null;
  const result = audit.result_data;
  const checks = result?.checks || [];
  const passed = checks.filter((c) => c.status === "pass").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const failed = checks.filter((c) => c.status === "fail").length;

  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        {audit.score !== null && sc && (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${sc.bg}/15 ${sc.text}`}>
            {audit.score}/100 — {sc.label}
          </span>
        )}
      </div>

      <div>
        <h4 className="text-sm font-bold text-slate-800 truncate">{audit.title || audit.url}</h4>
        <p className="text-xs font-mono text-slate-400 truncate mt-0.5">{audit.url}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center pt-1">
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
          <p className="text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Passed
          </p>
          <p className="text-lg font-black text-emerald-700 mt-0.5">{passed}</p>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
          <p className="text-xs text-amber-600 font-semibold flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Warn
          </p>
          <p className="text-lg font-black text-amber-700 mt-0.5">{warned}</p>
        </div>

        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
          <p className="text-xs text-rose-600 font-semibold flex items-center justify-center gap-1">
            <XCircle className="w-3 h-3" /> Failed
          </p>
          <p className="text-lg font-black text-rose-700 mt-0.5">{failed}</p>
        </div>
      </div>
    </div>
  );
}
