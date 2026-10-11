import { useEffect, useState } from "react";
import { Coins, Globe, List, FileSearch, FlaskConical, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAllCreditUsage, type CreditUsage } from "@/lib/credits";

const AUDIT_TYPE_ICONS: Record<string, typeof Globe> = {
  single: Globe,
  multiple: List,
  crawl: FileSearch,
  staging: FlaskConical,
  admin: ShieldCheck,
};

const AUDIT_TYPE_LABELS: Record<string, string> = {
  single: "Single Page",
  multiple: "Multiple Pages",
  crawl: "Site Crawl",
  staging: "Staging",
  admin: "All Audits",
};

export function CreditDisplay() {
  const { user, subscription } = useAuth();
  const [usage, setUsage] = useState<Record<string, CreditUsage> | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    getAllCreditUsage(user.id).then(setUsage);
  }, [user]);

  if (!usage) return null;

  const tierName = subscription?.tier || "free";
  const tierLabel = tierName.charAt(0).toUpperCase() + tierName.slice(1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-700">{tierLabel} Plan</p>
            <p className="text-xs text-slate-400">Credit Usage</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100">
          {Object.entries(usage).map(([type, u]) => {
            const Icon = AUDIT_TYPE_ICONS[type] || Globe;
            const pct = u.limit > 0 ? Math.round((u.used / u.limit) * 100) : 0;
            const barColor = pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";

            return (
              <div key={type} className="py-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-600">{AUDIT_TYPE_LABELS[type] || type}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    <span className={`font-semibold ${pct >= 100 ? "text-rose-600" : "text-slate-700"}`}>{u.used}</span>
                    /{u.limit} {u.windowLabel}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} rounded-full transition-all duration-300`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                {u.remaining > 0 && (
                  <p className="text-xs text-slate-400 mt-1">{u.remaining} remaining</p>
                )}
                {u.remaining === 0 && (
                  <p className="text-xs text-rose-500 mt-1">
                    {tierName === "admin" ? "Daily allowance reached." : "Limit reached. Upgrade for more."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
