import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, ChevronDown, ChevronRight, Circle, CheckCircle } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER, STATUS_META, type CheckCategory, type CheckResult } from "@/types";

const STATUS_ICONS = {
  pass: CheckCircle2,
  fail: XCircle,
  warn: AlertTriangle,
  info: Info,
};

interface ChecklistProps {
  checks: CheckResult[];
  auditId?: string;
}

export function Checklist({ checks, auditId }: ChecklistProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (auditId) {
      try {
        const stored = localStorage.getItem(`audit-tasks-${auditId}`);
        if (stored) setResolved(new Set(JSON.parse(stored)));
      } catch { /* ignore */ }
    }
  }, [auditId]);

  useEffect(() => {
    if (auditId) {
      try {
        localStorage.setItem(`audit-tasks-${auditId}`, JSON.stringify([...resolved]));
      } catch { /* ignore */ }
    }
  }, [resolved, auditId]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleResolved = (id: string) => {
    setResolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const safeChecks = checks || [];

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: safeChecks.filter((c) => c.category === cat),
  })).filter((g) => g.items.length > 0);

  const actionableChecks = safeChecks.filter((c) => c.status === "fail" || c.status === "warn");
  const resolvedCount = actionableChecks.filter((c) => resolved.has(c.id)).length;
  const progressPct = actionableChecks.length > 0 ? Math.round((resolvedCount / actionableChecks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {actionableChecks.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-slate-700">Task Progress</span>
            </div>
            <span className="text-xs text-slate-500">{resolvedCount} of {actionableChecks.length} resolved ({progressPct}%)</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-2">Click the circle next to any failed or warning check to mark it as resolved. Your progress is saved automatically.</p>
        </div>
      )}

      {grouped.map((group) => {
        const counts = group.items.reduce(
          (acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; },
          {} as Record<string, number>,
        );

        return (
          <div key={group.category}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                {CATEGORY_LABELS[group.category as CheckCategory]}
              </h3>
              <div className="flex items-center gap-2 text-xs">
                {(["pass", "warn", "fail", "info"] as const).map((s) =>
                  counts[s] ? (
                    <span key={s} className={`inline-flex items-center gap-1 ${STATUS_META[s].color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[s].dot}`} />
                      {counts[s]}
                    </span>
                  ) : null,
                )}
              </div>
            </div>

            <div className="space-y-2">
              {group.items.map((check) => {
                const meta = STATUS_META[check.status];
                const Icon = STATUS_ICONS[check.status];
                const isExpanded = expanded.has(check.id);
                const hasValue = check.value && check.value.trim();
                const isActionable = check.status === "fail" || check.status === "warn";
                const isResolved = resolved.has(check.id);

                return (
                  <div
                    key={check.id}
                    className={`rounded-xl border ${isResolved ? "bg-emerald-50/50 border-emerald-100" : `${meta.bg} border-slate-100`} overflow-hidden transition-all`}
                  >
                    <div
                      className={`flex items-start gap-3 p-4 ${hasValue ? "cursor-pointer hover:bg-opacity-70" : ""}`}
                      onClick={hasValue ? () => toggle(check.id) : undefined}
                    >
                      <Icon className={`w-5 h-5 ${isResolved ? "text-emerald-400" : meta.color} flex-shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${isResolved ? "text-slate-400 line-through" : "text-slate-800"}`}>{check.label}</p>
                          <span className={`text-xs font-medium ${isResolved ? "text-emerald-500" : meta.color}`}>{isResolved ? "Resolved" : meta.label}</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{check.detail}</p>
                      </div>
                      {isActionable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleResolved(check.id); }}
                          className="flex-shrink-0 mt-1 p-1 rounded-full hover:bg-white/60 transition-colors"
                          title={isResolved ? "Mark as unresolved" : "Mark as resolved"}
                        >
                          {isResolved ? (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300" />
                          )}
                        </button>
                      )}
                      {hasValue && (
                        <div className="flex-shrink-0 mt-1">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      )}
                    </div>
                    {hasValue && isExpanded && (
                      <div className="px-4 pb-4 pl-12">
                        <pre className="text-xs text-slate-600 bg-white/60 rounded-lg p-3 whitespace-pre-wrap break-words font-mono">
                          {check.value}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
