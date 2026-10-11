import { useState } from "react";
import { BarChart3, ListChecks, Share2, FileText, Link2, Heading, Image as ImageIcon, Server, KeyRound, Boxes, Gauge, Wrench, LinkIcon, FileEdit, Building2, Activity, Globe, CheckCircle2, XCircle, AlertTriangle, Info, Download, Layers } from "lucide-react";
import { ScoreGauge } from "@/components/ScoreGauge";
import { Checklist } from "@/components/Checklist";
import { SocialPreviewCard } from "@/components/SocialPreviewCard";
import { FileViewer } from "@/components/FileViewer";
import { KeywordPanel } from "@/components/KeywordPanel";
import { SchemaPanel } from "@/components/SchemaPanel";
import { PageSpeedPanel } from "@/components/PageSpeedPanel";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { LinkAnalysisPanel } from "@/components/LinkAnalysisPanel";
import { UpdatedContentPanel } from "@/components/UpdatedContentPanel";
import { GooglePropertiesPanel } from "@/components/GooglePropertiesPanel";
import { InternalLinkStatusPanel } from "@/components/InternalLinkStatusPanel";
import { CopyButton } from "@/components/CopyButton";
import { CATEGORY_META, CATEGORY_ORDER, STATUS_META, type AuditResult, type CheckCategory, type CheckStatus, type CustomAuditData } from "@/types";

interface ResultsViewProps {
  result: AuditResult;
  url: string;
  auditId?: string;
}

type Tab = "overview" | "custom-audit" | "checklist" | "keywords" | "schema" | "social" | "files" | "links" | "link-analysis" | "link-status" | "headings" | "images" | "headers" | "speed" | "recommendations" | "updated-content" | "google-properties";

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "custom-audit", label: "Custom Audit", icon: Layers },
  { id: "checklist", label: "Checklist", icon: ListChecks },
  { id: "updated-content", label: "Content Updates", icon: FileEdit },
  { id: "keywords", label: "Keywords", icon: KeyRound },
  { id: "schema", label: "Schema", icon: Boxes },
  { id: "social", label: "Social Preview", icon: Share2 },
  { id: "speed", label: "Performance", icon: Gauge },
  { id: "recommendations", label: "Recommendations", icon: Wrench },
  { id: "link-analysis", label: "Link Analysis", icon: LinkIcon },
  { id: "link-status", label: "Link Status", icon: Activity },
  { id: "google-properties", label: "Google Properties", icon: Building2 },
  { id: "files", label: "Crawler Files", icon: FileText },
  { id: "links", label: "All Links", icon: Link2 },
  { id: "headings", label: "Headings", icon: Heading },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "headers", label: "HTTP Headers", icon: Server },
];

