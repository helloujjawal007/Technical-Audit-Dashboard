import { useCallback, useEffect, useRef, useState } from "react";
import { Search, AlertCircle, Loader2, History, ChevronDown, ChevronUp, Ghost } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { invokeEdgeFunction } from "@/lib/api";
import { AuthPage } from "@/components/AuthPage";
import { AuditForm } from "@/components/AuditForm";
import { HistoryList } from "@/components/HistoryList";
import { ResultsView } from "@/components/ResultsView";
import { CrawlResultsView } from "@/components/CrawlResultsView";
import { AllHistoryModal } from "@/components/AllHistoryModal";
import { CreditDisplay } from "@/components/CreditDisplay";
import { NavBar } from "@/components/NavBar";
import { getCreditUsage, getAllCreditUsage, recordCreditUsage, canStartAudit, getGuestCreditUsage, recordGuestCreditUsage, canStartGuestAudit } from "@/lib/credits";
import type { AuditResult, AuditRow, AuditMode, AuditDepth, CrawlPageResult, CustomExtractionFields } from "@/types";

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

function App() {
  const { user, loading: authLoading, signOut, guest, signInAsGuest, exitGuest } = useAuth();
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

  const [auditStarted, setAuditStarted] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [guestCredits, setGuestCredits] = useState<number | null>(null);

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
    setAuditStarted(true);
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
        .insert({ url: normalizedUrl, status: "running", audit_type: auditType, audit_depth: depth })
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
            .insert({ url: pageUrl, status: "running", audit_type: auditType, audit_depth: depth })
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
    setAuditStarted(true);

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (!user && !guest) {
    return <AuthPage onGuestLogin={signInAsGuest} />;
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Guest";
  const isGuest = Boolean(!user && guest);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <NavBar
        userName={userName}
        isGuest={isGuest}
        guestCredits={guestCredits}
        onSignOut={signOut}
        onExitGuest={exitGuest}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
            <section className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
              {/* Audit form card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-800 mb-4">Start a New Audit</h2>
                <AuditForm onAudit={handleAudit} loading={loading} paused={paused} onPauseToggle={() => {
                  if (paused) {
                    setPaused(false);
                    pauseRef.current = false;
                  } else {
                    setPaused(true);
                    pauseRef.current = true;
                  }
                }} />
                {creditError && (
                  <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 text-amber-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{creditError}</span>
                  </div>
                )}
                {error && view === "single" && (
                  <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Right sidebar: Credits + History */}
              <aside className="space-y-4">
                {!isGuest && <CreditDisplay />}
                {isGuest && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                          <Ghost className="w-4 h-4 text-teal-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Guest Mode</p>
                          <p className="text-xs text-slate-400">Limited daily audits</p>
                        </div>
                      </div>
                      {guestCredits !== null && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Credits remaining</span>
                            <span className="text-xs font-semibold text-teal-600">{guestCredits}</span>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-2">Sign up for a free account to get more credits and save your audit history.</p>
                    </div>
                  </div>
                )}
                {!isGuest && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      onClick={() => setHistoryExpanded(!historyExpanded)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                          <History className="w-4 h-4 text-teal-500" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-700">Audit History</p>
                          <p className="text-xs text-slate-400">{audits.length} audits</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          onClick={(e) => { e.stopPropagation(); setShowAllHistory(true); }}
                          className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors cursor-pointer"
                        >
                          View All
                        </span>
                        {historyExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>
                    {historyExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-100">
                        {loadingHistory ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
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
                    )}
                  </div>
                )}
              </aside>
            </section>

            {/* Section 2: Results */}
            {auditStarted && (
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[500px]">
                {view === "crawl" && (crawlPages.length > 0 || isCrawling || error) ? (
                  <CrawlResultsView
                    pages={crawlPages}
                    baseUrl={crawlBaseUrl}
                    sitemapUrl={crawlSitemapUrl}
                    crawlProgress={crawlProgress}
                    isCrawling={isCrawling}
                    paused={paused}
                  />
                ) : result && selected ? (
                  <ResultsView result={result} url={selected.url} auditId={selected.id} />
                ) : loading && view === "single" ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-teal-500" />
                    <p className="text-sm font-medium text-slate-600">Analyzing your site...</p>
                    <p className="text-xs text-slate-400 mt-1">This takes a few seconds while we fetch and parse the page.</p>
                  </div>
                ) : loading && view === "crawl" ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-teal-500" />
                    <p className="text-sm font-medium text-slate-600">Reading sitemap...</p>
                    <p className="text-xs text-slate-400 mt-1">Traversing sitemap layers to discover all pages.</p>
                  </div>
                ) : selected && !result && selected.status === "running" ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-teal-500" />
                    <p className="text-sm font-medium text-slate-600">Audit in progress...</p>
                  </div>
                ) : error && view === "single" && selected ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
                    <p className="text-sm font-medium text-slate-700">{error}</p>
                    <p className="text-xs text-slate-400 mt-1">Try running the audit again.</p>
                  </div>
                ) : error && view === "crawl" ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
                    <p className="text-sm font-medium text-slate-700">{error}</p>
                    <p className="text-xs text-slate-400 mt-1">Make sure your site has a sitemap.xml or sitemap_index.xml file.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-teal-500" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-700">Ready to audit</h2>
                    <p className="text-sm text-slate-400 mt-1 max-w-sm">
                      Enter a URL above to run a complete SEO audit. Results show every affected URL, issue explanation, and recommended fix.
                    </p>
                  </div>
                )}
              </section>
            )}
      </div>

      {/* All History Modal */}
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
