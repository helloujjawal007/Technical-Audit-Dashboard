import { useState } from "react";
import {
  ShieldCheck,
  User as UserIcon,
  Mail,
  Database,
  Sparkles,
  CheckCircle2,
  RotateCw,
  Copy,
  Check,
  Send,
  Server,
  Flame,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isSystemAdminUser } from "@/lib/admin";
import { supabaseUrl } from "@/lib/supabase";

export function SettingsPageView() {
  const { user, subscription, refreshSubscription } = useAuth();
  const isAdmin = Boolean(subscription?.tier === "admin" || isSystemAdminUser(user));
  const userEmail = user?.email || (isAdmin ? "admin@seoauditpro.com" : "guest@seoauditpro.com");
  const userName = user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : isAdmin ? "System Administrator" : "Guest");

  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const apiEndpointUrl = supabaseUrl
    ? `${supabaseUrl}/functions/v1/seo-audit`
    : "https://api.supabase.co/functions/v1/seo-audit";

  const emailTemplate = `Hi [Prospect Name],

We ran a quick technical SEO and speed audit on [prospectsite.com] and noticed an overall health score of 58/100.

Key technical bottlenecks identified:
• Server response time is 1.48s (recommended under 600ms)
• Missing primary H1 heading and meta descriptions
• 18 images missing descriptive alt tags

You can view the full interactive audit report here:
https://technical-audit-dashboard.vercel.app/?report={auditId}

Best regards,
[Your Name / SEO Audit Team]`;

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-amber-500/10 via-teal-500/10 to-transparent pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Administrator Control Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">System Settings & Admin Command</h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Manage your high-tier quota (200 audits/day), outreach API endpoints for automated prospect audits, and live database engine settings.
          </p>
        </div>
      </div>

      {/* Admin Plan & Quota Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-tr from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25 flex-shrink-0">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">
                  {isAdmin ? "Enterprise Administrator Plan" : "Free Community Plan"}
                </h3>
                {isAdmin ? (
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    Admin Active
                  </span>
                ) : (
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                    Community Tier
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Assigned to: <strong className="font-mono text-slate-800">{user?.email || (isAdmin ? "Enterprise Administrator" : "Guest User")}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refreshSubscription()}
            title="Refresh subscription status"
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-teal-600 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Sync Quota</span>
          </button>
        </div>

        {/* Quota Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-1">
            <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase tracking-wider">
              <span>Daily Audit Allowance</span>
              <Flame className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-2xl font-black text-slate-900 font-mono block">
              {isAdmin ? "200 / Day" : "5 / Day"}
            </span>
            <span className="text-[11px] text-amber-800 font-medium">
              {isAdmin ? "Full deep scan capabilities unlocked" : "Standard daily community quota"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Inspection Engine Depth
            </span>
            <span className="text-2xl font-black text-teal-700 font-mono block">Deep (90+ Rules)</span>
            <span className="text-[11px] text-slate-500">Includes core web vitals & schema validation</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Concurrent Workers
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono block">5 Parallel</span>
            <span className="text-[11px] text-slate-500">Batch auditing with zero throttle</span>
          </div>
        </div>
      </div>

      {/* Prospect Outreach & Automation API Integration */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
              <Send className="w-4 h-4" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900">
              Prospect Outreach Automation API
            </h3>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Integrate your outreach dashboard with this audit engine. When sending emails to website prospects, trigger a fast 2-second audit and include the score and report link.
          </p>
        </div>

        {/* API Endpoint Snippet */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>Direct Audit REST API Endpoint:</span>
            <span className="text-[11px] text-slate-400 font-normal">Method: POST (JSON)</span>
          </label>
          <div className="relative">
            <div className="p-3.5 pr-24 rounded-2xl bg-slate-900 text-teal-300 font-mono text-xs overflow-x-auto shadow-inner border border-slate-800">
              {apiEndpointUrl}
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(apiEndpointUrl, setCopiedEndpoint)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              {copiedEndpoint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedEndpoint ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        {/* Outreach Email Copy Template */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">
              Outreach Email Copy Template (Auto-populated with Audit Data):
            </label>
            <button
              type="button"
              onClick={() => copyToClipboard(emailTemplate, setCopiedTemplate)}
              className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
            >
              {copiedTemplate ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedTemplate ? "Copied to Clipboard!" : "Copy Template"}</span>
            </button>
          </div>
          <pre className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-sans whitespace-pre-wrap leading-relaxed shadow-xs">
            {emailTemplate}
          </pre>
        </div>
      </div>

      {/* Account Details & Profile */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-teal-600" />
          Administrator Identity & Credentials
        </h3>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 gap-1 text-xs">
            <div className="flex items-center gap-2.5">
              <UserIcon className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-600">Account Owner</span>
            </div>
            <span className="font-bold text-slate-900">{userName}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 gap-1 text-xs">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-600">{isAdmin ? "Admin Email" : "Account Email"}</span>
            </div>
            <span className="font-mono font-bold text-slate-900">{userEmail}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 gap-1 text-xs">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-600">System Role</span>
            </div>
            <span className={isAdmin ? "font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300" : "font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200"}>
              {isAdmin ? "Super Administrator (200 Daily Audits)" : "Community Member (5 Daily Audits)"}
            </span>
          </div>
        </div>
      </div>

      {/* Live System Infrastructure Diagnostics */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Server className="w-4 h-4 text-teal-600" />
          Infrastructure & Engine Connectivity
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
            <span className="text-slate-600 font-medium">PostgreSQL Database (Supabase)</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Online (Active Cloud DB)
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
            <span className="text-slate-600 font-medium">Vercel Serverless Functions</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Deployed & Zero-CORS
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
            <span className="text-slate-600 font-medium">Database Table: seo_audits</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Active & Logging
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
            <span className="text-slate-600 font-medium">Database Table: user_subscriptions</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tracking (Tier: {isAdmin ? "admin" : "standard"})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
