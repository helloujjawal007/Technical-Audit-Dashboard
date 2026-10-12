import { ShieldCheck, Gauge, Boxes, ArrowRight, Zap, Search } from "lucide-react";

interface ReadyHeroStateProps {
  onSelectSample: (url: string) => void;
}

const SAMPLE_URLS = [
  { label: "GitHub", url: "https://github.com" },
  { label: "Stripe", url: "https://stripe.com" },
  { label: "Vercel", url: "https://vercel.com" },
  { label: "Tailwind CSS", url: "https://tailwindcss.com" },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Technical & On-Page SEO",
    description: "Evaluates robots.txt, sitemaps, canonical tags, HTTPS, and metadata against Google guidelines.",
    color: "text-teal-600 bg-teal-50 border-teal-200/60",
  },
  {
    icon: Gauge,
    title: "Core Web Vitals & Speed",
    description: "Profiles response latency, page size, script payload, and mobile readiness metrics.",
    color: "text-blue-600 bg-blue-50 border-blue-200/60",
  },
  {
    icon: Boxes,
    title: "Schema & Structured Data",
    description: "Validates JSON-LD, Microdata, Breadcrumbs, FAQs, and Open Graph social tags.",
    color: "text-violet-600 bg-violet-50 border-violet-200/60",
  },
  {
    icon: Zap,
    title: "AI Issue Prioritization",
    description: "Generates actionable fixes with recommended meta titles, descriptions, and link remediations.",
    color: "text-amber-600 bg-amber-50 border-amber-200/60",
  },
];

export function ReadyHeroState({ onSelectSample }: ReadyHeroStateProps) {
  return (
    <div className="py-12 px-4 sm:px-6 text-center max-w-4xl mx-auto space-y-10 animate-fade-in select-none">
      {/* Hero Badge & Heading */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/10 border border-teal-300/40 text-teal-800 text-xs font-bold shadow-xs">
          <Zap className="w-3.5 h-3.5 text-teal-600" />
          <span>Next-Generation Technical SEO Suite</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-800">
          Ready to Audit Your Website
        </h2>

        <p className="text-sm sm:text-base text-slate-500 max-w-xl mx-auto leading-relaxed">
          Enter any URL above to run a 90+ point automated SEO inspection. Results include complete issue diagnoses and copy-paste recommendations.
        </p>

        {/* Quick Sample Links */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Search className="w-3.5 h-3.5" /> Try a sample:
          </span>
          {SAMPLE_URLS.map((sample) => (
            <button
              key={sample.url}
              type="button"
              onClick={() => onSelectSample(sample.url)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-white border border-slate-200/90 text-slate-700 hover:text-teal-700 hover:border-teal-300 hover:bg-teal-50/50 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
            >
              <span>{sample.label}</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Feature Value Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
        {FEATURES.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.title}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300 group"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3.5 border transition-all group-hover:scale-110 ${feat.color}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1.5">{feat.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{feat.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
