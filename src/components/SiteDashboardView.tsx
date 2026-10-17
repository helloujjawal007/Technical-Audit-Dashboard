import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  Plus,
  Globe,
  ExternalLink,
  Play,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  Gauge,
  FileSearch,
  Sparkles,
  KeyRound,
  BarChart3,
  X,
  ChevronRight,
  TrendingUp,
  Send,
} from "lucide-react";
import type { AuditRow, AuditResult, SiteDashboard, SiteTypeCategory, CheckCategory } from "@/types";
import { CATEGORY_META } from "@/types";
import { SendToOutreachModal } from "@/components/SendToOutreachModal";

interface SiteDashboardViewProps {
  audits: AuditRow[];
  userId: string | null;
  onRunAudit: (url: string, mode: "single" | "crawl", depth: "basic" | "standard" | "deep") => void;
  onSelectAudit: (audit: AuditRow) => void;
  onOpenAuditStudio: () => void;
  initialSiteUrl?: string | null;
}

const SITE_TYPE_LABELS: Record<SiteTypeCategory, { label: string; color: string; bg: string }> = {
  general: { label: "General Website", color: "text-slate-700", bg: "bg-slate-100" },
  ecommerce: { label: "E-Commerce", color: "text-emerald-700", bg: "bg-emerald-50" },
  saas: { label: "SaaS / Web App", color: "text-blue-700", bg: "bg-blue-50" },
  blog: { label: "Blog & Content", color: "text-violet-700", bg: "bg-violet-50" },
  corporate: { label: "Corporate / B2B", color: "text-teal-700", bg: "bg-teal-50" },
  agency: { label: "Agency & Client", color: "text-amber-700", bg: "bg-amber-50" },
  portfolio: { label: "Portfolio & Personal", color: "text-pink-700", bg: "bg-pink-50" },
};

