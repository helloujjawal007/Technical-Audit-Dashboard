import { useState, useEffect } from "react";
import {
  X,
  Clock,
  Trash2,
  ExternalLink,
  Zap,
} from "lucide-react";
import {
  getStealthJobs,
  removeStealthJob,
  clearCompletedStealthJobs,
  type StealthJob,
} from "@/lib/stealthQueue";

interface StealthQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReport?: (job: StealthJob) => void;
}

export function StealthQueueModal({ isOpen, onClose, onOpenReport }: StealthQueueModalProps) {
  const [jobs, setJobs] = useState<StealthJob[]>(() => getStealthJobs());

  useEffect(() => {
    const handleUpdate = () => {
      setJobs(getStealthJobs());
    };
    window.addEventListener("ods_stealth_jobs_updated", handleUpdate);
    const interval = setInterval(handleUpdate, 2000);
    return () => {
      window.removeEventListener("ods_stealth_jobs_updated", handleUpdate);
      clearInterval(interval);
    };
  }, []);

  if (!isOpen) return null;

  const runningCount = jobs.filter((j) => j.status === "running" || j.status === "waiting" || j.status === "queued").length;
  const completedCount = jobs.filter((j) => j.status === "completed").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Zap className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Stealth Mode Background Queue
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-400/20 text-indigo-200 border border-indigo-400/30">
                  Big Sites (100–500+ URLs)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Large domains run gracefully in the background after your active audits finish
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {jobs.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">No Sites in Stealth Queue</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                When you crawl a large website (over 100 pages), the top 100 pages audit immediately, and the full site automatically queues here to run in the background.
              </p>
            </div>
          ) : (
            jobs.map((job) => {
              const percent = job.totalUrls > 0 ? Math.round((job.completedUrls / job.totalUrls) * 100) : 0;
              return (
                <div
                  key={job.id}
                  className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900">{job.domain}</h4>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            job.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : job.status === "running"
                              ? "bg-indigo-100 text-indigo-800 animate-pulse"
                              : job.status === "waiting"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {job.status === "waiting" ? "Waiting for active audits" : job.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {job.message || `${job.totalUrls} total pages detected`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {job.status === "completed" && onOpenReport && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenReport(job);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>View Full Crawl</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => removeStealthJob(job.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                      <span>
                        {job.completedUrls} / {job.totalUrls} pages crawled
                      </span>
                      <span>{percent}%</span>
                    </div>
                    <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          job.status === "completed"
                            ? "bg-emerald-500"
                            : job.status === "waiting"
                            ? "bg-amber-400"
                            : "bg-gradient-to-r from-teal-500 to-indigo-600"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-700">{runningCount}</span> active / waiting
            <span>•</span>
            <span className="font-bold text-slate-700">{completedCount}</span> completed
          </div>

          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <button
                type="button"
                onClick={clearCompletedStealthJobs}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                Clear Completed
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
