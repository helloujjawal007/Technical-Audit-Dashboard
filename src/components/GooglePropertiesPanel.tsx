import { Building2, CheckCircle2 } from "lucide-react";
import type { GoogleProperty } from "@/types";

export function GooglePropertiesPanel({ properties }: { properties: GoogleProperty[] }) {
  const safeProperties = properties || [];
  if (safeProperties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Building2 className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-600">No Google properties detected</p>
        <p className="text-xs text-slate-400 mt-1">No GA4, GTM, Google Ads, Search Console, or Maps found in the page source.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-5 h-5 text-blue-500" />
        <h3 className="text-sm font-semibold text-slate-700">Google Properties Detected</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {properties.map((prop, i) => (
          <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{prop.property}</p>
                {prop.id && <p className="text-xs text-slate-500 mt-1 font-mono break-all">{prop.id}</p>}
                <p className="text-xs text-slate-400 mt-1.5">{prop.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Detection is based on raw HTML source code analysis. Only properties with actual evidence in the source are reported.
      </p>
    </div>
  );
}
