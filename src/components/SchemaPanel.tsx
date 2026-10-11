import { useState } from "react";
import { Code2, Boxes, ExternalLink, Search } from "lucide-react";
import type { SchemaInfo } from "@/types";

interface SchemaPanelProps {
  schemas: SchemaInfo[];
  url?: string;
}

export function SchemaPanel({ schemas, url }: SchemaPanelProps) {
  const [testUrl, setTestUrl] = useState(url || "");

  const effectiveUrl = (testUrl.trim() || url || "").trim();
  const hasUrl = effectiveUrl.length > 0;

  const validatorUrl = hasUrl
    ? `https://validator.schema.org/#url=${encodeURIComponent(effectiveUrl)}`
    : null;

  const richResultsUrl = hasUrl
    ? `https://search.google.com/test/rich-results?url=${encodeURIComponent(effectiveUrl)}`
    : null;

  const testButtons = (
    <div className="flex gap-2 flex-wrap">
      <input
        type="text"
        value={testUrl}
        onChange={(e) => setTestUrl(e.target.value)}
        placeholder="Enter page URL to test..."
        className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      />
      {validatorUrl && (
        <a
          href={validatorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-all whitespace-nowrap"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Schema Validator
        </a>
      )}
      {richResultsUrl && (
        <a
          href={richResultsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-all whitespace-nowrap"
        >
          <Search className="w-3.5 h-3.5" />
          Rich Results Test
        </a>
      )}
    </div>
  );

  if (schemas.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No structured data (Schema.org) found on this page.</p>
          <p className="text-xs text-slate-400 mt-1">Add JSON-LD markup to earn rich results in search.</p>
        </div>
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Test this page for structured data</p>
          {testButtons}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-semibold text-slate-800">Structured Data ({schemas.length})</h3>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          {testButtons}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {schemas.map((schema, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-800">{schema.type}</span>
              </div>
              <span className={"text-xs px-2 py-0.5 rounded " + (schema.source === "json-ld" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                {schema.source === "json-ld" ? "JSON-LD" : "Microdata"}
              </span>
            </div>
            {schema.raw && (
              <pre className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 mt-2 overflow-x-auto max-h-32 font-mono leading-relaxed">
                {schema.raw}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
