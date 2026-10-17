import { useState } from "react";
import {
  Search,
  Loader2,
  Globe,
  FileSearch,
  List,
  FlaskConical,
  Radio,
  Gauge,
  Microscope,
  Check,
  Settings,
  Download,
  Sparkles,
  X,
  Play,
  Pause,
} from "lucide-react";
import type { AuditMode, SiteType, AuditDepth, CustomExtractionFields } from "@/types";
import { DEFAULT_EXTRACTION_FIELDS, EXTRACTION_FIELD_LABELS } from "@/types";

interface AuditFormProps {
  onAudit: (
    input: string,
    mode: AuditMode,
    depth: AuditDepth,
    extractionFields?: CustomExtractionFields
  ) => void;
  loading: boolean;
  paused: boolean;
  onPauseToggle: () => void;
}

const DEPTH_OPTIONS: {
  key: AuditDepth;
  label: string;
  badge: string;
  description: string;
  icon: typeof Microscope;
}[] = [
  {
    key: "basic",
    label: "Basic Audit",
    badge: "15 Checks",
    description: "Fast essential on-page SEO analysis",
    icon: Gauge,
  },
  {
    key: "standard",
    label: "Industry Standard",
    badge: "40+ Checks",
    description: "SEMrush / Ahrefs standard with duplicate detection",
    icon: Search,
  },
  {
    key: "deep",
    label: "Deep Comprehensive",
    badge: "90+ Checks",
    description: "Full SEO, accessibility, performance, and best practices",
    icon: Microscope,
  },
];

