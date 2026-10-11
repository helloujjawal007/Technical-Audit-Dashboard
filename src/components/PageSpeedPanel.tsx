import { Gauge, Zap, FileCode, Image as ImageIcon, Smartphone, Clock, Server, Lightbulb } from "lucide-react";
import type { PageSpeedInfo } from "@/types";

interface PageSpeedPanelProps {
  pageSpeed: PageSpeedInfo;
}

export function PageSpeedPanel({ pageSpeed }: PageSpeedPanelProps) {
  const responseGrade = pageSpeed.responseTimeMs < 500 ? "Good" : pageSpeed.responseTimeMs < 1000 ? "Fair" : "Poor";
  const responseColor = pageSpeed.responseTimeMs < 500 ? "text-emerald-600" : pageSpeed.responseTimeMs < 1000 ? "text-amber-600" : "text-rose-600";
  const sizeGrade = pageSpeed.htmlSizeBytes < 100000 ? "Good" : pageSpeed.htmlSizeBytes < 200000 ? "Fair" : "Poor";
  const sizeColor = pageSpeed.htmlSizeBytes < 100000 ? "text-emerald-600" : pageSpeed.htmlSizeBytes < 200000 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Gauge className="w-5 h-5 text-blue-500" />
        <h3 className="text-base font-semibold text-slate-800">Page Speed Insights</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={Clock} label="Response Time" value={`${pageSpeed.responseTimeMs}ms`} grade={responseGrade} color={responseColor} />
        <MetricCard icon={FileCode} label="HTML Size" value={`${(pageSpeed.htmlSizeBytes / 1024).toFixed(1)}KB`} grade={sizeGrade} color={sizeColor} />
        <MetricCard icon={Zap} label="Est. Transfer" value={`${pageSpeed.estimatedTransferTimeSec}s`} grade={pageSpeed.estimatedTransferTimeSec < 2 ? "Good" : "Fair"} color={pageSpeed.estimatedTransferTimeSec < 2 ? "text-emerald-600" : "text-amber-600"} />
        <MetricCard icon={Server} label="Resources" value={`${pageSpeed.resources}`} grade={pageSpeed.resources < 20 ? "Good" : "Fair"} color={pageSpeed.resources < 20 ? "text-emerald-600" : "text-amber-600"} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniMetric label="Scripts" value={pageSpeed.scripts} icon={FileCode} />
        <MiniMetric label="Stylesheets" value={pageSpeed.stylesheets} icon={FileCode} />
        <MiniMetric label="Images" value={pageSpeed.images} icon={ImageIcon} />
        <MiniMetric label="Mobile Ready" value={pageSpeed.mobileOptimized ? "Yes" : "No"} icon={Smartphone} />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Mobile vs Desktop</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={`rounded-xl p-4 border ${pageSpeed.hasViewport ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className={`w-5 h-5 ${pageSpeed.hasViewport ? "text-emerald-600" : "text-rose-600"}`} />
              <span className="text-sm font-medium text-slate-700">Mobile</span>
            </div>
            <p className={`text-xs ${pageSpeed.hasViewport ? "text-emerald-700" : "text-rose-700"}`}>
              {pageSpeed.hasViewport ? "Viewport tag present - mobile optimized." : "Missing viewport tag - not mobile ready."}
            </p>
          </div>
          <div className="rounded-xl p-4 border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-5 h-5 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Desktop</span>
            </div>
            <p className="text-xs text-slate-500">
              {pageSpeed.responseTimeMs < 500 ? "Fast server response for desktop users." : "Server response may impact desktop load time."}
            </p>
          </div>
        </div>
      </div>

      {pageSpeed.recommendations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-semibold text-slate-700">Speed Recommendations</h4>
          </div>
          <div className="space-y-2">
            {pageSpeed.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <span className="text-amber-500 text-xs font-bold mt-0.5">{i + 1}</span>
                <p className="text-sm text-slate-600">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-600">Note:</strong> These are server-side measurements from the HTML response.
          For full Core Web Vitals (LCP, FID, CLS) and mobile lab data, integrate the Google PageSpeed Insights API
          which runs Lighthouse in a real browser environment.
        </p>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, grade, color }: { icon: typeof Clock; label: string; value: string; grade: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className={`text-xs font-medium ${color}`}>{grade}</p>
    </div>
  );
}

function MiniMetric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Clock }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
