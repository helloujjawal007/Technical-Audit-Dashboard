import { useState } from "react";
import {
  X,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Wrench,
  TrendingUp,
  Clock,
  Sparkles,
  Code2,
} from "lucide-react";
import type { SemrushBottleneck } from "./semrushTypes";

interface SemrushFixModalProps {
  bottleneck: SemrushBottleneck | null;
  onClose: () => void;
  auditId?: string;
  isResolved?: boolean;
  onToggleResolve?: (checkId: string) => void;
}

export function SemrushFixModal({
  bottleneck,
  onClose,
  isResolved = false,
  onToggleResolve,
}: SemrushFixModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  if (!bottleneck) return null;

  const { check, guidance, affectedUrls, severity } = bottleneck;

  const handleCopyCode = () => {
    if (guidance.codeSnippet) {
      navigator.clipboard.writeText(guidance.codeSnippet);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* SEMrush Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-[#151934] to-[#1f1938] text-white p-5 sm:p-6 flex items-start justify-between border-b border-indigo-950/40">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full tracking-wider flex items-center gap-1 ${
                  severity === "error"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                }`}
              >
                {severity === "error" ? (
                  <XCircle className="w-3 h-3 text-rose-400" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                )}
                {severity === "error" ? "High Priority Error" : "Medium Priority Warning"}
              </span>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {check.category.toUpperCase()}
              </span>

              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                +{guidance.impactBoost}% Health Boost
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              {check.label}
            </h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              {check.detail}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800">
          {/* Difficulty & Boost Banner */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Estimated Fix Time</span>
                <span className="font-bold text-slate-700">{guidance.difficulty}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Score Impact</span>
                <span className="font-bold text-emerald-600">+{guidance.impactBoost}% Site Health</span>
              </div>
            </div>
          </div>

          {/* Section: Why It Matters */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-indigo-500" />
              Why It Matters for SEO
            </h4>
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-slate-700 text-xs sm:text-sm leading-relaxed">
              {guidance.whyItMatters}
            </div>
          </div>

          {/* Section: How to Fix It */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              How to Fix It
            </h4>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm leading-relaxed space-y-2">
              <p>{guidance.howToFix}</p>
            </div>
          </div>

          {/* Section: Ready Code Snippet */}
          {guidance.codeSnippet && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-blue-500" />
                  Developer Prescription Snippet
                </h4>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded-lg transition cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? "Copied!" : "Copy Snippet"}</span>
                </button>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 font-mono text-xs text-slate-200 overflow-x-auto relative shadow-inner">
                <pre className="whitespace-pre-wrap break-all">{guidance.codeSnippet}</pre>
              </div>
            </div>
          )}

          {/* Section: Affected URLs */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Affected URLs ({affectedUrls.length})</span>
            </h4>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {affectedUrls.map((url) => {
                const isCopied = copiedUrl === url;
                const validatorUrl = `https://validator.schema.org/#url=${encodeURIComponent(url)}`;
                return (
                  <div
                    key={url}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs hover:bg-slate-100/60 transition"
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline truncate font-medium flex-1"
                    >
                      {url}
                    </a>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(url)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                        title="Copy URL"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <a
                        href={validatorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="Inspect on Google/Schema Validator"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3">
          {onToggleResolve ? (
            <button
              type="button"
              onClick={() => onToggleResolve(check.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                isResolved
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200"
                  : "bg-slate-200 text-slate-700 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isResolved ? "Resolved ✓" : "Mark as Resolved"}</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
