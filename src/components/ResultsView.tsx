import { useState, useMemo, useEffect } from "react";
import {
  Sparkles,
  AlertTriangle,
  Layers,
  Link2,
  Boxes,
  Gauge,
  FileEdit,
  ListChecks,
  FileText,
} from "lucide-react";
import { Checklist } from "@/components/Checklist";
import { SocialPreviewCard } from "@/components/SocialPreviewCard";
import { FileViewer } from "@/components/FileViewer";
import { KeywordPanel } from "@/components/KeywordPanel";
import { PageSpeedPanel } from "@/components/PageSpeedPanel";
import { UpdatedContentPanel } from "@/components/UpdatedContentPanel";
import { GooglePropertiesPanel } from "@/components/GooglePropertiesPanel";
import { InternalLinkStatusPanel } from "@/components/InternalLinkStatusPanel";
import { type AuditResult, type CustomAuditData } from "@/types";
import { SendToOutreachModal } from "@/components/SendToOutreachModal";

// SEMrush Extended Suite
import {
  buildSemrushPillars,
  getTopBottlenecks,
  type SemrushPillarId,
  type SemrushBottleneck,
} from "@/components/semrush/semrushTypes";
import { SemrushHeader } from "@/components/semrush/SemrushHeader";
import { SemrushOverview } from "@/components/semrush/SemrushOverview";
import { SemrushIssuesTable } from "@/components/semrush/SemrushIssuesTable";
import { SemrushThematicReports } from "@/components/semrush/SemrushThematicReports";
import { SemrushArchitecturePanel } from "@/components/semrush/SemrushArchitecturePanel";
import { SemrushSchemaInspector } from "@/components/semrush/SemrushSchemaInspector";
import { SemrushFixModal } from "@/components/semrush/SemrushFixModal";

interface ResultsViewProps {
  result: AuditResult;
  url: string;
  auditId?: string;
  onDelete?: () => void;
  onCreateSiteDashboard?: (url: string, title?: string | null) => void;
}

type SemrushTab =
  | "overview"
  | "issues"
  | "thematic"
  | "architecture"
  | "schema"
  | "performance"
  | "content"
  | "checklist"
  | "files"
  | "custom-audit";

interface TabMeta {
  id: SemrushTab;
  label: string;
  icon: typeof Sparkles;
  badge?: (res: AuditResult) => string | number | null;
}

const SEMRUSH_TABS: TabMeta[] = [
  { id: "overview", label: "Overview", icon: Sparkles },
  {
    id: "issues",
    label: "Issues Explorer",
    icon: AlertTriangle,
    badge: (res) =>
      (res.checks || []).filter((c) => c.status === "fail" || c.status === "warn").length || null,
  },
  { id: "thematic", label: "Thematic Reports", icon: Layers },
  { id: "architecture", label: "Site Architecture & Links", icon: Link2 },
  { id: "schema", label: "Structured Data & SERP", icon: Boxes },
  { id: "performance", label: "Core Web Vitals & Speed", icon: Gauge },
  { id: "content", label: "Content & Keywords", icon: FileEdit },
  { id: "checklist", label: "Remediation Checklist", icon: ListChecks },
  { id: "files", label: "Crawler Files", icon: FileText },
  { id: "custom-audit", label: "Custom Extraction", icon: Layers },
];

