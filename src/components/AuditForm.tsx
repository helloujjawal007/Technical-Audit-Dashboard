import { useState } from "react";
import { Search, Loader2, Globe, FileSearch, List, FlaskConical, Radio, Gauge, Microscope, Check, Settings, Download } from "lucide-react";
import type { AuditMode, SiteType, AuditDepth, CustomExtractionFields } from "@/types";
import { DEFAULT_EXTRACTION_FIELDS, EXTRACTION_FIELD_LABELS } from "@/types";

interface AuditFormProps {
  onAudit: (input: string, mode: AuditMode, depth: AuditDepth, extractionFields?: CustomExtractionFields) => void;
  loading: boolean;
  paused: boolean;
  onPauseToggle: () => void;
}

const DEPTH_OPTIONS: { key: AuditDepth; label: string; description: string; icon: typeof Microscope }[] = [
  { key: "basic", label: "Basic Audit", description: "Essential on-page SEO checks", icon: Gauge },
  { key: "standard", label: "SEMrush / Ahrefs / Screaming Frog", description: "Core technical and on-page SEO checks with issue detection", icon: Search },
  { key: "deep", label: "Deep Audit", description: "Full SEO, accessibility, best practices, and performance checks", icon: Microscope },
];

export function AuditForm({ onAudit, loading, paused, onPauseToggle }: AuditFormProps) {
  const [siteType, setSiteType] = useState<SiteType>("live");
  const [url, setUrl] = useState("");
  const [multiUrls, setMultiUrls] = useState("");
  const [mode, setMode] = useState<AuditMode>("single");
  const [depth, setDepth] = useState<AuditDepth>("standard");
  const [extractionFields, setExtractionFields] = useState<CustomExtractionFields>(DEFAULT_EXTRACTION_FIELDS);
  const isStaging = siteType === "staging";
  const effectiveMode: AuditMode = isStaging ? "staging" : mode;
  const needsTextarea = effectiveMode === "multiple" || effectiveMode === "staging";
  const isDisabled = loading || (needsTextarea ? !multiUrls.trim() : !url.trim());

  const availableModes: { key: AuditMode; label: string; icon: React.ReactNode }[] = [
    { key: "single", label: "Single Page", icon: <Globe className="w-3.5 h-3.5" /> },
    { key: "multiple", label: "Multiple Pages", icon: <List className="w-3.5 h-3.5" /> },
    { key: "crawl", label: "Site Crawl", icon: <FileSearch className="w-3.5 h-3.5" /> },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const input = needsTextarea ? multiUrls.trim() : url.trim();
    if (!input) return;
    onAudit(input, effectiveMode, depth, effectiveMode === "custom" ? extractionFields : undefined);
  };

  const buttonLabel = loading
    ? effectiveMode === "crawl" ? "Crawling..." : effectiveMode === "staging" ? "Auditing Staging..." : effectiveMode === "multiple" ? "Auditing Pages..." : effectiveMode === "custom" ? "Running Custom Audit..." : "Auditing..."
    : effectiveMode === "crawl" ? "Crawl & Start Audit" : effectiveMode === "staging" ? "Start Staging Audit" : effectiveMode === "multiple" ? "Audit All Pages" : effectiveMode === "custom" ? "Run Custom Audit" : "Start Audit";

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Audit Type</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DEPTH_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = mode !== "custom" && depth === option.key;
            return (
              <button key={option.key} type="button" onClick={() => { setDepth(option.key); setMode("single"); }} disabled={loading} className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${selected ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${selected ? "border-teal-500 bg-teal-500" : "border-slate-300"}`}>
                  {selected && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${selected ? "text-teal-600" : "text-slate-400"}`} />
                    <span className={`text-sm font-medium ${selected ? "text-teal-700" : "text-slate-700"}`}>{option.label}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{option.description}</p>
                </div>
              </button>
            );
          })}
          <button type="button" onClick={() => setMode("custom")} disabled={loading} className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${mode === "custom" ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${mode === "custom" ? "border-teal-500 bg-teal-500" : "border-slate-300"}`}>{mode === "custom" && <Check className="w-3 h-3 text-white" />}</div>
            <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><Settings className={`w-4 h-4 ${mode === "custom" ? "text-teal-600" : "text-slate-400"}`} /><span className={`text-sm font-medium ${mode === "custom" ? "text-teal-700" : "text-slate-700"}`}>Custom Audit</span></div><p className="text-xs text-slate-400 mt-0.5">Choose exactly what to collect across the site</p></div>
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Site Type</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setSiteType("live"); setMode("single"); }} disabled={loading} className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${siteType === "live" ? "bg-teal-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}><Radio className="w-4 h-4" /> Live Site</button>
          <button type="button" onClick={() => setSiteType("staging")} disabled={loading} className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${siteType === "staging" ? "bg-teal-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}><FlaskConical className="w-4 h-4" /> Staging Site</button>
        </div>
      </div>

      {!isStaging && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Audit Mode</p>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            {availableModes.map((item) => (
              <button key={item.key} type="button" onClick={() => setMode(item.key)} disabled={loading} className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-all ${mode === item.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{item.icon}{item.label}</button>
            ))}
          </div>
        </div>
      )}

      {mode === "custom" && !isStaging && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fields to audit</p>
            <button type="button" onClick={() => { const allSelected = Object.values(extractionFields).every(Boolean); setExtractionFields(Object.fromEntries(Object.keys(extractionFields).map((key) => [key, !allSelected])) as unknown as CustomExtractionFields); }} disabled={loading} className="text-xs text-teal-600 hover:text-teal-700 font-medium">{Object.values(extractionFields).every(Boolean) ? "Clear all" : "Select all"}</button>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50">
            {(Object.keys(EXTRACTION_FIELD_LABELS) as (keyof CustomExtractionFields)[]).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={extractionFields[key]} onChange={(e) => setExtractionFields((previous) => ({ ...previous, [key]: e.target.checked }))} disabled={loading} className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                {EXTRACTION_FIELD_LABELS[key]}
              </label>
            ))}
          </div>
        </div>
      )}

      {needsTextarea ? (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{isStaging ? "Staging URLs" : "Page URLs"}</p>
          <textarea value={multiUrls} onChange={(e) => setMultiUrls(e.target.value)} placeholder={isStaging ? "Paste staging URLs here, one per line" : "Paste URLs here, one per line"} disabled={loading} rows={6} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm text-sm font-mono resize-y" />
        </div>
      ) : (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{effectiveMode === "crawl" ? "Website URL" : "Page URL"}</p>
          <div className="relative"><Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={effectiveMode === "crawl" ? "https://yoursite.com" : "https://yoursite.com/page"} disabled={loading} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm" /></div>
        </div>
      )}

      <button type="submit" disabled={isDisabled} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md whitespace-nowrap">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : effectiveMode === "crawl" ? <FileSearch className="w-5 h-5" /> : effectiveMode === "custom" ? <Download className="w-5 h-5" /> : <Search className="w-5 h-5" />}
        {buttonLabel}
      </button>
      {loading && <button type="button" onClick={onPauseToggle} className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border font-medium transition-all ${paused ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"}`}>{paused ? "Resume audit" : "Pause audit"}</button>}
      <p className="text-xs text-slate-400 leading-relaxed">{effectiveMode === "crawl" ? "Finds pages from your sitemap and audits them in parallel." : effectiveMode === "multiple" || effectiveMode === "staging" ? "Paste one URL per line. Pages are audited in parallel." : effectiveMode === "custom" ? "Audit only the SEO fields you select." : "Audit one page and see every issue with its affected URL and recommended fix."}</p>
    </form>
  );
}