export function ResultsView({ result, url, auditId }: ResultsViewProps) {
  const [tab, setTab] = useState<Tab>("overview");

  const checks = result.checks || [];
  const counts = checks.reduce(
    (acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; },
    { pass: 0, fail: 0, warn: 0, info: 0 },
  );

  const handleExport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Score + summary header */}
      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <ScoreGauge score={result.score} />
        <div className="flex-1 w-full">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Passed" value={counts.pass} color="text-emerald-600" bg="bg-emerald-50" icon={CheckCircle2} />
            <StatCard label="Warnings" value={counts.warn} color="text-amber-600" bg="bg-amber-50" icon={AlertTriangle} />
            <StatCard label="Failed" value={counts.fail} color="text-rose-600" bg="bg-rose-50" icon={XCircle} />
            <StatCard label="Info" value={counts.info} color="text-sky-600" bg="bg-sky-50" icon={Info} />
          </div>
          <div className="mt-4 space-y-2">
            <InfoRow label="Page Title" value={result.title} />
            <InfoRow label="Description" value={result.description} />
            <InfoRow label="Audited URL" value={url} mono />
          </div>
          <div className="mt-3 flex gap-2 flex-wrap items-center">
            {result.hasTOC && <Badge label="TOC" color="bg-blue-50 text-blue-700" />}
            {result.hasFAQ && <Badge label="FAQ" color="bg-violet-50 text-violet-700" />}
            {result.hasInfographic && <Badge label="Infographic" color="bg-emerald-50 text-emerald-700" />}
            {(result.schema || []).length > 0 && <Badge label={`${result.schema.length} Schema`} color="bg-amber-50 text-amber-700" />}
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors print:hidden"
            >
              <Download className="w-3.5 h-3.5" />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Category score dashboard */}
      {result.categoryScores && result.categoryScores.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORY_ORDER.map((cat) => {
            const cs = result.categoryScores.find((c) => c.category === cat);
            if (!cs) return null;
            const meta = CATEGORY_META[cat as CheckCategory];
            const scoreClass = cs.score >= 80 ? "text-emerald-600" : cs.score >= 50 ? "text-amber-600" : "text-rose-600";
            return (
              <div key={cat} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">{meta.label}</p>
                <p className={`text-2xl font-bold ${scoreClass}`}>{cs.score}</p>
                <div className="flex justify-center gap-1.5 mt-1.5 text-[10px]">
                  {cs.fail > 0 && <span className="text-rose-500">{cs.fail}F</span>}
                  {cs.warn > 0 && <span className="text-amber-500">{cs.warn}W</span>}
                  {cs.pass > 0 && <span className="text-emerald-500">{cs.pass}P</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-100 print:hidden">
        {TABS.filter((t) => t.id !== "custom-audit" || Boolean(result.customAudit)).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                tab === t.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[300px]">
        {tab === "overview" && <OverviewTab result={result} counts={counts} />}
        {tab === "custom-audit" && result.customAudit && <CustomAuditPanel data={result.customAudit} />}
        {tab === "checklist" && <Checklist checks={result.checks} auditId={auditId} />}
        {tab === "keywords" && <KeywordPanel keywords={result.keywords} />}
        {tab === "schema" && <SchemaPanel schemas={result.schema} url={url} />}
        {tab === "social" && <SocialPreviewCard preview={result.socialPreview} url={url} />}
        {tab === "speed" && <PageSpeedPanel pageSpeed={result.pageSpeed} />}
        {tab === "recommendations" && <RecommendationsPanel recommendations={result.recommendations} />}
        {tab === "link-analysis" && <LinkAnalysisPanel linkAnalysis={result.linkAnalysis} />}
        {tab === "link-status" && <InternalLinkStatusPanel links={result.internalLinkStatuses || []} />}
        {tab === "updated-content" && <UpdatedContentPanel recommendations={result.contentRecommendations || []} />}
        {tab === "google-properties" && <GooglePropertiesPanel properties={result.googleProperties || []} />}
        {tab === "files" && <FileViewer robotsContent={result.robotsContent} sitemapContent={result.sitemapContent} sitemapUrl={result.sitemapUrl} />}
        {tab === "links" && <LinksView links={result.links} />}
        {tab === "headings" && <HeadingsView headings={result.headings} />}
        {tab === "images" && <ImagesView images={result.images} />}
        {tab === "headers" && <HeadersView headers={result.headers} />}
      </div>
    </div>
  );
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null)[][]): void {
  const escape = (value: string | number | null): string => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function ExportCsvButton({ filename, headers, rows }: { filename: string; headers: string[]; rows: (string | number | null)[][] }) {
  return <button type="button" onClick={() => downloadCsv(filename, headers, rows)} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"><Download className="w-3.5 h-3.5" />Export</button>;
}

function CustomAuditPanel({ data }: { data: CustomAuditData }) {
  const section = (title: string, count: number, children: React.ReactNode, headers: string[], rows: (string | number | null)[][], filename: string) => (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-700">{title}</h3><div className="flex items-center gap-2"><ExportCsvButton filename={filename} headers={headers} rows={rows} /><span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-1">{count}</span></div></div>
      <div className="p-4">{children}</div>
    </section>
  );
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold text-slate-800">Custom site findings</h2><p className="text-sm text-slate-500 mt-1">Collected across the pages found in the site sitemap. Every section can be exported separately.</p></div>
      {section("Page metadata", data.pages.length, data.pages.length === 0 ? <EmptyState message="No selected metadata fields found." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100"><th className="pb-2 pr-3">Page</th><th className="pb-2 pr-3">Title</th><th className="pb-2 pr-3">Description</th><th className="pb-2 pr-3">H1</th><th className="pb-2 pr-3">H2</th><th className="pb-2">Canonical / Robots</th></tr></thead><tbody>{data.pages.map((page) => <tr key={page.url} className="border-b border-slate-50 last:border-0 align-top"><td className="py-2 pr-3 text-blue-600 max-w-[220px] truncate">{page.url}</td><td className="py-2 pr-3">{page.title || "Not found"}</td><td className="py-2 pr-3">{page.description || "Not found"}</td><td className="py-2 pr-3">{page.h1.join(" | ") || "Not found"}</td><td className="py-2 pr-3">{page.h2.join(" | ") || "Not found"}</td><td className="py-2">{page.canonical || "No canonical"}{page.robotsMeta && <div className="text-amber-600">{page.robotsMeta}</div>}</td></tr>)}</tbody></table></div>, ["Page", "Title", "Description", "H1", "H2", "Canonical", "Robots"], data.pages.map((page) => [page.url, page.title, page.description, page.h1.join(" | "), page.h2.join(" | "), page.canonical, page.robotsMeta]), "custom-metadata.csv")}
      {section("Duplicate titles, descriptions, and H1s", data.duplicates.length, data.duplicates.length === 0 ? <EmptyState message="No duplicate metadata found." /> : <div className="space-y-2">{data.duplicates.map((item) => <div key={`${item.type}-${item.value}`} className="rounded-lg bg-amber-50 border border-amber-100 p-3"><p className="text-sm font-medium text-slate-700 capitalize">Duplicate {item.type}: {item.value}</p><p className="text-xs text-slate-500 mt-1">Found on {item.pages.join(", ")}</p></div>)}</div>, ["Type", "Value", "Pages"], data.duplicates.map((item) => [item.type, item.value, item.pages.join(" | ")]), "custom-duplicates.csv")}
      {section("Missing image alt text", data.missingAlt.length, data.missingAlt.length === 0 ? <EmptyState message="No missing alt text found." /> : <div className="space-y-2">{data.missingAlt.map((item) => <div key={`${item.page}-${item.src}`} className="text-sm"><p className="text-slate-700 font-medium truncate">{item.src}</p><p className="text-xs text-blue-600 truncate">{item.page}</p></div>)}</div>, ["Page", "Image source"], data.missingAlt.map((item) => [item.page, item.src]), "custom-missing-alt.csv")}
      {section("Redirecting URLs", data.redirects.length, data.redirects.length === 0 ? <EmptyState message="No redirecting URLs found." /> : <div className="space-y-2">{data.redirects.map((item) => <div key={item.source} className="text-sm"><span className="text-slate-700">{item.status} {item.source}</span><span className="text-slate-400"> → {item.target || "location not provided"}</span></div>)}</div>, ["Source", "Target", "Status"], data.redirects.map((item) => [item.source, item.target, item.status]), "custom-redirects.csv")}
      {section("Tracking codes", data.trackingCodes.length, data.trackingCodes.length === 0 ? <EmptyState message="No recognized tracking codes found." /> : <div className="space-y-2">{data.trackingCodes.map((item) => <div key={`${item.type}-${item.id}`} className="text-sm"><p className="font-medium text-slate-700">{item.type}{item.id ? ` (${item.id})` : ""}</p><p className="text-xs text-slate-500">Present on {item.pages.length} page(s)</p></div>)}</div>, ["Type", "ID", "Pages"], data.trackingCodes.map((item) => [item.type, item.id, item.pages.join(" | ")]), "custom-tracking-codes.csv")}
      {section("Forms by page", data.forms.length, data.forms.length === 0 ? <EmptyState message="No forms found." /> : <div className="space-y-2">{data.forms.map((form) => <div key={`${form.page}-${form.action}`} className="text-sm"><p className="font-medium text-slate-700">{form.method} {form.action}</p><p className="text-xs text-blue-600 truncate">{form.page}</p></div>)}</div>, ["Page", "Action", "Method"], data.forms.map((form) => [form.page, form.action, form.method]), "custom-forms.csv")}
    </div>
  );
}

function OverviewTab({ result, counts }: { result: AuditResult; counts: Record<CheckStatus, number> }) {
  const checks = result.checks || [];
  const failedChecks = checks.filter((c) => c.status === "fail");
  const warnChecks = checks.filter((c) => c.status === "warn");

  return (
    <div className="space-y-6">
      {/* Category breakdown */}
      {result.categoryScores && result.categoryScores.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            Category Breakdown
          </h3>
          <div className="space-y-3">
            {CATEGORY_ORDER.map((cat) => {
              const cs = result.categoryScores.find((c) => c.category === cat);
              if (!cs || cs.pass + cs.warn + cs.fail + cs.info === 0) return null;
              const meta = CATEGORY_META[cat as CheckCategory];
              const scoreClass = cs.score >= 80 ? "bg-emerald-500" : cs.score >= 50 ? "bg-amber-500" : "bg-rose-500";
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-28 flex-shrink-0">{meta.label}</span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden relative">
                    <div className={`h-full ${scoreClass} rounded-lg transition-all duration-500`} style={{ width: `${cs.score}%` }} />
                    <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium text-slate-700">{cs.score}/100</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Score summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["pass", "warn", "fail", "info"] as CheckStatus[]).map((s) => (
          <div key={s} className={`rounded-xl ${STATUS_META[s].bg} p-4 flex items-center gap-3`}>
            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_META[s].dot} flex-shrink-0`} />
            <div>
              <p className={`text-2xl font-bold ${STATUS_META[s].color}`}>{counts[s]}</p>
              <p className="text-xs text-slate-500">{STATUS_META[s].label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Failed checks */}
      {failedChecks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-500" />
            Failed Checks ({failedChecks.length})
          </h3>
          <div className="space-y-2">
            {failedChecks.map((c) => (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-rose-50 border border-rose-100">
                <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{c.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnChecks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Warnings ({warnChecks.length})
          </h3>
          <div className="space-y-2">
            {warnChecks.map((c) => (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{c.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick facts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <QuickFact icon={Globe} label="HTTPS" value={result.checks.find((c) => c.id === "https")?.status === "pass" ? "Yes" : "No"} />
        <QuickFact icon={Activity} label="Response Time" value={`${result.pageSpeed.responseTimeMs}ms`} />
        <QuickFact icon={Gauge} label="HTML Size" value={`${(result.pageSpeed.htmlSizeBytes / 1024).toFixed(1)}KB`} />
        <QuickFact icon={Link2} label="Internal Links" value={result.linkAnalysis.internal.length} />
        <QuickFact icon={Link2} label="External Links" value={result.linkAnalysis.external.length} />
        <QuickFact icon={Boxes} label="Schema Types" value={result.schema.length} />
      </div>
    </div>
  );
}

function QuickFact({ icon: Icon, label, value }: { icon: typeof Globe; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white">
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg, icon: Icon }: { label: string; value: number; color: string; bg: string; icon: typeof CheckCircle2 }) {
  return (
    <div className={`rounded-xl ${bg} p-4 flex items-center gap-3`}>
      <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
      <div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${color}`}>{label}</span>;
}

function InfoRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-slate-400 flex-shrink-0 w-24">{label}:</span>
      <span className={`text-slate-700 truncate ${mono ? "font-mono text-xs" : ""}`}>
        {value || "Not found"}
      </span>
    </div>
  );
}

function LinksView({ links }: { links: { href: string; rel: string; text: string }[] }) {
  if (links.length === 0) return <EmptyState message="No links found on this page." />;
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-white">
          <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700 truncate">{link.text || "(no text)"}</p>
            <p className="text-xs text-slate-400 truncate font-mono">{link.href}</p>
          </div>
          <CopyButton text={link.href} />
          {link.rel && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{link.rel}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function HeadingsView({ headings }: { headings: { level: number; text: string }[] }) {
  if (headings.length === 0) return <EmptyState message="No headings found on this page." />;
  return (
    <div className="space-y-1">
      {headings.map((h, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5" style={{ paddingLeft: `${(h.level - 1) * 20}px` }}>
          <span className="text-xs font-mono text-slate-400 w-8">H{h.level}</span>
          <span className="text-sm text-slate-700">{h.text || "(empty)"}</span>
        </div>
      ))}
    </div>
  );
}

function ImagesView({ images }: { images: { src: string; alt: string }[] }) {
  if (images.length === 0) return <EmptyState message="No images found on this page." />;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {images.map((img, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-white">
          <ImageIcon className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 truncate font-mono">{img.src}</p>
            <p className={`text-xs mt-1 ${img.alt ? "text-emerald-600" : "text-rose-500"}`}>
              {img.alt ? `alt: "${img.alt}"` : "Missing alt text"}
            </p>
          </div>
          <CopyButton text={img.src} />
        </div>
      ))}
    </div>
  );
}

function HeadersView({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) return <EmptyState message="No HTTP headers returned." />;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-2.5 text-slate-500 font-mono text-xs whitespace-nowrap align-top w-1/3">{key}</td>
              <td className="px-4 py-2.5 text-slate-700 font-mono text-xs break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-12 text-slate-400 text-sm">{message}</div>;
}
