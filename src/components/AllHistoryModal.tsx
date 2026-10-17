import { useEffect, useMemo, useState } from "react";
import { X, Clock, Trash2, ChevronRight, Loader2, Globe, List, FileSearch, FlaskConical } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { scoreColor, type AuditRow } from "@/types";

interface AllHistoryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (audit: AuditRow) => void;
  onDelete: (id: string) => void;
}

type IconComponent = typeof Globe;

const TYPE_TABS: { key: string; label: string; icon: IconComponent; activeBg: string; activeText: string; color: string; bg: string }[] = [
  { key: "crawl", label: "Full Domain", icon: FileSearch, activeBg: "bg-emerald-600", activeText: "text-white", color: "text-emerald-600", bg: "bg-emerald-50" },
  { key: "multiple", label: "Multiple", icon: List, activeBg: "bg-slate-700", activeText: "text-white", color: "text-slate-600", bg: "bg-slate-100" },
  { key: "single", label: "Single", icon: Globe, activeBg: "bg-blue-600", activeText: "text-white", color: "text-blue-600", bg: "bg-blue-50" },
  { key: "staging", label: "Staging", icon: FlaskConical, activeBg: "bg-amber-600", activeText: "text-white", color: "text-amber-600", bg: "bg-amber-50" },
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
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
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
    groups.set(label, [...(groups.get(label) || []), audit]);
  });
  return Array.from(groups.entries()).map(([label, groupedAudits]) => ({ label, audits: groupedAudits }));
}

export function AllHistoryModal({ open, onClose, onSelect, onDelete }: AllHistoryModalProps) {
  const { user } = useAuth();
  const [allAudits, setAllAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("crawl");

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    supabase
      .from("seo_audits")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", threeMonthsAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(2000)
      .then(({ data }) => {
        setAllAudits((data as AuditRow[]) || []);
        setLoading(false);
      });
  }, [open, user]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { single: 0, multiple: 0, crawl: 0, staging: 0 };
    allAudits.forEach((a) => {
      const type = a.audit_type || "single";
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [allAudits]);

  const filtered = useMemo(() => allAudits.filter((audit) => {
    if ((audit.audit_type || "single") !== activeTab) return false;
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return audit.url.toLowerCase().includes(query) || (audit.title || "").toLowerCase().includes(query);
  }), [allAudits, search, activeTab]);

  const isDomainView = activeTab === "crawl" || activeTab === "staging";

  const domainGroups = useMemo(() => {
    if (!isDomainView) return null;
    const groups = new Map<string, AuditRow[]>();
    filtered.forEach((audit) => {
      const domain = domainOnly(audit.url);
      groups.set(domain, [...(groups.get(domain) || []), audit]);
    });
    return Array.from(groups.entries()).map(([domain, audits]) => ({ domain, audits }));
  }, [filtered, isDomainView]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-semibold text-slate-800">All Audit History</h2>
            <span className="text-xs text-slate-400">({allAudits.length} records, last 3 months)</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all" aria-label="Close history">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TAB BUTTONS with counts */}
        <div className="grid grid-cols-4 gap-2 px-6 py-3 border-b border-slate-100">
          {TYPE_TABS.map((tab) => {
            const count = typeCounts[tab.key] || 0;
            const isActive = activeTab === tab.key;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-2 py-2.5 rounded-xl border text-xs font-medium transition-all justify-center ${
                  isActive
                    ? `${tab.activeBg} ${tab.activeText} border-transparent shadow-sm`
                    : `bg-white ${tab.color} border-slate-200 hover:bg-slate-50`
                }`}
              >
                <TabIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{tab.label}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/25" : tab.bg}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-6 py-3 border-b border-slate-100">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by URL or title..."
            className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-slate-300 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              {allAudits.length === 0 ? "No audit history found." : "No results match your filters."}
            </div>
          ) : isDomainView && domainGroups ? (
            <div className="space-y-4">
              {domainGroups.map(({ domain, audits: domainAudits }) => {
                return (
                  <div key={domain}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-slate-600">{domain}</p>
                      <span className="text-[10px] text-slate-400">{domainAudits.length} {domainAudits.length === 1 ? "page" : "pages"}</span>
                    </div>
                    <div className="space-y-2 pl-1">
                      {groupByDate(domainAudits).map(({ label, audits: dateAudits }) => (
                        <div key={label}>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{label}</p>
                          <div className="space-y-2">
                            {dateAudits.map((audit) => {
                              const auditScore = audit.score !== null ? scoreColor(audit.score) : null;
                              return (
                              <div
                                key={audit.id}
                                onClick={() => { onSelect(audit); onClose(); }}
                                className="group flex items-center gap-3 p-3 rounded-xl cursor-pointer border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
                              >
                                <div className="flex-shrink-0">
                                  {audit.status === "running" || audit.status === "pending" ? (
                                    <Loader2 className="w-8 h-8 p-1.5 rounded-lg bg-slate-100 text-slate-500 animate-spin" />
                                  ) : audit.score !== null ? (
                                    <div className={"w-8 h-8 rounded-lg " + (auditScore ? auditScore.bg : "") + " flex items-center justify-center"}><span className="text-white text-xs font-bold">{audit.score}</span></div>
                                  ) : audit.status === "failed" ? (
                                    <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center"><span className="text-rose-600 text-xs font-bold">!</span></div>
                                  ) : <div className="w-8 h-8 rounded-lg bg-slate-100" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-700 truncate">{shortUrl(audit.url)}</p>
                                  <p className="text-xs text-slate-400 truncate">{audit.title || formatDateTime(audit.created_at)}</p>
                                </div>
                                <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">{formatDateTime(audit.created_at)}</span>
                                <button
                                  onClick={(event) => { event.stopPropagation(); onDelete(audit.id); setAllAudits((current) => current.filter((item) => item.id !== audit.id)); }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex-shrink-0"
                                  aria-label="Delete audit"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                              </div>
                            );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {groupByDate(filtered).map(({ label, audits: dateAudits }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{label}</p>
                  <div className="space-y-2">
                    {dateAudits.map((audit) => {
                      const score = audit.score !== null ? scoreColor(audit.score) : null;
                      return (
                        <div
                          key={audit.id}
                          onClick={() => { onSelect(audit); onClose(); }}
                          className="group flex items-center gap-3 p-3 rounded-xl cursor-pointer border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
                        >
                          <div className="flex-shrink-0">
                            {audit.status === "running" || audit.status === "pending" ? (
                              <Loader2 className="w-8 h-8 p-1.5 rounded-lg bg-slate-100 text-slate-500 animate-spin" />
                            ) : audit.score !== null ? (
                              <div className={"w-8 h-8 rounded-lg " + (score ? score.bg : "") + " flex items-center justify-center"}><span className="text-white text-xs font-bold">{audit.score}</span></div>
                            ) : audit.status === "failed" ? (
                              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center"><span className="text-rose-600 text-xs font-bold">!</span></div>
                            ) : <div className="w-8 h-8 rounded-lg bg-slate-100" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{shortUrl(audit.url)}</p>
                            <p className="text-xs text-slate-400 truncate">{audit.title || formatDateTime(audit.created_at)}</p>
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">{formatDateTime(audit.created_at)}</span>
                          <button
                            onClick={(event) => { event.stopPropagation(); onDelete(audit.id); setAllAudits((current) => current.filter((item) => item.id !== audit.id)); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex-shrink-0"
                            aria-label="Delete audit"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
