import { useEffect, useMemo, useState } from "react";
import { Clock, ChevronRight, Trash2, Loader2, Globe, List, FileSearch, FlaskConical } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { scoreColor, type AuditRow } from "@/types";

interface HistoryListProps {
  audits: AuditRow[];
  onSelect: (audit: AuditRow) => void;
  selectedId: string | null;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

type IconComponent = typeof Globe;

const TYPE_TABS: { key: string; label: string; icon: IconComponent; color: string; bg: string; activeBg: string; activeText: string }[] = [
  { key: "crawl", label: "Site Crawl", icon: FileSearch, color: "text-emerald-600", bg: "bg-emerald-50", activeBg: "bg-emerald-600", activeText: "text-white" },
  { key: "multiple", label: "Multiple", icon: List, color: "text-slate-600", bg: "bg-slate-100", activeBg: "bg-slate-700", activeText: "text-white" },
  { key: "single", label: "Single", icon: Globe, color: "text-blue-600", bg: "bg-blue-50", activeBg: "bg-blue-600", activeText: "text-white" },
  { key: "staging", label: "Staging", icon: FlaskConical, color: "text-amber-600", bg: "bg-amber-50", activeBg: "bg-amber-600", activeText: "text-white" },
];

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " · " + date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDateGroup(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return u.hostname + path;
  } catch {
    return url;
  }
}

function domainOnly(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return url;
  }
}

function groupByDate(audits: AuditRow[]): { label: string; audits: AuditRow[] }[] {
  const groups = new Map<string, AuditRow[]>();
  audits.forEach((audit) => {
    const label = formatDateGroup(audit.created_at);
    const current = groups.get(label) || [];
    current.push(audit);
    groups.set(label, current);
  });
  return Array.from(groups.entries()).map(([label, groupedAudits]) => ({ label, audits: groupedAudits }));
}