export function ResultsView({
  result,
  url,
  auditId,
  onDelete,
  onCreateSiteDashboard,
}: ResultsViewProps) {
  const [tab, setTab] = useState<SemrushTab>("overview");
  const [selectedPillarId, setSelectedPillarId] = useState<SemrushPillarId>("crawlability");
  const [activeFixBottleneck, setActiveFixBottleneck] = useState<SemrushBottleneck | null>(null);

  // Outreach & Webhook states
  const [showOutreachModal, setShowOutreachModal] = useState(false);

  // Resolved checklist tracker
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(() => {
    if (auditId) {
      try {
        const stored = localStorage.getItem(`audit-tasks-${auditId}`);
        if (stored) return new Set(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
    return new Set();
  });

  useEffect(() => {
    if (auditId) {
      try {
        localStorage.setItem(`audit-tasks-${auditId}`, JSON.stringify([...resolvedIds]));
      } catch {
        // ignore
      }
    }
  }, [resolvedIds, auditId]);

  const handleToggleResolve = (checkId: string) => {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      if (next.has(checkId)) next.delete(checkId);
      else next.add(checkId);
      return next;
    });
  };

  // Derive SEMrush Pillars & Ranked Bottlenecks
  const pillars = useMemo(() => buildSemrushPillars(result), [result]);
  const bottlenecks = useMemo(() => getTopBottlenecks(result, url), [result, url]);

  const handleExportPdf = () => {
    let domain = "Domain";
    try {
      domain = new URL(url).hostname.replace(/^www\./, "").replace(/[^a-z0-9]/gi, "_");
    } catch {
      domain = url.replace(/[^a-z0-9]/gi, "_");
    }
    const originalTitle = document.title;
    document.title = `SEMrush_Technical_Audit_${domain}.pdf`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. SEMrush Executive Header & Competitive Benchmark */}
      <SemrushHeader
        result={result}
        url={url}
        onExportPdf={handleExportPdf}
        onOpenOutreachModal={() => setShowOutreachModal(true)}
        onCreateSiteDashboard={onCreateSiteDashboard}
        onDelete={onDelete}
      />

      {/* 2. SEMrush Organized Tab Navigation Bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1.5 border-b border-slate-200/80 print:hidden scrollbar-none">
        {SEMRUSH_TABS.filter((t) => t.id !== "custom-audit" || Boolean(result.customAudit)).map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          const badgeVal = t.badge ? t.badge(result) : null;

          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                isActive
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-orange-400" : "text-slate-400"}`} />
              <span>{t.label}</span>
              {badgeVal !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {badgeVal}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. SEMrush Tab Content Area */}
      <div className="min-h-[400px]">
        {/* Tab 1: Overview */}
        {tab === "overview" && (
          <SemrushOverview
            result={result}
            url={url}
            pillars={pillars}
            bottlenecks={bottlenecks}
            onSelectPillar={(pillarId) => {
              setSelectedPillarId(pillarId);
              setTab("thematic");
            }}
            onOpenFixModal={setActiveFixBottleneck}
            resolvedIds={resolvedIds}
            onToggleResolve={handleToggleResolve}
          />
        )}

        {/* Tab 2: Issues Explorer */}
        {tab === "issues" && (
          <SemrushIssuesTable
            result={result}
            url={url}
            onOpenFixModal={setActiveFixBottleneck}
            resolvedIds={resolvedIds}
            onToggleResolve={handleToggleResolve}
          />
        )}

        {/* Tab 3: Thematic Reports */}
        {tab === "thematic" && (
          <SemrushThematicReports
            pillars={pillars}
            url={url}
            selectedPillarId={selectedPillarId}
            onOpenFixModal={setActiveFixBottleneck}
            resolvedIds={resolvedIds}
            onToggleResolve={handleToggleResolve}
          />
        )}

        {/* Tab 4: Site Architecture & Links */}
        {tab === "architecture" && (
          <div className="space-y-6">
            <SemrushArchitecturePanel
              linkAnalysis={result.linkAnalysis}
              links={result.links}
              pageUrl={url}
            />
            {result.internalLinkStatuses && result.internalLinkStatuses.length > 0 && (
              <InternalLinkStatusPanel links={result.internalLinkStatuses} />
            )}
          </div>
        )}

        {/* Tab 5: Structured Data & SERP */}
        {tab === "schema" && (
          <div className="space-y-6">
            <SemrushSchemaInspector schemas={result.schema} url={url} />
            <SocialPreviewCard preview={result.socialPreview} url={url} />
          </div>
        )}

        {/* Tab 6: Core Web Vitals & Speed */}
        {tab === "performance" && (
          <PageSpeedPanel pageSpeed={result.pageSpeed} />
        )}

        {/* Tab 7: Content & Keywords */}
        {tab === "content" && (
          <div className="space-y-6">
            <KeywordPanel keywords={result.keywords} />
            {result.contentRecommendations && result.contentRecommendations.length > 0 && (
              <UpdatedContentPanel recommendations={result.contentRecommendations} />
            )}
            {result.googleProperties && result.googleProperties.length > 0 && (
              <GooglePropertiesPanel properties={result.googleProperties} />
            )}
          </div>
        )}

        {/* Tab 8: Remediation Checklist */}
        {tab === "checklist" && (
          <Checklist checks={result.checks} auditId={auditId} />
        )}

        {/* Tab 9: Crawler Files */}
        {tab === "files" && (
          <div className="space-y-6">
            <FileViewer
              robotsContent={result.robotsContent}
              sitemapContent={result.sitemapContent}
              sitemapUrl={result.sitemapUrl}
            />
            <HeadersView headers={result.headers} />
          </div>
        )}

        {/* Tab 10: Custom Extraction */}
        {tab === "custom-audit" && result.customAudit && (
          <CustomAuditPanel data={result.customAudit} />
        )}
      </div>

      {/* 4. Interactive "Why & How to Fix" Prescription Modal */}
      <SemrushFixModal
        bottleneck={activeFixBottleneck}
        onClose={() => setActiveFixBottleneck(null)}
        isResolved={Boolean(activeFixBottleneck && resolvedIds.has(activeFixBottleneck.check.id))}
        onToggleResolve={handleToggleResolve}
      />

      {/* 5. Send to Outreach Modal */}
      <SendToOutreachModal
        isOpen={showOutreachModal}
        onClose={() => setShowOutreachModal(false)}
        result={result}
        targetUrl={url}
        defaultBusinessName={result.title || undefined}
      />
    </div>
  );
}

