import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, History, Ghost, BarChart3, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { isSystemAdminUser } from "@/lib/admin";
import { invokeEdgeFunction } from "@/lib/api";
import { AuthPage } from "@/components/AuthPage";
import { AuditForm } from "@/components/AuditForm";
import { HistoryList } from "@/components/HistoryList";
import { ResultsView } from "@/components/ResultsView";
import { CrawlResultsView } from "@/components/CrawlResultsView";
import { AllHistoryModal } from "@/components/AllHistoryModal";
import { CreditDisplay } from "@/components/CreditDisplay";
import { NavBar, type NavPage } from "@/components/NavBar";
import { ModernScanningState } from "@/components/ModernScanningState";
import { ReadyHeroState } from "@/components/ReadyHeroState";
import { HistoryPageView } from "@/components/HistoryPageView";
import { ComparePageView } from "@/components/ComparePageView";
import { SettingsPageView } from "@/components/SettingsPageView";
import { getCreditUsage, getAllCreditUsage, recordCreditUsage, canStartAudit, getGuestCreditUsage, recordGuestCreditUsage, canStartGuestAudit } from "@/lib/credits";
import type { AuditResult, AuditRow, AuditMode, AuditDepth, CrawlPageResult, CustomExtractionFields } from "@/types";

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