export function HistoryList({ audits, onSelect, selectedId, onDelete, onRefresh }: HistoryListProps) {
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("crawl");

  useEffect(() => {
    const pending = audits.filter((a) => a.status === "pending" || a.status === "running");
    if (pending.length === 0) return;

    setPollingIds(new Set(pending.map((a) => a.id)));
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("seo_audits")
        .select("id, status, score, title, description, checks, result_data, error, audit_type, updated_at")
        .in("id", pending.map((a) => a.id));

      if (data && data.length > 0) {
        const stillRunning = data.filter((d) => d.status === "pending" || d.status === "running");
        setPollingIds(new Set(stillRunning.map((d) => d.id)));
        onRefresh();
        if (stillRunning.length === 0) clearInterval(interval);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [audits, onRefresh]);

  // Count audits per type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { single: 0, multiple: 0, crawl: 0, staging: 0 };
    const crawlDomains = new Set<string>();
    const stagingDomains = new Set<string>();
    audits.forEach((a) => {
      const type = a.audit_type || "single";
      if (type === "crawl") {
        crawlDomains.add(domainOnly(a.url));
      } else if (type === "staging") {
        stagingDomains.add(domainOnly(a.url));
      } else {
        counts[type] = (counts[type] || 0) + 1;
      }
    });
    counts.crawl = crawlDomains.size;
    counts.staging = stagingDomains.size;
    return counts;
  }, [audits]);

  // Filter audits by active tab
  const tabAudits = useMemo(() => {
    return audits.filter((a) => (a.audit_type || "single") === activeTab);
  }, [audits, activeTab]);

  // For crawl/staging tabs, group by domain to show one entry per domain
  const isDomainView = activeTab === "crawl" || activeTab === "staging";

  const domainGroups = useMemo(() => {
    if (!isDomainView) return null;
    const groups = new Map<string, AuditRow[]>();
    tabAudits.forEach((audit) => {
      const domain = domainOnly(audit.url);
      const current = groups.get(domain) || [];
      current.push(audit);
      groups.set(domain, current);
    });
    return Array.from(groups.entries()).map(([domain, domainAudits]) => ({ domain, audits: domainAudits }));
  }, [tabAudits, isDomainView]);

  if (audits.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-400">No audits yet. Run your first audit above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* TAB BUTTONS with counts */}
      <div className="grid grid-cols-2 gap-2">
        {TYPE_TABS.map((tab) => {
          const count = typeCounts[tab.key] || 0;
          const isActive = activeTab === tab.key;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                isActive
                  ? `${tab.activeBg} ${tab.activeText} border-transparent shadow-sm`
                  : `bg-white ${tab.color} border-slate-200 hover:bg-slate-50`
              }`}
            >
              <TabIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1 text-left truncate">{tab.label}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isActive ? "bg-white/25" : tab.bg
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* CONTENT for active tab */}
      {tabAudits.length === 0 ? (
        <div className="text-center py-8 px-4">
          <p className="text-sm text-slate-400">No {TYPE_TABS.find((t) => t.key === activeTab)?.label || ""} audits yet.</p>
        </div>
      ) : isDomainView && domainGroups ? (
        <div className="space-y-3 pt-1">
          {domainGroups.map(({ domain, audits: domainAudits }) => {
            const latest = domainAudits[0];
            const isSelected = domainAudits.some((a) => a.id === selectedId);
            const isPolling = domainAudits.some((a) => pollingIds.has(a.id));
            return (
              <div key={domain}>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-1.5">
                  {formatDateGroup(latest.created_at)} · {domainAudits.length} {domainAudits.length === 1 ? "page" : "pages"}
                </p>
                <div
                  onClick={() => onSelect(latest)}
                  className={`group flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer border transition-all ${
                    isSelected ? "bg-blue-50 border-blue-200" : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex-shrink-0">
                    {isPolling ? (
                      <Loader2 className="w-8 h-8 p-1.5 rounded-lg bg-slate-100 text-slate-500 animate-spin" />
                    ) : latest.score !== null ? (
                      <div className={`w-8 h-8 rounded-lg ${scoreColor(latest.score).bg} flex items-center justify-center`}>
                        <span className="text-white text-[11px] font-bold">{latest.score}</span>
                      </div>
                    ) : latest.status === "failed" ? (
                      <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                        <span className="text-rose-600 text-xs font-bold">!</span>
                      </div>
                    ) : <div className="w-8 h-8 rounded-lg bg-slate-100" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{domain}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {isPolling ? "Analyzing..." : formatDateTime(latest.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      for (const a of domainAudits) {
                        onDelete(a.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                    aria-label="Delete audit"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {groupByDate(tabAudits).map(({ label, audits: dateAudits }) => (
            <div key={label}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-1.5">{label}</p>
              <div className="space-y-1.5">
                {dateAudits.map((audit) => {
                  const isSelected = audit.id === selectedId;
                  const isPolling = pollingIds.has(audit.id);
                  const score = audit.score !== null ? scoreColor(audit.score) : null;
                  return (
                    <div
                      key={audit.id}
                      onClick={() => onSelect(audit)}
                      className={`group flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer border transition-all ${
                        isSelected ? "bg-blue-50 border-blue-200" : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {isPolling ? (
                          <Loader2 className="w-8 h-8 p-1.5 rounded-lg bg-slate-100 text-slate-500 animate-spin" />
                        ) : audit.score !== null ? (
                          <div className={"w-8 h-8 rounded-lg " + (score ? score.bg : "") + " flex items-center justify-center"}>
                            <span className="text-white text-[11px] font-bold">{audit.score}</span>
                          </div>
                        ) : audit.status === "failed" ? (
                          <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                            <span className="text-rose-600 text-xs font-bold">!</span>
                          </div>
                        ) : <div className="w-8 h-8 rounded-lg bg-slate-100" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{shortUrl(audit.url)}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {isPolling ? "Analyzing..." : formatDateTime(audit.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={(event) => { event.stopPropagation(); onDelete(audit.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                        aria-label="Delete audit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