export function AuditForm({ onAudit, loading, paused, onPauseToggle }: AuditFormProps) {
  const [siteType, setSiteType] = useState<SiteType>("live");
  const [url, setUrl] = useState("");
  const [multiUrls, setMultiUrls] = useState("");
  const [mode, setMode] = useState<AuditMode>("crawl");
  const [depth, setDepth] = useState<AuditDepth>("standard");
  const [extractionFields, setExtractionFields] = useState<CustomExtractionFields>(DEFAULT_EXTRACTION_FIELDS);

  const isStaging = siteType === "staging";
  const effectiveMode: AuditMode = isStaging ? "staging" : mode;
  const needsTextarea = effectiveMode === "multiple" || effectiveMode === "staging";
  const isDisabled = loading || (needsTextarea ? !multiUrls.trim() : !url.trim());

  const availableModes: { key: AuditMode; label: string; icon: React.ReactNode }[] = [
    { key: "crawl", label: "Full Site Crawl", icon: <FileSearch className="w-3.5 h-3.5" /> },
    { key: "multiple", label: "Multiple Pages", icon: <List className="w-3.5 h-3.5" /> },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const input = needsTextarea ? multiUrls.trim() : url.trim();
    if (!input) return;
    onAudit(input, effectiveMode, depth, effectiveMode === "custom" ? extractionFields : undefined);
  };

  const buttonLabel = loading
    ? effectiveMode === "staging"
      ? "Auditing staging..."
      : effectiveMode === "multiple"
      ? "Auditing batch..."
      : effectiveMode === "custom"
      ? "Running custom extraction..."
      : "Crawling & Auditing Full Site..."
    : effectiveMode === "staging"
    ? "Audit Staging Site"
    : effectiveMode === "multiple"
    ? "Audit All Pages"
    : effectiveMode === "custom"
    ? "Run Custom Extraction"
    : "Launch Full Site Audit";

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      {/* 1. Audit Depth Selection */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            Audit Depth & Engine
          </label>
          <span className="text-[11px] font-medium text-slate-400">Select inspection level</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {DEPTH_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = mode !== "custom" && depth === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setDepth(option.key);
                  if (mode === "custom") setMode("crawl");
                }}
                disabled={loading}
                className={`relative flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                  selected
                    ? "border-teal-500/80 bg-gradient-to-br from-teal-50/70 to-emerald-50/40 shadow-sm shadow-teal-500/10 ring-1 ring-teal-500/30"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-xs"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    selected
                      ? "border-teal-600 bg-teal-600 shadow-xs"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {selected && <Check className="w-3 h-3 text-white" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-4 h-4 ${selected ? "text-teal-600" : "text-slate-400"}`} />
                      <span className={`text-xs font-bold ${selected ? "text-slate-900" : "text-slate-700"}`}>
                        {option.label}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                        selected
                          ? "bg-teal-100 text-teal-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {option.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}

          {/* Custom Audit Option */}
          <button
            type="button"
            onClick={() => setMode("custom")}
            disabled={loading}
            className={`relative flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
              mode === "custom"
                ? "border-teal-500/80 bg-gradient-to-br from-teal-50/70 to-emerald-50/40 shadow-sm shadow-teal-500/10 ring-1 ring-teal-500/30"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-xs"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                mode === "custom"
                  ? "border-teal-600 bg-teal-600 shadow-xs"
                  : "border-slate-300 bg-white"
              }`}
            >
              {mode === "custom" && <Check className="w-3 h-3 text-white" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <div className="flex items-center gap-1.5">
                  <Settings className={`w-4 h-4 ${mode === "custom" ? "text-teal-600" : "text-slate-400"}`} />
                  <span className={`text-xs font-bold ${mode === "custom" ? "text-slate-900" : "text-slate-700"}`}>
                    Custom Extraction
                  </span>
                </div>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                    mode === "custom" ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  Configurable
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Filter and extract targeted metadata & tags
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Target Site Environment & Audit Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Site Type Toggle */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Target Environment
          </label>
          <div className="flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setSiteType("live");
                setMode("crawl");
              }}
              disabled={loading}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                siteType === "live"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-teal-600" />
              <span>Live Site</span>
            </button>
            <button
              type="button"
              onClick={() => setSiteType("staging")}
              disabled={loading}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                siteType === "staging"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
              <span>Staging Preview</span>
            </button>
          </div>
        </div>

        {/* Audit Mode Switch (if not staging) */}
        {!isStaging && (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Scope
            </label>
            <div className="flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
              {availableModes.map((item) => {
                const isActive = mode === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setMode(item.key)}
                    disabled={loading}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? "bg-white text-slate-800 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Custom Extraction Fields Drawer */}
      {mode === "custom" && !isStaging && (
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Fields to Collect
            </span>
            <button
              type="button"
              onClick={() => {
                const allSelected = Object.values(extractionFields).every(Boolean);
                setExtractionFields(
                  Object.fromEntries(
                    Object.keys(extractionFields).map((key) => [key, !allSelected])
                  ) as unknown as CustomExtractionFields
                );
              }}
              disabled={loading}
              className="text-xs text-teal-600 hover:text-teal-700 font-semibold"
            >
              {Object.values(extractionFields).every(Boolean) ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(EXTRACTION_FIELD_LABELS) as (keyof CustomExtractionFields)[]).map((key) => (
              <label
                key={key}
                className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200/60 text-xs text-slate-700 font-medium hover:border-teal-300 transition-colors cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={extractionFields[key]}
                  onChange={(e) =>
                    setExtractionFields((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                  disabled={loading}
                  className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                />
                <span className="truncate">{EXTRACTION_FIELD_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 4. Target URL / Batch URLs Input */}
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
          {needsTextarea ? (isStaging ? "Staging URLs (One per line)" : "Batch URLs (One per line)") : "Target Website Domain (Full Site Audit)"}
        </label>

        {needsTextarea ? (
          <textarea
            value={multiUrls}
            onChange={(e) => setMultiUrls(e.target.value)}
            placeholder={
              isStaging
                ? "https://staging.example.com\nhttps://staging.example.com/about"
                : "https://example.com/page-1\nhttps://example.com/page-2"
            }
            disabled={loading}
            rows={5}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all shadow-xs text-xs font-mono resize-y"
          />
        ) : (
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
              <Globe className="w-5 h-5 text-teal-600/70" />
              <span className="text-xs font-bold text-slate-400 select-none">https://</span>
            </div>
            <input
              type="text"
              value={url.replace(/^https?:\/\//i, "")}
              onChange={(e) => {
                const val = e.target.value.trim();
                setUrl(val ? `https://${val.replace(/^https?:\/\//i, "")}` : "");
              }}
              placeholder="example.com"
              disabled={loading}
              className="w-full pl-28 pr-10 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all shadow-xs text-sm font-medium"
            />
            {url && !loading && (
              <button
                type="button"
                onClick={() => setUrl("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 5. CTA Submit Button & Pause Toggle */}
      <div className="pt-1 space-y-2">
        <button
          type="submit"
          disabled={isDisabled}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-sm shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 active:scale-[0.98] cursor-pointer"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : effectiveMode === "crawl" ? (
            <FileSearch className="w-5 h-5" />
          ) : effectiveMode === "custom" ? (
            <Download className="w-5 h-5" />
          ) : (
            <Search className="w-5 h-5" />
          )}
          <span>{buttonLabel}</span>
        </button>

        {loading && (
          <button
            type="button"
            onClick={onPauseToggle}
            className={`w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer ${
              paused
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{paused ? "Resume Active Audit" : "Pause Inspection"}</span>
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center leading-relaxed">
        {effectiveMode === "multiple" || effectiveMode === "staging"
          ? "Inspects multiple specified endpoints simultaneously with performance profiling."
          : "Full site crawl automatically inspects sitemaps and discovers internal links to audit all pages on the site."}
      </p>
    </form>
  );
}
