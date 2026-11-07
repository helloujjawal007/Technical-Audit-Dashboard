import React, { useState, useEffect, useCallback } from "react";
import { supabase, supabaseAnonKey } from "@/lib/supabase";
import {
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  FileText,
  ExternalLink,
  ShieldAlert,
  Zap,
  Activity,
  X,
  Copy,
  Check,
} from "lucide-react";
import type { OdJob, OdJobStatus, OdQueueStatus } from "@/types";

type FilterTab = "all" | "running" | "queued" | "completed" | "undelivered" | "failed";

export function OdJobsView() {
  const [jobs, setJobs] = useState<OdJob[]>([]);
  const [stats, setStats] = useState<OdQueueStatus>({
    total: 0,
    running: 0,
    queued: 0,
    completed: 0,
    partial: 0,
    failed: 0,
    undelivered: 0,
    maxConcurrency: 5,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [selectedTakeawaysJob, setSelectedTakeawaysJob] = useState<OdJob | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Form for triggering a test OD audit (C4: sandbox test drawer)
  const [testLeadId, setTestLeadId] = useState(`lead_${Date.now().toString().slice(-4)}`);
  const [testWebsite, setTestWebsite] = useState("https://example.com");
  const [testCompany, setTestCompany] = useState("Example Brand");
  const [testCallbackUrl, setTestCallbackUrl] = useState("http://localhost:5001/api/leads/audit-callback");
  const [submittingTest, setSubmittingTest] = useState(false);
  const [testStatusMsg, setTestStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Helper for UI requests: Uses Anon Key or user session token. Never exposes shared secret.
  const getUiAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {};
    if (supabaseAnonKey) {
      headers["apikey"] = supabaseAnonKey;
      headers["Authorization"] = `Bearer ${supabaseAnonKey}`;
    }
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers["Authorization"] = `Bearer ${data.session.access_token}`;
      }
    } catch {
      // fallback to anonKey
    }
    return headers;
  }, []);

  const fetchJobs = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const authHeaders = await getUiAuthHeaders();
      const res = await fetch("/api/od/jobs", {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.warn("Failed to fetch OD jobs:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getUiAuthHeaders]);

  useEffect(() => {
    fetchJobs();
    // Auto-refresh every 3.5 seconds
    const interval = setInterval(() => {
      fetchJobs(true);
    }, 3500);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleRetryCallback = async (jobId: string) => {
    setRetryingJobId(jobId);
    try {
      const authHeaders = await getUiAuthHeaders();
      const res = await fetch("/api/od/retry-callback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchJobs(true);
      } else {
        alert(`Retry failed: ${data.message || data.error || "Unknown error"}`);
      }
    } catch (err: unknown) {
      alert(`Retry failed: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleSendTestRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingTest(true);
    setTestStatusMsg(null);

    try {
      // C4: Call backend test-request endpoint (never exposes secret in browser, restricted to sandbox domains)
      const authHeaders = await getUiAuthHeaders();
      const res = await fetch("/api/od/test-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          leadId: testLeadId,
          website: testWebsite,
          company: testCompany,
          callbackUrl: testCallbackUrl,
          slotId: 1,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestStatusMsg({
          type: "success",
          text: `Success (${res.status}): ${data.message || "Enqueued"}. Job ID: ${data.jobId}`,
        });
        setTestLeadId(`lead_${Date.now().toString().slice(-4)}`);
        fetchJobs(true);
      } else {
        setTestStatusMsg({
          type: "error",
          text: `Error (${res.status}): ${data.error || "Request failed"}`,
        });
      }
    } catch (err: unknown) {
      setTestStatusMsg({
        type: "error",
        text: `Network failure: ${err instanceof Error ? err.message : "Could not reach endpoint"}`,
      });
    } finally {
      setSubmittingTest(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "running" && job.status === "running") ||
      (filter === "queued" && job.status === "queued") ||
      (filter === "completed" && (job.status === "ready" || job.status === "partial")) ||
      (filter === "undelivered" && job.status === "undelivered") ||
      (filter === "failed" && job.status === "failed");

    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      String(job.leadId).toLowerCase().includes(query) ||
      job.website.toLowerCase().includes(query) ||
      (job.company && job.company.toLowerCase().includes(query)) ||
      job.id.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: OdJobStatus) => {
    switch (status) {
      case "running":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
            Auditing (Active)
          </span>
        );
      case "queued":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" />
            Queued
          </span>
        );
      case "ready":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Ready (Delivered)
          </span>
        );
      case "partial":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Layers className="w-3 h-3 text-purple-600" />
            Partial (Delivered)
          </span>
        );
      case "undelivered":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
            <ShieldAlert className="w-3 h-3 text-amber-600" />
            Undelivered Callback
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Audit Failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-teal-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                <Activity className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Outreach Dashboard Queue & Intake Engine
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-300 max-w-2xl">
              Handles asynchronous intake of up to 5 concurrent audit requests from OD (localhost:5001), runs staged technical inspections with 7-minute budget guards, generates concrete takeaways + PDFs, and automatically delivers callbacks.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTestModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              Send Test OD Request
            </button>
            <button
              onClick={() => fetchJobs()}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>Active Concurrency</span>
              <span className={`w-2 h-2 rounded-full ${stats.running > 0 ? "bg-amber-400 animate-pulse" : "bg-slate-500"}`} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-300">{stats.running}</span>
              <span className="text-xs text-slate-400">/ {stats.maxConcurrency} max</span>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-xs text-slate-400 font-medium">In Queue</div>
            <div className="mt-1 text-2xl font-black text-slate-200">{stats.queued}</div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-xs text-slate-400 font-medium">Completed & Delivered</div>
            <div className="mt-1 text-2xl font-black text-emerald-400">{stats.completed + stats.partial}</div>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="text-xs text-slate-400 font-medium">Undelivered / Failed</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-2xl font-black ${stats.undelivered > 0 ? "text-amber-400" : "text-slate-400"}`}>
                {stats.undelivered}
              </span>
              {stats.failed > 0 && (
                <span className="text-xs text-rose-400 font-semibold">({stats.failed} failed)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Undelivered Callbacks Alert Callout */}
      {stats.undelivered > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                {stats.undelivered} Undelivered Callback{stats.undelivered > 1 ? "s" : ""}
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                The technical audit finished successfully, but could not reach the Outreach Dashboard callback endpoint (e.g., OD was offline or returned non-200). Click <strong>Retry Callback</strong> below once OD is available.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilter("undelivered")}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors"
          >
            View Undelivered
          </button>
        </div>
      )}

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { key: "all", label: "All Jobs", count: stats.total },
              { key: "running", label: "Running", count: stats.running },
              { key: "queued", label: "Queued", count: stats.queued },
              { key: "completed", label: "Completed", count: stats.completed + stats.partial },
              { key: "undelivered", label: "Undelivered", count: stats.undelivered },
              { key: "failed", label: "Failed", count: stats.failed },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filter === tab.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Lead ID, Domain..."
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Jobs Table / Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && jobs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
            <p className="text-sm">Loading OD queue state...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No OD audit jobs found</p>
            <p className="text-xs text-slate-400 mt-1">
              {jobs.length === 0
                ? "Jobs will appear here as soon as OD posts to POST /api/od/audit-request."
                : "No jobs match your current filter."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredJobs.map((job) => (
              <div key={job.id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Target & Lead Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(job.status)}
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        Lead: {job.leadId}
                      </span>
                      {job.slotId && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200">
                          Slot: {job.slotId}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        {new Date(job.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-900 truncate">
                        {job.company || "Target Prospect"}
                      </span>
                      <a
                        href={job.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 underline underline-offset-2 truncate"
                      >
                        {job.website}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>

                    {/* Finished Stages Pills */}
                    {job.stagesFinished && job.stagesFinished.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-medium text-slate-400">Stages:</span>
                        {job.stagesFinished.map((stg) => (
                          <span
                            key={stg}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                          >
                            <Check className="w-2.5 h-2.5 text-teal-600" />
                            {stg}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Error Banner if Job or Callback Failed */}
                    {job.error && (
                      <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 mt-2">
                        <strong>Audit Failure:</strong> {job.error}
                      </div>
                    )}
                    {job.callbackConfigError && (
                      <div className="text-xs text-rose-800 bg-rose-50 border border-rose-300 rounded-lg p-2.5 mt-2 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold">Configuration Error:</strong> {job.callbackConfigError}
                        </div>
                      </div>
                    )}
                    {job.callbackError && !job.callbackConfigError && (
                      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                        <strong>Delivery Failure:</strong> {job.callbackError}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Score, Takeaways & Actions */}
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {/* Score Gauge */}
                    {typeof job.score === "number" && (
                      <div className="text-center px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-xs font-bold text-slate-500">Score</div>
                        <div className="text-lg font-black text-slate-900 leading-tight">
                          {job.score}
                          <span className="text-xs font-bold text-teal-600 ml-1">({job.grade || "B"})</span>
                        </div>
                      </div>
                    )}

                    {/* View Takeaways Modal Button */}
                    {job.takeaways && (
                      <button
                        onClick={() => setSelectedTakeawaysJob(job)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs transition-colors cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        Takeaways ({job.takeaways.topIssues?.length || 0})
                      </button>
                    )}

                    {/* View / Download PDF */}
                    {job.pdfPath && (
                      <a
                        href={`/functions/v1/generate-pdf?path=${encodeURIComponent(job.pdfPath)}`}
                        download={job.pdfName || "audit.pdf"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-teal-600" />
                        PDF Report
                      </a>
                    )}

                    {/* Retry Callback Button (Prominent when undelivered) */}
                    {(job.status === "undelivered" || job.callbackSuccess === false) && (
                      <button
                        onClick={() => handleRetryCallback(job.id)}
                        disabled={retryingJobId === job.id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${retryingJobId === job.id ? "animate-spin" : ""}`} />
                        {retryingJobId === job.id ? "Delivering..." : "Retry Callback"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Takeaways Modal Dialog */}
      {selectedTakeawaysJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800">
                    OD Payload Deliverable
                  </span>
                  <span className="text-xs font-mono text-slate-500">Lead: {selectedTakeawaysJob.leadId}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Executive Takeaways — {selectedTakeawaysJob.company || selectedTakeawaysJob.website}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTakeawaysJob(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Executive Narrative */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900 block mb-1">Executive Summary Text (Email Ready):</span>
                {selectedTakeawaysJob.takeaways?.summaryText}
              </div>

              {/* Concrete Issues List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Top 3-5 Concrete Bottlenecks Sent to OD:
                </h4>
                {selectedTakeawaysJob.takeaways?.topIssues.map((issue, idx) => (
                  <div
                    key={issue.id || idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-xs">{issue.finding}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          issue.severity === "critical"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : issue.severity === "high"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {issue.severity}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-[11px] font-mono font-bold text-teal-800">
                        Metric: {issue.metric}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Sample size: {issue.sampleSize || 1} pages checked
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">{issue.detail}</p>
                    <p className="text-xs text-emerald-700 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                      <strong>Fix:</strong> {issue.recommendation}
                    </p>
                  </div>
                ))}
              </div>

              {/* Raw JSON Payload Accordion */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700">Raw Deliverable JSON</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedTakeawaysJob.takeaways, null, 2));
                      setCopiedPayload(true);
                      setTimeout(() => setCopiedPayload(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700"
                  >
                    {copiedPayload ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedPayload ? "Copied" : "Copy JSON"}
                  </button>
                </div>
                <pre className="text-[11px] font-mono bg-slate-900 text-slate-200 p-3 rounded-xl overflow-x-auto max-h-48">
                  {JSON.stringify(selectedTakeawaysJob.takeaways, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setSelectedTakeawaysJob(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test OD Request Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Send Test OD Audit Request</h3>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendTestRequest} className="p-5 space-y-3.5">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <strong>Sandbox Security:</strong> The test drawer uses internal backend authorization and is strictly restricted to sandbox test domains (<code>example.com</code>, <code>example.org</code>, <code>httpbin.org</code>, <code>*.test</code>). Real client websites cannot be audited from this test drawer.
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Lead ID (Dedup Key)
                </label>
                <input
                  type="text"
                  required
                  value={testLeadId}
                  onChange={(e) => setTestLeadId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Website URL (Sandbox Domain)
                </label>
                <input
                  type="url"
                  required
                  value={testWebsite}
                  onChange={(e) => setTestWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Company / Brand Name
                </label>
                <input
                  type="text"
                  value={testCompany}
                  onChange={(e) => setTestCompany(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Callback URL (OD Receiver)
                </label>
                <input
                  type="url"
                  required
                  value={testCallbackUrl}
                  onChange={(e) => setTestCallbackUrl(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-slate-700"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tip: Use <code>http://localhost:5174/api/od/test-callback</code> to test callbacks inside TD without OD running.
                </p>
              </div>

              {testStatusMsg && (
                <div
                  className={`p-3 rounded-lg text-xs ${
                    testStatusMsg.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {testStatusMsg.text}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTest}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-50"
                >
                  {submittingTest ? "Sending..." : "Dispatch to Queue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