function getDomainFromUrl(rawUrl: string): string {
  try {
    let clean = rawUrl.trim();
    if (!/^https?:\/\//i.test(clean)) clean = "https://" + clean;
    const parsed = new URL(clean);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return rawUrl.toLowerCase().trim();
  }
}

function calculateGrade(score: number | null): { grade: string; color: string; bg: string; textDesc: string } {
  if (score === null || score === undefined) {
    return { grade: "—", color: "text-slate-400", bg: "bg-slate-100", textDesc: "No Audit Run" };
  }
  if (score >= 95) return { grade: "A+", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", textDesc: "Exceptional SEO Health" };
  if (score >= 88) return { grade: "A", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", textDesc: "Strong Technical Health" };
  if (score >= 75) return { grade: "B", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", textDesc: "Good, Minor Fixes Required" };
  if (score >= 60) return { grade: "C", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", textDesc: "Needs Improvement" };
  if (score >= 45) return { grade: "D", color: "text-orange-600", bg: "bg-orange-50 border-orange-200", textDesc: "Significant SEO Deficits" };
  return { grade: "F", color: "text-rose-600", bg: "bg-rose-50 border-rose-200", textDesc: "Critical Issues Present" };
}

export function SiteDashboardView({
  audits,
  userId,
  onRunAudit,
  onSelectAudit,
  onOpenAuditStudio,
  initialSiteUrl,
}: SiteDashboardViewProps) {
  const storageKey = `seo_pro_site_dashboards_${userId || "guest"}`;

  // Sites state
  const [sites, setSites] = useState<SiteDashboard[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSite, setEditingSite] = useState<SiteDashboard | null>(null);
  const [showOutreachModal, setShowOutreachModal] = useState(false);

  // Form states for create / edit
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formType, setFormType] = useState<SiteTypeCategory>("general");
  const [formKeywords, setFormKeywords] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Active filter tab in site dashboard
  const [activeTab, setActiveTab] = useState<"overview" | "issues" | "categories" | "history" | "keywords">("overview");
  const [issueFilter, setIssueFilter] = useState<"all" | "fail" | "warn" | "pass">("all");

  // Sync sites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sites));
    } catch (e) {
      console.error("Failed to save sites to localStorage:", e);
    }
  }, [sites, storageKey]);

  // Initial site selection
  useEffect(() => {
    if (sites.length > 0) {
      if (!selectedSiteId || !sites.find((s) => s.id === selectedSiteId)) {
        // If initialSiteUrl provided, try finding it
        if (initialSiteUrl) {
          const dom = getDomainFromUrl(initialSiteUrl);
          const found = sites.find((s) => s.domain === dom);
          if (found) {
            setSelectedSiteId(found.id);
            return;
          }
        }
        setSelectedSiteId(sites[0].id);
      }
    } else {
      setSelectedSiteId(null);
    }
  }, [sites, selectedSiteId, initialSiteUrl]);

  // Active site
  const activeSite = useMemo(() => {
    return sites.find((s) => s.id === selectedSiteId) || null;
  }, [sites, selectedSiteId]);

  // Audits relevant to this active site
  const siteAudits = useMemo(() => {
    if (!activeSite) return [];
    const targetDomain = activeSite.domain;
    return audits.filter((a) => {
      const aDomain = getDomainFromUrl(a.url);
      return aDomain === targetDomain;
    });
  }, [activeSite, audits]);

  // Latest audit for this site
  const latestAuditRow = siteAudits.length > 0 ? siteAudits[0] : null;
  const latestResult: AuditResult | null = (latestAuditRow?.result_data as AuditResult) || null;

  // Previous audit for comparison
  const previousAuditRow = siteAudits.length > 1 ? siteAudits[1] : null;
  const scoreDiff = useMemo(() => {
    if (latestAuditRow?.score !== null && latestAuditRow?.score !== undefined &&
        previousAuditRow?.score !== null && previousAuditRow?.score !== undefined) {
      return latestAuditRow.score - previousAuditRow.score;
    }
    return null;
  }, [latestAuditRow, previousAuditRow]);

  // Issues calculation
  const checks = useMemo(() => {
    return latestResult?.checks || latestAuditRow?.checks || [];
  }, [latestResult, latestAuditRow]);
  const counts = useMemo(() => {
    return checks.reduce(
      (acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      },
      { pass: 0, fail: 0, warn: 0, info: 0 }
    );
  }, [checks]);

  const totalChecks = checks.length;
  const passRate = totalChecks > 0 ? Math.round((counts.pass / totalChecks) * 100) : 0;

  // Filtered checks for Issues tab
  const filteredChecks = useMemo(() => {
    if (issueFilter === "all") return checks;
    return checks.filter((c) => c.status === issueFilter);
  }, [checks, issueFilter]);

  // Open Create Modal
  const handleOpenCreateModal = (suggestedUrl?: string, suggestedName?: string) => {
    setFormName(suggestedName || "");
    setFormUrl(suggestedUrl || "");
    setFormType("general");
    setFormKeywords("");
    setFormNotes("");
    setFormError(null);
    setEditingSite(null);
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (site: SiteDashboard) => {
    setEditingSite(site);
    setFormName(site.name);
    setFormUrl(site.url);
    setFormType(site.siteType || "general");
    setFormKeywords((site.targetKeywords || []).join(", "));
    setFormNotes(site.notes || "");
    setFormError(null);
    setShowCreateModal(true);
  };

  // Save Site (Create or Edit)
  const handleSaveSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUrl.trim()) {
      setFormError("Please enter a valid site URL or domain");
      return;
    }

    let normalizedUrl = formUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    const domain = getDomainFromUrl(normalizedUrl);
    const name = formName.trim() || domain;

    const keywords = formKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (editingSite) {
      // Update
      const updated: SiteDashboard = {
        ...editingSite,
        name,
        url: normalizedUrl,
        domain,
        siteType: formType,
        targetKeywords: keywords,
        notes: formNotes.trim(),
        updatedAt: new Date().toISOString(),
      };
      setSites((prev) => prev.map((s) => (s.id === editingSite.id ? updated : s)));
    } else {
      // Create
      const newSite: SiteDashboard = {
        id: "site_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
        name,
        url: normalizedUrl,
        domain,
        siteType: formType,
        targetKeywords: keywords,
        notes: formNotes.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSites((prev) => [newSite, ...prev]);
      setSelectedSiteId(newSite.id);
    }

    setShowCreateModal(false);
  };

  // Delete Site
  const handleDeleteSite = (siteId: string) => {
    if (confirm("Are you sure you want to remove this site dashboard?")) {
      const remaining = sites.filter((s) => s.id !== siteId);
      setSites(remaining);
      if (selectedSiteId === siteId) {
        setSelectedSiteId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  // Quick Action: Run Audit
  const handleQuickRunAudit = (depth: "basic" | "standard" | "deep" = "deep") => {
    if (!activeSite) return;
    onRunAudit(activeSite.url, "crawl", depth);
  };

  const handleQuickCrawl = () => {
    if (!activeSite) return;
    onRunAudit(activeSite.url, "crawl", "standard");
  };

  const gradeInfo = calculateGrade(latestAuditRow?.score ?? null);

  // Recommendations
  const recommendations = latestResult?.recommendations || [];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Bar: Selector & Action Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Site Dashboards
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/60">
                  {sites.length} {sites.length === 1 ? "Site" : "Sites"} Monitored
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Dedicated health hubs, performance trends, and technical triage for your web properties
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {sites.length > 0 && (
              <div className="relative">
                <select
                  value={selectedSiteId || ""}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="appearance-none bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 text-slate-800 text-xs font-bold rounded-xl pl-3 pr-8 py-2.5 shadow-xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-teal-500/20"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.domain})
                    </option>
                  ))}
                </select>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
              </div>
            )}

            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs hover:shadow-teal-600/20 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Site</span>
            </button>
          </div>
        </div>

        {/* Quick Recent Audits to Pin banner if no sites created yet */}
        {sites.length === 0 && audits.length > 0 && (
          <div className="mt-5 p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs font-extrabold text-teal-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  Quick Setup: Create a Site Dashboard from your recent audits
                </p>
                <p className="text-[11px] text-teal-700">
                  Select any audited domain below to instantly generate a dedicated site health hub:
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {Array.from(new Set(audits.map((a) => getDomainFromUrl(a.url))))
                  .slice(0, 4)
                  .map((dom) => (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => handleOpenCreateModal(`https://${dom}`, dom)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 bg-white text-teal-800 hover:bg-teal-100/80 border border-teal-300/80 rounded-lg shadow-2xs transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-teal-600" />
                      <span>{dom}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content: If No Sites */}
      {sites.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[420px]">
          <div className="w-16 h-16 rounded-3xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-600 mb-4 shadow-sm">
            <Globe className="w-8 h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight mb-2">
            No Site Dashboards Configured Yet
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
            Create a dedicated site dashboard to track historical audit health, monitor Core Web Vitals, track keywords, and keep an executive score log for any website.
          </p>
          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md shadow-teal-600/20 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Site Dashboard</span>
          </button>
        </div>
      ) : activeSite ? (
        /* Active Site Dashboard View */
        <div className="space-y-6">
          {/* Site Overview Header Banner */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              {/* Site Details & Letter Grade */}
              <div className="flex items-center gap-5">
                {/* Health Grade Badge */}
                <div
                  className={`w-20 h-20 rounded-2xl border flex flex-col items-center justify-center shadow-sm ${gradeInfo.bg}`}
                >
                  <span className={`text-3xl font-black tracking-tight ${gradeInfo.color}`}>
                    {gradeInfo.grade}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Grade
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {activeSite.name}
                    </h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        SITE_TYPE_LABELS[activeSite.siteType || "general"].bg
                      } ${SITE_TYPE_LABELS[activeSite.siteType || "general"].color}`}
                    >
                      {SITE_TYPE_LABELS[activeSite.siteType || "general"].label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <a
                      href={activeSite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono font-medium text-teal-600 hover:underline hover:text-teal-700"
                    >
                      <span>{activeSite.domain}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <span>•</span>

                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Last Audited:{" "}
                        {latestAuditRow
                          ? new Date(latestAuditRow.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Never"}
                      </span>
                    </span>

                    <span>•</span>

                    <span>{siteAudits.length} Audits in History</span>
                  </div>

                  {activeSite.notes && (
                    <p className="text-xs text-slate-500 italic max-w-xl">"{activeSite.notes}"</p>
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => handleQuickRunAudit("deep")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition cursor-pointer active:scale-95"
                  title="Run fresh deep audit on this site"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Audit</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickCrawl}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition cursor-pointer active:scale-95"
                  title="Crawl full site using sitemap"
                >
                  <FileSearch className="w-3.5 h-3.5" />
                  <span>Crawl Sitemap</span>
                </button>

                {/* Send to Outreach Dashboard */}
                <button
                  type="button"
                  onClick={() => setShowOutreachModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer active:scale-95"
                  title="Push site and attached audit PDF to Outreach Dashboard"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to Outreach</span>
                </button>

                {latestAuditRow && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectAudit(latestAuditRow);
                      onOpenAuditStudio();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-700 font-bold text-xs transition cursor-pointer active:scale-95"
                    title="Inspect the latest audit in the full Audit Studio"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Open in Studio</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenEditModal(activeSite)}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 transition cursor-pointer active:scale-95"
                  title="Edit Site Settings"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteSite(activeSite.id)}
                  className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 transition cursor-pointer active:scale-95"
                  title="Delete this Site Dashboard"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Key Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Score Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Health Score
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">
                    {latestAuditRow?.score ?? "—"}
                  </span>
                  <span className="text-xs text-slate-400">/ 100</span>
                </div>
                {scoreDiff !== null ? (
                  <p
                    className={`text-xs font-bold flex items-center gap-1 ${
                      scoreDiff > 0
                        ? "text-emerald-600"
                        : scoreDiff < 0
                        ? "text-rose-600"
                        : "text-slate-500"
                    }`}
                  >
                    <TrendingUp className="w-3 h-3" />
                    <span>
                      {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff} pts vs last scan
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 font-medium">Initial baseline</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                <Gauge className="w-6 h-6" />
              </div>
            </div>

            {/* Pass Rate & Technical Health */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Checks Pass Rate
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">{passRate}%</span>
                  <span className="text-xs text-slate-400">
                    ({counts.pass}/{totalChecks})
                  </span>
                </div>
                <p className="text-xs text-emerald-600 font-bold">
                  {counts.pass} checks passing verified
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            {/* Critical Issues & Warnings */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Issues to Fix
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-rose-600">{counts.fail}</span>
                    <span className="text-[11px] font-bold text-rose-500">Critical</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-amber-600">{counts.warn}</span>
                    <span className="text-[11px] font-bold text-amber-500">Warnings</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 font-medium">Requires developer attention</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            {/* Performance & Security Status */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Page Performance
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">
                    {latestResult?.pageSpeed?.responseTimeMs
                      ? `${latestResult.pageSpeed.responseTimeMs}ms`
                      : "—"}
                  </span>
                  <span className="text-[11px] text-slate-400">Response</span>
                </div>
                <p className="text-xs text-teal-700 font-semibold">
                  {latestResult?.pageSpeed?.mobileOptimized ? "Mobile-Friendly" : "Standard Engine"}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Navigation Tabs for Deep Dive */}
          <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "overview"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Executive Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("issues")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "issues"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <span>Issues Triage</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-extrabold">
                {counts.fail + counts.warn}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("categories")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "categories"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Category Scores
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <span>Scan Timeline</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-extrabold">
                {siteAudits.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("keywords")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "keywords"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Target Keywords
            </button>
          </div>

          {/* TAB 1: EXECUTIVE OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Category Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {latestResult?.categoryScores && latestResult.categoryScores.length > 0 ? (
                  latestResult.categoryScores.map((cs) => {
                    const meta = CATEGORY_META[cs.category as CheckCategory] || {
                      label: cs.category,
                      color: "text-slate-700",
                    };
                    const colorClass =
                      cs.score >= 80
                        ? "text-emerald-600"
                        : cs.score >= 50
                        ? "text-amber-600"
                        : "text-rose-600";
                    const barColor =
                      cs.score >= 80
                        ? "bg-emerald-500"
                        : cs.score >= 50
                        ? "bg-amber-500"
                        : "bg-rose-500";
                    return (
                      <div
                        key={cs.category}
                        className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs text-center"
                      >
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate mb-1">
                          {meta.label}
                        </p>
                        <p className={`text-2xl font-black ${colorClass}`}>{cs.score}</p>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${Math.min(100, Math.max(0, cs.score))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                    Run an audit to view category health distributions.
                  </div>
                )}
              </div>

              {/* Priority Fixes Roadmap */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Priority Action Roadmap for {activeSite.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Highest impact optimizations recommended for this site
                      </p>
                    </div>
                  </div>
                </div>

                {recommendations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                    {recommendations.slice(0, 6).map((rec, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all ${
                          rec.priority === "high"
                            ? "bg-rose-50/50 border-rose-200/70"
                            : rec.priority === "medium"
                            ? "bg-amber-50/50 border-amber-200/70"
                            : "bg-blue-50/50 border-blue-200/70"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              rec.priority === "high"
                                ? "bg-rose-100 text-rose-800"
                                : rec.priority === "medium"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {rec.priority} priority
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mb-1">{rec.title}</h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{rec.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    No critical recommendations pending. Your site passed major health heuristics!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ISSUES TRIAGE */}
          {activeTab === "issues" && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Audit Checks & Issues Triage
                  </h3>
                  <p className="text-xs text-slate-500">
                    Filter and inspect all individual technical and on-page tests
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  {(["all", "fail", "warn", "pass"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setIssueFilter(mode)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer capitalize ${
                        issueFilter === mode
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {mode === "all" ? "All Checks" : mode}
                    </button>
                  ))}
                </div>
              </div>

              {filteredChecks.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
                  {filteredChecks.map((c) => {
                    const isPass = c.status === "pass";
                    const isFail = c.status === "fail";
                    const isWarn = c.status === "warn";
                    return (
                      <div
                        key={c.id}
                        className="p-3.5 hover:bg-slate-50/80 transition flex items-start gap-3"
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {isPass && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          {isFail && <XCircle className="w-4 h-4 text-rose-600" />}
                          {isWarn && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                          {!isPass && !isFail && !isWarn && (
                            <Clock className="w-4 h-4 text-sky-600" />
                          )}
                        </div>

                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">{c.label}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-slate-100 text-slate-600">
                              {c.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">{c.detail}</p>
                          {c.value && (
                            <div className="text-[11px] font-mono bg-slate-100/80 text-slate-700 px-2 py-0.5 rounded-md inline-block mt-1">
                              {c.value}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                  No checks found matching this filter.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CATEGORY SCORES */}
          {activeTab === "categories" && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-6">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Comprehensive Category Analysis
                </h3>
                <p className="text-xs text-slate-500">
                  Detailed health breakdown across standard SEO disciplines
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {latestResult?.categoryScores?.map((cs) => {
                  const meta = CATEGORY_META[cs.category as CheckCategory] || {
                    label: cs.category,
                    color: "text-slate-700",
                    bg: "bg-slate-50",
                  };
                  return (
                    <div
                      key={cs.category}
                      className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/40 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{meta.label}</span>
                        <span className="text-lg font-black text-slate-900">{cs.score} / 100</span>
                      </div>

                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            cs.score >= 80
                              ? "bg-emerald-500"
                              : cs.score >= 50
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, cs.score))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span className="text-emerald-600 font-semibold">{cs.pass} Passed</span>
                        <span className="text-amber-600 font-semibold">{cs.warn} Warnings</span>
                        <span className="text-rose-600 font-semibold">{cs.fail} Failed</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: SCAN TIMELINE */}
          {activeTab === "history" && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Historical Scans for {activeSite.domain}
                  </h3>
                  <p className="text-xs text-slate-500">
                    View performance changes and previous audit reports
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickRunAudit("standard")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold border border-teal-200/60 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Scan</span>
                </button>
              </div>

              {siteAudits.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
                  {siteAudits.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 hover:bg-slate-50/80 transition flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                            (a.score || 0) >= 80
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : (a.score || 0) >= 50
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {a.score ?? "—"}
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {new Date(a.created_at).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            {" · "}
                            {new Date(a.created_at).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="capitalize">{a.audit_type || "single"} audit</span>
                            <span>•</span>
                            <span className="capitalize">{a.audit_depth || "deep"} scan</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectAudit(a);
                          onOpenAuditStudio();
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        <span>Open Report</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                  No historical scans recorded for this site yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: TARGET KEYWORDS */}
          {activeTab === "keywords" && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Monitored Target Keywords
                  </h3>
                  <p className="text-xs text-slate-500">
                    Keywords you intend to rank for on {activeSite.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(activeSite)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 hover:text-teal-700 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Manage Keywords</span>
                </button>
              </div>

              {activeSite.targetKeywords && activeSite.targetKeywords.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeSite.targetKeywords.map((kw, i) => {
                    // Check if keyword is found in latestResult
                    const foundInResult = latestResult?.keywords?.some((k) =>
                      k.keyword.toLowerCase().includes(kw.toLowerCase())
                    );
                    return (
                      <div
                        key={i}
                        className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-teal-600" />
                          <span className="text-xs font-bold text-slate-800">{kw}</span>
                        </div>
                        {foundInResult ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Present in Content
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            Not in Content
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No target keywords set yet. Click "Manage Keywords" above to add keywords to track!
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* CREATE / EDIT SITE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingSite ? "Edit Site Dashboard" : "Create Site Dashboard"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSite} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Site URL */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Website URL or Domain <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
                  required
                />
              </div>

              {/* Site Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Dashboard Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Online Store (Optional)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              {/* Site Category */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Site Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as SiteTypeCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="general">General Website</option>
                  <option value="ecommerce">E-Commerce</option>
                  <option value="saas">SaaS / Web App</option>
                  <option value="blog">Blog & Content</option>
                  <option value="corporate">Corporate / B2B</option>
                  <option value="agency">Agency & Client</option>
                  <option value="portfolio">Portfolio & Personal</option>
                </select>
              </div>

              {/* Target Keywords */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Target Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. technical seo, web design, online store"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Internal Notes</label>
                <textarea
                  rows={2}
                  placeholder="Goals, client notes, or tech stack..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs hover:shadow-teal-600/20 transition cursor-pointer"
                >
                  {editingSite ? "Save Changes" : "Create Site Dashboard"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send to Outreach Modal */}
      {activeSite && (
        <SendToOutreachModal
          isOpen={showOutreachModal}
          onClose={() => setShowOutreachModal(false)}
          result={latestResult || {}}
          targetUrl={activeSite.url}
          defaultBusinessName={activeSite.name}
        />
      )}
    </div>
  );
}
