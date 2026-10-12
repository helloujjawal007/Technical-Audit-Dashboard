import { useEffect, useState } from "react";
import { Coins, Globe, List, FileSearch, FlaskConical, ShieldCheck, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
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
  admin: "Daily Audits",
};

export function CreditDisplay() {
  const { user, subscription } = useAuth();
  const [usage, setUsage] = useState<Record<string, CreditUsage> | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!user) return;
    getAllCreditUsage(user.id).then(setUsage);
  }, [user]);

  if (!usage) return null;

  const isAdmin = subscription?.tier === "admin";
  const tierName = subscription?.tier || "free";
  const tierLabel = isAdmin ? "Admin Pro" : tierName.charAt(0).toUpperCase() + tierName.slice(1);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${
              isAdmin
                ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                : "bg-teal-50 text-teal-600 border border-teal-200/50"
            }`}
          >
            {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <Coins className="w-5 h-5" />}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-slate-800">{tierLabel} Quota</p>
              {isAdmin && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {isAdmin ? "200 audits refreshed daily" : "Audits allowance & limits"}
            </p>
          </div>
        </div>

        <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100/80 animate-fade-in">
          {Object.entries(usage).map(([type, u]) => {
            const Icon = AUDIT_TYPE_ICONS[type] || Globe;
            const pct = u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
            const barGradient =
              pct >= 100
                ? "from-rose-500 to-red-600"
                : pct >= 80
                ? "from-amber-400 to-orange-500"
                : "from-teal-500 to-emerald-500";

            return (
              <div key={type} className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      {AUDIT_TYPE_LABELS[type] || type}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    <span className="font-extrabold text-slate-800">{u.used}</span>
                    <span className="text-slate-400"> / {u.limit} {u.windowLabel}</span>
                  </span>
                </div>

                {/* Animated Progress Bar */}
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full bg-gradient-to-r ${barGradient} rounded-full transition-all duration-700 ease-out`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-1 text-[11px]">
                  <span className="text-emerald-600 font-semibold">
                    {u.remaining} remaining
                  </span>
                  <span className="text-slate-400">{pct}% used</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
