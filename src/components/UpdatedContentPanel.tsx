import { FileEdit, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { ContentRecommendation } from "@/types";

export function UpdatedContentPanel({ recommendations }: { recommendations: ContentRecommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3" />
        <p className="text-sm font-medium text-slate-700">All content elements pass checks</p>
        <p className="text-xs text-slate-400 mt-1">No updates recommended for title, meta description, or H1.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileEdit className="w-5 h-5 text-blue-500" />
        <h3 className="text-sm font-semibold text-slate-700">Content Recommendations</h3>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Element</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Issue</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Current Content</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Updated Content</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((item, i) => {
              const issueIcon = item.status === "fail"
                ? <XCircle className="w-4 h-4 text-rose-500" />
                : <AlertTriangle className="w-4 h-4 text-amber-500" />;
              return (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-700 align-top whitespace-nowrap">{item.element}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-1.5">
                      {issueIcon}
                      <span className="text-slate-600">{item.issue}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 align-top">
                    {item.currentContent === "N/A" ? (
                      <span className="text-slate-400 italic">N/A</span>
                    ) : (
                      <span className="text-xs">{item.currentContent}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-800 align-top font-medium">
                    <span className="text-xs">{item.updatedContent}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Updated Content is a recommendation only. No page content is modified automatically.
      </p>
    </div>
  );
}
