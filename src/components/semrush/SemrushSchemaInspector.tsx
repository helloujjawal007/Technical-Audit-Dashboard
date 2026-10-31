import { useState } from "react";
import {
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { SchemaInfo } from "@/types";

interface SemrushSchemaInspectorProps {
  schemas?: SchemaInfo[];
  url: string;
}

export function SemrushSchemaInspector({ schemas = [], url }: SemrushSchemaInspectorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const validatorUrl = `https://validator.schema.org/#url=${encodeURIComponent(url)}`;
  const richResultsUrl = `https://search.google.com/test/rich-results?url=${encodeURIComponent(url)}`;

  const handleCopyRaw = (raw: string, index: number) => {
    navigator.clipboard.writeText(raw);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 sm:p-6 rounded-3xl border border-slate-200/90 bg-white shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-extrabold text-slate-800">
                Structured Data & Rich Snippets Inspector
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              SEMrush schema validator testing JSON-LD entities for Google Rich Search Results eligibility
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={richResultsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition"
            >
              <span>Google Rich Results Test</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>

            <a
              href={validatorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition"
            >
              <span>Schema.org Validator</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-700">Detected Schemas:</span>
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-black text-[11px]">
            {schemas.length} {schemas.length === 1 ? "Schema Type" : "Schema Types"}
          </span>
          {schemas.length > 0 && (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold ml-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Structured data present
            </span>
          )}
        </div>
      </div>

      {/* Empty State */}
      {schemas.length === 0 ? (
        <div className="p-10 rounded-3xl border border-dashed border-amber-300 bg-amber-50/50 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
          <h4 className="text-sm font-extrabold text-slate-800">
            No Structured Data Found on Page
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Adding Schema.org JSON-LD (such as Organization, WebSite, Article, Product, or FAQPage) unlocks Google Rich Snippets in SERPs.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {schemas.map((schema, index) => {
            const isExpanded = expandedIndex === index;
            let parsedData: Record<string, unknown> | null = null;
            try {
              parsedData = JSON.parse(schema.raw);
            } catch {
              parsedData = null;
            }

            return (
              <div
                key={index}
                className="rounded-3xl border border-slate-200/90 bg-white overflow-hidden shadow-xs transition-all"
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900">
                          {schema.type}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 text-slate-700 uppercase">
                          {schema.source}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Valid Syntax
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Schema.org JSON-LD Structured Data
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyRaw(schema.raw, index);
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                    >
                      {copiedIndex === index ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedIndex === index ? "Copied!" : "Copy"}</span>
                    </button>

                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Raw / Parsed Inspector */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/60 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Raw JSON-LD Payload</span>
                    </div>

                    <pre className="p-4 rounded-2xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto shadow-inner leading-relaxed">
                      {JSON.stringify(parsedData || schema.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