function HeadersView({ headers }: { headers?: Record<string, string> }) {
  const entries = Object.entries(headers || {});
  if (entries.length === 0) {
    return <div className="text-center py-12 text-slate-400 text-sm">No HTTP headers returned.</div>;
  }
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-xs text-slate-700">
        HTTP Response Headers ({entries.length})
      </div>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-slate-100">
          {entries.map(([key, value]) => (
            <tr key={key} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 text-slate-500 font-mono text-xs whitespace-nowrap align-top w-1/3">
                {key}
              </td>
              <td className="px-4 py-2.5 text-slate-800 font-mono text-xs break-all">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomAuditPanel({ data }: { data: CustomAuditData }) {
  const downloadCsv = (filename: string, headers: string[], rows: (string | number | null)[][]) => {
    const escape = (val: string | number | null) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const section = (
    title: string,
    count: number,
    children: React.ReactNode,
    headers: string[],
    rows: (string | number | null)[][],
    filename: string
  ) => (
    <section className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(filename, headers, rows)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
          >
            Export CSV
          </button>
          <span className="text-[10px] font-black text-slate-600 bg-slate-200/80 rounded-full px-2 py-0.5">
            {count}
          </span>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );

  return (
    <div className="space-y-4">
      {section(
        "Page Metadata",
        data.pages.length,
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100 font-bold uppercase text-[10px]">
                <th className="pb-2 pr-3">Page</th>
                <th className="pb-2 pr-3">Title</th>
                <th className="pb-2 pr-3">Description</th>
                <th className="pb-2 pr-3">H1</th>
                <th className="pb-2">Canonical</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.pages.map((p) => (
                <tr key={p.url}>
                  <td className="py-2 pr-3 text-blue-600 font-mono truncate max-w-[200px]">{p.url}</td>
                  <td className="py-2 pr-3">{p.title || "—"}</td>
                  <td className="py-2 pr-3">{p.description || "—"}</td>
                  <td className="py-2 pr-3">{p.h1.join(" | ") || "—"}</td>
                  <td className="py-2 font-mono text-[11px]">{p.canonical || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
        ["Page", "Title", "Description", "H1", "Canonical"],
        data.pages.map((p) => [p.url, p.title, p.description, p.h1.join(" | "), p.canonical]),
        "custom-metadata.csv"
      )}
    </div>
  );
}
