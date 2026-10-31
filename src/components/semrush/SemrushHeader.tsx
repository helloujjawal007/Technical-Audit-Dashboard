import {
  Download,
  Send,
  LayoutDashboard,
  Trash2,
  ExternalLink,
  XCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";
import type { AuditResult } from "@/types";
import { ScoreGauge } from "@/components/ScoreGauge";

interface SemrushHeaderProps {
  result: AuditResult;
  url: string;
  auditId?: string;
  onExportPdf: () => void;
  onOpenOutreachModal: () => void;
  onCreateSiteDashboard?: (url: string, title?: string | null) => void;
  onDelete?: () => void;
  isDispatching?: boolean;
}

export function SemrushHeader({
  result,
  url,
  onExportPdf,
  onOpenOutreachModal,
  onCreateSiteDashboard,
  onDelete,
}: SemrushHeaderProps) {
  const checks = result.checks || [];
  const errorCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const noticeCount = checks.filter((c) => c.status === "info").length;
  const passCount = checks.filter((c) => c.status === "pass").length;

  let domain = "yourdomain.com";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = url.replace(/^https?:\/\//, "").split("/")[0];
  }

  // SEMrush Grade & Health Status
  const score = result.score || 0;
  let grade = "A";
  let gradeText = "Exceptional Technical Health";
  let gradeBadgeColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

  if (score >= 90) {
    grade = "A+";
    gradeText = "Exceptional Technical Health";
  } else if (score >= 80) {
    grade = "A";
    gradeText = "Strong Health, Minor Fixes";
  } else if (score >= 65) {
    grade = "B";
    gradeText = "Good, Moderate Remediation Needed";
    gradeBadgeColor = "bg-blue-500/20 text-blue-300 border-blue-500/30";
  } else if (score >= 50) {
    grade = "C";
    gradeText = "Needs Technical Optimization";
    gradeBadgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/30";
  } else {
    grade = "D";
    gradeText = "Critical SEO Deficits Present";
    gradeBadgeColor = "bg-rose-500/20 text-rose-300 border-rose-500/30";
  }

  // SEMrush Competitive Benchmarks (Top 10% average is 92%, Industry median is 74%)
  const top10Benchmark = 92;
  const industryAverage = 74;

  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-[#111322] to-[#1c1836] text-white p-6 sm:p-8 shadow-xl border border-slate-800/80 relative overflow-hidden space-y-6">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar: URL + Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-orange-500 text-white shadow-xs">
              SEMrush Pro Audit
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${gradeBadgeColor}`}>
              Grade {grade} • {gradeText}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
              {domain}
            </h1>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition"
              title="Open audited site"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <p className="text-xs text-slate-400 truncate font-mono">
            {url}
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <button
            type="button"
            onClick={onOpenOutreachModal}
            className="inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send to Outreach (LOD)</span>
          </button>

          {onCreateSiteDashboard && (
            <button
              type="button"
              onClick={() => onCreateSiteDashboard(url, result.title)}
              className="inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold border border-white/15 transition cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-teal-400" />
              <span>Site Dashboard</span>
            </button>
          )}

          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export SEMrush PDF</span>
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition cursor-pointer"
              title="Delete audit"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Stats Row: Score Gauge + Competitive Benchmark + Severity Pills */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-2 relative z-10 border-t border-slate-800/80">
        {/* Left: Big Score Gauge */}
        <div className="lg:col-span-4 flex items-center gap-5 justify-center lg:justify-start">
          <ScoreGauge score={score} size={130} />
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Site Health Score
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-black text-white">
                {score}
              </span>
              <span className="text-slate-400 text-sm font-bold">/100</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Evaluated across {checks.length} technical checks
            </p>
          </div>
        </div>

        {/* Center: Competitive Benchmark Bar */}
        <div className="lg:col-span-4 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300">Competitive Benchmark</span>
            <span className="text-[11px] text-slate-400">Industry Curve</span>
          </div>

          {/* Benchmark Meters */}
          <div className="space-y-2 text-[11px]">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>This Website</span>
                <span className="font-bold text-white">{score}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="bg-orange-500 h-full rounded-full transition-all duration-700"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Top 10% Websites</span>
                <span className="font-semibold text-emerald-400">{top10Benchmark}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${top10Benchmark}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Industry Average</span>
                <span className="font-semibold text-slate-400">{industryAverage}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="bg-slate-600 h-full rounded-full"
                  style={{ width: `${industryAverage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Severity Breakdown (SEMrush Signature Pills) */}
        <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
            <div className="flex items-center gap-1.5 text-xs font-bold mb-0.5">
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Errors</span>
            </div>
            <span className="text-xl font-black text-white">{errorCount}</span>
            <span className="text-[10px] text-rose-400 block">Critical fixes</span>
          </div>

          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
            <div className="flex items-center gap-1.5 text-xs font-bold mb-0.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Warnings</span>
            </div>
            <span className="text-xl font-black text-white">{warnCount}</span>
            <span className="text-[10px] text-amber-400 block">Needs attention</span>
          </div>

          <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-300">
            <div className="flex items-center gap-1.5 text-xs font-bold mb-0.5">
              <Info className="w-3.5 h-3.5 text-sky-400" />
              <span>Notices</span>
            </div>
            <span className="text-xl font-black text-white">{noticeCount}</span>
            <span className="text-[10px] text-sky-400 block">Informational</span>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <div className="flex items-center gap-1.5 text-xs font-bold mb-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Passed</span>
            </div>
            <span className="text-xl font-black text-white">{passCount}</span>
            <span className="text-[10px] text-emerald-400 block">Clean checks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
