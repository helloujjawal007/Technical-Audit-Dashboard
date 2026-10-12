import { ShieldCheck, User as UserIcon, Mail, Database, Sparkles, CheckCircle2, RotateCw } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function SettingsPageView() {
  const { user, subscription, refreshSubscription } = useAuth();
  const isAdmin = subscription?.tier === "admin";
  const userEmail = user?.email || "N/A";
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white shadow-xl relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30">
            <UserIcon className="w-3.5 h-3.5" />
            <span>Account & System Settings</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Settings & Subscription</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Manage your SEO Audit Pro configuration, active plan limits, and environment credentials.
          </p>
        </div>
      </div>

      {/* Plan Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isAdmin
                  ? "bg-gradient-to-tr from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/25"
                  : "bg-teal-50 text-teal-600 border border-teal-200"
              }`}
            >
              {isAdmin ? <ShieldCheck className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-800">
                  {isAdmin ? "Admin Enterprise Plan" : "Community Free Plan"}
                </h3>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isAdmin
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-teal-100 text-teal-800"
                  }`}
                >
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isAdmin
                  ? "Unlimited audit engines with 200 deep daily audit runs."
                  : "Standard audit engines with daily quota."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refreshSubscription()}
            title="Refresh subscription"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-teal-600 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-xs text-slate-400 block mb-0.5">Daily Audit Quota</span>
            <span className="text-lg font-black text-slate-800">
              {isAdmin ? "200 Audits / Day" : "20 Audits / Day"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-xs text-slate-400 block mb-0.5">Audit Depth Access</span>
            <span className="text-lg font-black text-emerald-600">Deep (90+ Checks)</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-xs text-slate-400 block mb-0.5">Parallel Domain Crawl</span>
            <span className="text-lg font-black text-teal-600">Enabled</span>
          </div>
        </div>
      </div>

      {/* Account Details Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-teal-600" />
          Profile Credentials
        </h3>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 gap-1">
            <div className="flex items-center gap-2.5">
              <UserIcon className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Full Name</span>
            </div>
            <span className="text-xs font-bold text-slate-800">{userName}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 gap-1">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Email Address</span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-800">{userEmail}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 gap-1">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Account ID</span>
            </div>
            <span className="text-xs font-mono text-slate-500 truncate max-w-xs">{user?.id || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Engine & Database Status */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Database className="w-4 h-4 text-teal-600" />
          System Engine & Infrastructure
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
            <span className="text-slate-600 font-medium">PostgreSQL Database</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
            <span className="text-slate-600 font-medium">Audit Runner Core</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> High Performance
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
