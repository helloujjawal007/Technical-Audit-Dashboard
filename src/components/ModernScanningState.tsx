import { useEffect, useState } from "react";
import { Sparkles, Globe, ShieldCheck, Cpu, Gauge } from "lucide-react";

interface ModernScanningStateProps {
  url?: string;
  isCrawl?: boolean;
}

const SCAN_STEPS = [
  { icon: Globe, label: "Establishing SSL Connection & Fetching DOM..." },
  { icon: ShieldCheck, label: "Auditing Security Headers, Robots.txt & Sitemap..." },
  { icon: Cpu, label: "Inspecting Meta Tags, Open Graph & Canonical Links..." },
  { icon: Gauge, label: "Evaluating Core Web Vitals, Assets & Performance..." },
  { icon: Sparkles, label: "Validating Structured Data, JSON-LD & Keywords..." },
];

export function ModernScanningState({ url, isCrawl = false }: ModernScanningStateProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % SCAN_STEPS.length);
    }, 2200);

    const elapsedTimer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(stepTimer);
      clearInterval(elapsedTimer);
    };
  }, []);

  const currentStep = SCAN_STEPS[currentStepIndex];
  const StepIcon = currentStep.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none animate-fade-in">
      {/* Radar Graphic */}
      <div className="relative w-40 h-40 flex items-center justify-center mb-8">
        {/* Ambient Glow */}
        <div className="absolute inset-0 rounded-full bg-teal-500/15 blur-2xl animate-pulse-glow" />

        {/* Concentric Sonar Rings */}
        <div className="absolute inset-0 rounded-full border border-teal-500/20" />
        <div className="absolute inset-4 rounded-full border border-teal-500/30" />
        <div className="absolute inset-8 rounded-full border border-teal-500/40" />
        <div className="absolute inset-12 rounded-full border border-teal-500/50" />

        {/* Crosshairs */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-teal-500/20 -translate-y-1/2" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-teal-500/20 -translate-x-1/2" />

        {/* Radar Sweep Arm */}
        <div className="absolute inset-0 rounded-full overflow-hidden animate-radar-sweep">
          <div className="w-1/2 h-1/2 bg-gradient-to-br from-teal-400/40 to-transparent origin-bottom-right" />
        </div>

        {/* Center Orb */}
        <div className="relative z-10 w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30 animate-pulse">
          <StepIcon className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Live Status Header */}
      <div className="max-w-md mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-bold shadow-xs">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
          <span>{isCrawl ? "Crawling Site Architecture" : "Deep Analysis In Progress"}</span>
          <span className="text-teal-400">•</span>
          <span className="font-mono">{elapsed}s</span>
        </div>

        <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">
          {isCrawl ? "Discovering & Scanning Pages" : "Auditing Technical & On-Page SEO"}
        </h3>

        {url && (
          <p className="text-xs font-mono text-slate-500 max-w-sm mx-auto truncate bg-slate-100 px-3 py-1 rounded-lg">
            {url}
          </p>
        )}

        <p className="text-xs font-semibold text-teal-600 transition-all duration-300 min-h-[1.5rem] flex items-center justify-center gap-1.5 pt-1">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>{currentStep.label}</span>
        </p>
      </div>

      {/* Shimmering Progress Bar */}
      <div className="w-64 h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-teal-500 to-transparent w-full animate-shimmer" />
      </div>
    </div>
  );
}