function App() {
  const {
    user,
    loading: authLoading,
    signOut,
    guest,
    signInAsGuest,
    exitGuest,
    subscription,
    isRecovery,
    clearRecovery,
    authUrlError,
    clearAuthUrlError,
    emailVerifiedWelcome,
    clearEmailVerifiedWelcome,
    passwordResetSuccess,
    clearPasswordResetSuccess,
  } = useAuth();
  const [activeNav, setActiveNav] = useState<NavPage>("audit");
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Crawl/multi state
  const [crawlPages, setCrawlPages] = useState<CrawlPageResult[]>([]);
  const [crawlBaseUrl, setCrawlBaseUrl] = useState<string>("");
  const [crawlSitemapUrl, setCrawlSitemapUrl] = useState<string | null>(null);
  const [crawlProgress, setCrawlProgress] = useState({ completed: 0, total: 0 });
  const [isCrawling, setIsCrawling] = useState(false);
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const [view, setView] = useState<"single" | "crawl">("single");

  const [showAllHistory, setShowAllHistory] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [guestCredits, setGuestCredits] = useState<number | null>(null);

  // Shared public audit state (?report= or ?auditId=)
  const [sharedReportId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("report") || params.get("auditId");
  });
  const [sharedAudit, setSharedAudit] = useState<{ row: AuditRow; result: AuditResult } | null>(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);

  useEffect(() => {
    if (!sharedReportId) return;
    setSharedLoading(true);
    supabase
      .from("seo_audits")
      .select("*")
      .eq("id", sharedReportId)
      .single()
      .then(({ data, error }) => {
        setSharedLoading(false);
        if (error || !data) {
          setSharedError("Audit report not found or link has expired.");
          return;
        }
        const row = data as AuditRow;
        const resData = (row.result_data || {
          score: row.score || 0,
          title: row.title,
          description: row.description,
          checks: row.checks || [],
          categoryScores: [],
          robotsContent: null,
          sitemapContent: null,
          sitemapUrl: null,
          headers: {},
          socialPreview: { ogTitle: null, ogDescription: null, ogImage: null, twitterCard: null, twitterTitle: null, twitterDescription: null, twitterImage: null },
          links: [],
          headings: [],
          images: [],
          keywords: [],
          schema: [],
          pageSpeed: { responseTimeMs: 0, htmlSizeBytes: 0, estimatedTransferTimeSec: 0, resources: 0, scripts: 0, stylesheets: 0, images: 0, mobileOptimized: false, hasViewport: false, recommendations: [] },
          linkAnalysis: { internal: [], external: [], dofollow: [], nofollow: [], total: 0 },
          hasTOC: false,
          hasFAQ: false,
          hasInfographic: false,
          recommendations: [],
          noindex: { indexable: true, source: null, directive: null, detail: "" },
          googleProperties: [],
          internalLinkStatuses: [],
          schemaValidation: [],
          contentRecommendations: [],
          keywordMetrics: [],
        }) as AuditResult;
        setSharedAudit({ row, result: resData });
      });
  }, [sharedReportId]);

  // Fetch guest credit usage
  useEffect(() => {
    if (guest) {
      getGuestCreditUsage(guest.ipKey).then((u) => setGuestCredits(u.remaining));
    } else {
      setGuestCredits(null);
    }
  }, [guest]);

  const fetchAudits = useCallback(async () => {
    if (!user) return;
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoIso = threeMonthsAgo.toISOString();

    const { data, error } = await supabase
      .from("seo_audits")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", threeMonthsAgoIso)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!error && data) {
      setAudits(data as AuditRow[]);
    }
    setLoadingHistory(false);
  }, [user]);

  const refreshCreditUsage = useCallback(async () => {
    if (!user) return;
    await getAllCreditUsage(user.id);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAudits();
      refreshCreditUsage();
    } else {
      setAudits([]);
      setLoadingHistory(false);
    }
  }, [user, fetchAudits, refreshCreditUsage]);

  const auditSinglePage = async (url: string, auditId?: string, depth?: AuditDepth, mode: string = "single", extractionFields?: CustomExtractionFields): Promise<AuditResult> => {
    return await invokeEdgeFunction<AuditResult>("seo-audit", {
      method: "POST",
      body: { url, auditId, mode, auditDepth: depth || "standard", extractionFields },
    });
  };

  const handleAudit = async (input: string, mode: AuditMode, depth: AuditDepth, _extractionFields?: CustomExtractionFields) => {
    // Check credits — user or guest
    if (user) {
      const usage = await getCreditUsage(user.id, mode);
      const check = canStartAudit(usage);
      if (!check.allowed) {
        setCreditError(check.message || "Credit limit reached.");
        return;
      }
    } else if (guest) {
      const check = await canStartGuestAudit(guest.ipKey);
      if (!check.allowed) {
        setCreditError(check.message || "Guest credit limit reached.");
        return;
      }
    } else {
      return;
    }

    setCreditError(null);
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(null);
    setPaused(false);
    pauseRef.current = false;
    cancelRef.current = false;

    if (mode === "single" || mode === "custom") {
      setView("single");
      await handleSingleAudit(normalizeUrl(input), mode, depth, _extractionFields);
    } else if (mode === "multiple" || mode === "staging") {
      setView("crawl");
      await handleMultipleAudit(input, mode, depth);
    } else {
      setView("crawl");
      await handleCrawlAudit(normalizeUrl(input), mode, depth);
    }

    setLoading(false);

    // Record credit usage
    if (user) {
      await recordCreditUsage(user.id, mode, 1);
      await refreshCreditUsage();
    } else if (guest) {
      await recordGuestCreditUsage(guest.ipKey);
      const updated = await getGuestCreditUsage(guest.ipKey);
      setGuestCredits(updated.remaining);
    }
  };

  const handleSingleAudit = async (normalizedUrl: string, auditType: AuditMode, depth: AuditDepth, extractionFields?: CustomExtractionFields) => {
    let newAudit: AuditRow | null = null;

    if (user) {
      const { data, error } = await supabase
        .from("seo_audits")
        .insert({
          url: normalizedUrl,
          status: "running",
          audit_type: auditType,
          audit_depth: depth,
          user_id: user.id,
        })
        .select()
        .single();
      if (error || !data) {
        setError("Could not start the audit. Please try again.");
        return;
      }
      newAudit = data as AuditRow;
    }

    if (newAudit) {
      setAudits((prev) => [newAudit, ...prev]);
      setSelected(newAudit);
    } else {
      // Guest user: create a temporary pseudo-audit so results can display
      setSelected({
        id: `guest-${Date.now()}`,
        url: normalizedUrl,
        status: "running",
        score: null,
        title: null,
        description: null,
        checks: null,
        error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        result_data: null,
        user_id: null,
        audit_type: auditType,
        audit_depth: depth,
      });
    }

    try {
      const data = await auditSinglePage(normalizedUrl, newAudit?.id, depth, auditType, extractionFields);
      setResult(data);
      if (user) await fetchAudits();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Audit failed";
      setError(msg);
      if (user) await fetchAudits();
    }
  };

  const auditMultiplePages = async (urls: string[], auditType: AuditMode, depth: AuditDepth) => {
    setIsCrawling(true);
    setCrawlPages([]);
    setCrawlBaseUrl(urls.length > 0 ? urls[0] : "");
    setCrawlSitemapUrl(null);
    setCrawlProgress({ completed: 0, total: urls.length });

    const initialPages: CrawlPageResult[] = urls.map((u) => ({
      url: u,
      status: "pending",
      result: null,
      error: null,
    }));
    setCrawlPages(initialPages);

    let completedCount = 0;
    let nextIndex = 0;
    const CONCURRENCY = 5;

    const checkPaused = async () => {
      while (pauseRef.current && !cancelRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    };

    const worker = async () => {
      while (nextIndex < urls.length && !cancelRef.current) {
        await checkPaused();
        if (cancelRef.current) break;

        const i = nextIndex++;
        const pageUrl = urls[i];
        setCrawlPages((prev) => prev.map((p, idx) => idx === i ? { ...p, status: "running" } : p));

        let auditId: string | undefined;
        if (user) {
          const { data: auditRow } = await supabase
            .from("seo_audits")
            .insert({
              url: pageUrl,
              status: "running",
              audit_type: auditType,
              audit_depth: depth,
              user_id: user.id,
            })
            .select()
            .single();
          auditId = (auditRow as AuditRow | null)?.id;
        }

        try {
          const pageResult = await auditSinglePage(pageUrl, auditId, depth);
          setCrawlPages((prev) => prev.map((p, idx) => idx === i ? {
            ...p, status: "completed", result: pageResult, error: null,
          } : p));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Audit failed";
          setCrawlPages((prev) => prev.map((p, idx) => idx === i ? {
            ...p, status: "failed", error: msg,
          } : p));
        }

        completedCount++;
        setCrawlProgress({ completed: completedCount, total: urls.length });
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker());
    await Promise.all(workers);

    setIsCrawling(false);
    if (user) await fetchAudits();
  };

  const handleMultipleAudit = async (rawInput: string, auditType: AuditMode, depth: AuditDepth) => {
    const urls = rawInput
      .split(/[\n,]/)
      .map((u) => normalizeUrl(u))
      .filter((u) => u && /^https?:\/\//i.test(u));

    const uniqueUrls = [...new Set(urls)];

    if (uniqueUrls.length === 0) {
      setError("No valid URLs found. Please paste at least one URL.");
      return;
    }

    await auditMultiplePages(uniqueUrls, auditType, depth);
  };

  const handleCrawlAudit = async (normalizedUrl: string, auditType: AuditMode, depth: AuditDepth) => {
    setIsCrawling(true);
    setError(null);
    setCrawlPages([]);
    setCrawlBaseUrl(normalizedUrl);
    setCrawlSitemapUrl(null);

    try {
      const crawlData = await invokeEdgeFunction<{ urls: string[]; sitemapUrl: string | null; sitemapsChecked?: string[] }>("seo-audit", {
        method: "POST",
        body: { url: normalizedUrl, mode: "crawl", auditDepth: depth },
      });
      const urls = crawlData.urls;

      if (!urls || urls.length === 0) {
        throw new Error("No page URLs found after traversing the sitemap. Cannot crawl.");
      }

      setCrawlSitemapUrl(crawlData.sitemapUrl);
      await auditMultiplePages(urls, auditType, depth);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Crawl failed";
      setError(msg);
      setIsCrawling(false);
    }
  };

  const handleSelect = async (audit: AuditRow) => {
    setSelected(audit);
    setError(null);
    setResult(null);
    setView("single");

    if (audit.status === "completed" && audit.result_data) {
      setResult(audit.result_data);
    } else if (audit.status === "completed" && audit.checks) {
      const checks = audit.checks as unknown as AuditResult["checks"];
      setResult({
        score: audit.score || 0,
        title: audit.title,
        description: audit.description,
        checks,
        categoryScores: [],
        robotsContent: null,
        sitemapContent: null,
        sitemapUrl: null,
        headers: {},
        socialPreview: { ogTitle: null, ogDescription: null, ogImage: null, twitterCard: null, twitterTitle: null, twitterDescription: null, twitterImage: null },
        links: [],
        headings: [],
        images: [],
        keywords: [],
        schema: [],
        pageSpeed: { responseTimeMs: 0, htmlSizeBytes: 0, estimatedTransferTimeSec: 0, resources: 0, scripts: 0, stylesheets: 0, images: 0, mobileOptimized: false, hasViewport: false, recommendations: [] },
        linkAnalysis: { internal: [], external: [], dofollow: [], nofollow: [], total: 0 },
        hasTOC: false,
        hasFAQ: false,
        hasInfographic: false,
        recommendations: [],
        noindex: { indexable: true, source: null, directive: null, detail: "" },
        googleProperties: [],
        internalLinkStatuses: [],
        schemaValidation: [],
        contentRecommendations: [],
        keywordMetrics: [],
      });
    } else if (audit.status === "failed") {
      setError(audit.error || "This audit failed to complete.");
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("seo_audits").delete().eq("id", id);
    setAudits((prev) => prev.filter((a) => a.id !== id));
    if (selected?.id === id) {
      setSelected(null);
      setResult(null);
    }
    await refreshCreditUsage();
  };

  const handleClearAllHistory = async () => {
    if (user) {
      await supabase.from("seo_audits").delete().eq("user_id", user.id);
    }
    setAudits([]);
    setSelected(null);
    setResult(null);
    await refreshCreditUsage();
  };

  const handleDeleteSelected = async (ids: string[]) => {
    if (ids.length === 0) return;
    await supabase.from("seo_audits").delete().in("id", ids);
    setAudits((prev) => prev.filter((a) => !ids.includes(a.id)));
    if (selected && ids.includes(selected.id)) {
      setSelected(null);
      setResult(null);
    }
    await refreshCreditUsage();
  };

  if (sharedLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <Loader2 className="w-10 h-10 text-teal-400 animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-tight">Loading Audit Report...</h2>
        <p className="text-sm text-slate-400 mt-1">Retrieving technical SEO benchmarks</p>
      </div>
    );
  }

  if (sharedError) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Report Unavailable</h2>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">{sharedError}</p>
        <button
          type="button"
          onClick={() => {
            window.location.href = window.location.pathname;
          }}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-teal-500/20"
        >
          <ArrowLeft className="w-4 h-4" /> Go to Audit Studio
        </button>
      </div>
    );
  }

  if (sharedAudit) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {/* Modern Public Header */}
        <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20 flex-shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase font-extrabold tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-md">
                  Shared Audit Report
                </span>
                <span className="text-xs text-slate-300 truncate max-w-xs sm:max-w-md font-mono">
                  {sharedAudit.row.url}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                window.location.href = window.location.pathname;
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all shadow-sm"
            >
              Run Your Own Audit
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
          <ResultsView
            result={sharedAudit.result}
            url={sharedAudit.row.url}
            auditId={sharedAudit.row.id}
          />
        </main>

        <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white">
          Technical SEO Audit Report generated automatically
        </footer>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (isRecovery || (!user && !guest)) {
    return (
      <AuthPage
        onGuestLogin={signInAsGuest}
        isRecoveryMode={isRecovery}
        onRecoveryComplete={clearRecovery}
        initialError={authUrlError}
        onClearInitialError={clearAuthUrlError}
      />
    );
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Guest";
  const isGuest = Boolean(!user && guest);
  const isAdmin = subscription?.tier === "admin" || isSystemAdminUser(user);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <NavBar
        userName={userName}
        isGuest={isGuest}
        isAdmin={isAdmin}
        guestCredits={guestCredits}
        activeNav={activeNav}
        onNavChange={setActiveNav}
        onSignOut={signOut}
        onExitGuest={exitGuest}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {emailVerifiedWelcome && (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold shadow-xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>Your email address has been verified successfully! Welcome to SEO Audit Pro.</span>
            </div>
            <button
              type="button"
              onClick={clearEmailVerifiedWelcome}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 ml-4 px-2.5 py-1 rounded-lg hover:bg-emerald-100/60 transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {passwordResetSuccess && (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 text-xs sm:text-sm font-semibold shadow-xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0" />
              <span>Your password has been updated successfully! Welcome back to SEO Audit Pro.</span>
            </div>
            <button
              type="button"
              onClick={clearPasswordResetSuccess}
              className="text-xs font-bold text-teal-700 hover:text-teal-900 ml-4 px-2.5 py-1 rounded-lg hover:bg-teal-100/60 transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Page 1: History & Reports */}
        {activeNav === "history" && (
          <HistoryPageView
            audits={audits}
            userEmail={user?.email || null}
            onSelectAudit={(a) => {
              handleSelect(a);
              setActiveNav("audit");
            }}
            onDeleteAudit={handleDelete}
            onDeleteSelected={handleDeleteSelected}
            onClearAllHistory={handleClearAllHistory}
            onStartNewAudit={() => setActiveNav("audit")}
          />
        )}

        {/* Page 2: Compare & Diff */}
        {activeNav === "compare" && (
          <ComparePageView
            audits={audits}
            onSelectAudit={(a) => {
              handleSelect(a);
              setActiveNav("audit");
            }}
          />
        )}

        {/* Page 3: Settings & Subscription */}
        {activeNav === "settings" && <SettingsPageView />}

        {/* Page 4: Primary Audit Studio */}
        {activeNav === "audit" && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
              {/* Audit form card */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
                    Launch Website Audit
                  </h2>
                  <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200/50">
                    Engine Ready
                  </span>
                </div>

                <AuditForm
                  onAudit={handleAudit}
                  loading={loading}
                  paused={paused}
                  onPauseToggle={() => {
                    if (paused) {
                      setPaused(false);
                      pauseRef.current = false;
                    } else {
                      setPaused(true);
                      pauseRef.current = true;
                    }
                  }}
                />

                {creditError && (
                  <div className="mt-4 flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium animate-fade-in">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                    <span>{creditError}</span>
                  </div>
                )}

                {error && view === "single" && (
                  <div className="mt-4 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-medium animate-fade-in">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Right sidebar: Credits + Recent Activity */}
              <aside className="space-y-4">
                {!isGuest && <CreditDisplay />}

                {isGuest && (
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                          <Ghost className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Guest Pass Active</p>
                          <p className="text-[11px] text-slate-400">Daily IP allowance</p>
                        </div>
                      </div>

                      {guestCredits !== null && (
                        <div className="p-2.5 rounded-xl bg-teal-50/50 border border-teal-100 flex items-center justify-between">
                          <span className="text-xs text-slate-600 font-medium">Credits Left:</span>
                          <span className="text-xs font-extrabold text-teal-700">{guestCredits} / 5</span>
                        </div>
                      )}

                      <p className="text-[11px] text-slate-400 leading-snug">
                        Create an account to save full audit reports and unlock deep parallel scanning.
                      </p>
                    </div>
                  </div>
                )}

                {!isGuest && (
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                          <History className="w-3.5 h-3.5" />
                        </div>
                        <p className="text-xs font-bold text-slate-800">Recent Audits</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveNav("history")}
                        className="text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors cursor-pointer"
                      >
                        View All ({audits.length})
                      </button>
                    </div>

                    <div className="p-3">
                      {loadingHistory ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
                        </div>
                      ) : (
                        <HistoryList
                          audits={audits}
                          onSelect={handleSelect}
                          selectedId={selected?.id || null}
                          onDelete={handleDelete}
                          onRefresh={fetchAudits}
                        />
                      )}
                    </div>
                  </div>
                )}
              </aside>
            </section>

            {/* Section 2: Results / Scanner / Ready Hero */}
            <section className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs min-h-[460px]">
              {loading ? (
                <ModernScanningState
                  url={selected?.url || (view === "crawl" ? crawlBaseUrl : "")}
                  isCrawl={view === "crawl"}
                />
              ) : view === "crawl" && (crawlPages.length > 0 || isCrawling || error) ? (
                <CrawlResultsView
                  pages={crawlPages}
                  baseUrl={crawlBaseUrl}
                  sitemapUrl={crawlSitemapUrl}
                  crawlProgress={crawlProgress}
                  isCrawling={isCrawling}
                  paused={paused}
                />
              ) : result && selected ? (
                <ResultsView
                  result={result}
                  url={selected.url}
                  auditId={selected.id}
                  onDelete={() => handleDelete(selected.id)}
                />
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-500 mb-3.5">
                    <AlertCircle className="w-7 h-7" />
                  </div>
                  <p className="text-base font-bold text-slate-800">{error}</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {view === "crawl"
                      ? "Make sure your domain has an accessible sitemap.xml file."
                      : "Please verify the URL is live and try again."}
                  </p>
                </div>
              ) : (
                <ReadyHeroState
                  onSelectSample={(sampleUrl) => handleAudit(sampleUrl, "single", "standard")}
                />
              )}
            </section>
          </div>
        )}
      </main>

      {/* All History Modal Fallback */}
      {!isGuest && (
        <AllHistoryModal
          open={showAllHistory}
          onClose={() => setShowAllHistory(false)}
          onSelect={handleSelect}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

export default App;
