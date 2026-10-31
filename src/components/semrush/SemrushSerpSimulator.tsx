import { useState } from "react";
import {
  Monitor,
  Smartphone,
  RotateCcw,
  Copy,
  Check,
  Search,
} from "lucide-react";

interface SemrushSerpSimulatorProps {
  url: string;
  initialTitle: string | null;
  initialDescription: string | null;
  hasSchemaRating?: boolean;
  hasSchemaFaq?: boolean;
}

export function SemrushSerpSimulator({
  url,
  initialTitle,
  initialDescription,
  hasSchemaRating = false,
  hasSchemaFaq = false,
}: SemrushSerpSimulatorProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [title, setTitle] = useState(initialTitle || "");
  const [description, setDescription] = useState(initialDescription || "");
  const [copied, setCopied] = useState(false);

  // Approximate pixel widths: Desktop title ~580px (~60 chars), Description ~960px (~160 chars)
  const titleCharLimit = 60;
  const descCharLimit = 160;

  let domain = "yourdomain.com";
  let pathBreadcrumb = "";
  try {
    const parsed = new URL(url);
    domain = parsed.hostname;
    pathBreadcrumb = parsed.pathname !== "/" ? parsed.pathname.replace(/^\//, "").replace(/\/$/, "").replace(/\//g, " › ") : "";
  } catch {
    domain = url.replace(/^https?:\/\//, "").split("/")[0];
  }

  const handleReset = () => {
    setTitle(initialTitle || "");
    setDescription(initialDescription || "");
  };

  const handleCopyTags = () => {
    const snippet = `<title>${title}</title>\n<meta name="description" content="${description}" />`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const titleLen = title.length;
  const descLen = description.length;

  const isTitleOptimal = titleLen >= 30 && titleLen <= 60;
  const isTitleTooLong = titleLen > 60;
  const isDescOptimal = descLen >= 120 && descLen <= 160;
  const isDescTooLong = descLen > 160;

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-400/20 flex items-center justify-center text-orange-600 font-bold text-xs">
              <Search className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                Google SERP Simulator
              </h3>
              <p className="text-xs text-slate-400">
                Real-time preview of how this page renders in Google organic search results
              </p>
            </div>
          </div>
        </div>

        {/* Device Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              device === "desktop"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              device === "mobile"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile</span>
          </button>
        </div>
      </div>

      {/* Google Search Result Preview Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200/80 flex justify-center">
        <div
          className={`w-full bg-white transition-all duration-300 ${
            device === "desktop"
              ? "max-w-[650px] p-5 rounded-2xl shadow-xs border border-slate-100"
              : "max-w-[390px] p-4 rounded-3xl shadow-md border border-slate-200"
          }`}
        >
          {/* URL & Brand Header in Google Style */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200 flex-shrink-0">
              {domain.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-xs text-slate-800 font-semibold block truncate">
                {domain}
              </span>
              <span className="text-[11px] text-slate-500 block truncate">
                https://{domain}{pathBreadcrumb ? ` › ${pathBreadcrumb}` : ""}
              </span>
            </div>
          </div>

          {/* Clickable Title */}
          <h4
            className={`text-blue-800 hover:underline cursor-pointer font-medium leading-snug line-clamp-2 ${
              device === "desktop" ? "text-lg" : "text-base"
            }`}
          >
            {title || "Untitled Page"}
          </h4>

          {/* Rich Snippet Enhancements (if detected) */}
          {hasSchemaRating && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 my-1">
              <span className="text-amber-500 font-bold">★★★★★</span>
              <span className="font-semibold text-slate-700">4.9</span>
              <span className="text-slate-400">(128 reviews)</span>
            </div>
          )}

          {/* Snippet Description */}
          <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed line-clamp-3">
            {description || "No meta description provided for this page. Google will select relevant snippet text automatically."}
          </p>

          {/* FAQ Accordion snippet */}
          {hasSchemaFaq && (
            <div className="mt-3 pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-700">
              <div className="font-semibold text-slate-800">People also ask:</div>
              <div className="pl-2 border-l-2 border-indigo-400 text-slate-600 text-[11px]">
                ▸ How does this technical SEO audit work?
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Editor & Length Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Title Editor */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Title Tag</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`font-mono text-[11px] font-bold ${
                  isTitleOptimal
                    ? "text-emerald-600"
                    : isTitleTooLong
                    ? "text-rose-600"
                    : "text-amber-600"
                }`}
              >
                {titleLen} / {titleCharLimit} chars
              </span>
              {isTitleOptimal ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  Optimal
                </span>
              ) : isTitleTooLong ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                  Truncated
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                  Too Short
                </span>
              )}
            </div>
          </div>

          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isTitleOptimal
                  ? "bg-emerald-500"
                  : isTitleTooLong
                  ? "bg-rose-500"
                  : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, (titleLen / titleCharLimit) * 100)}%` }}
            />
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter page title..."
            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
          />
        </div>

        {/* Description Editor */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Meta Description</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`font-mono text-[11px] font-bold ${
                  isDescOptimal
                    ? "text-emerald-600"
                    : isDescTooLong
                    ? "text-rose-600"
                    : "text-amber-600"
                }`}
              >
                {descLen} / {descCharLimit} chars
              </span>
              {isDescOptimal ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  Optimal
                </span>
              ) : isDescTooLong ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                  Truncated
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                  Short
                </span>
              )}
            </div>
          </div>

          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isDescOptimal
                  ? "bg-emerald-500"
                  : isDescTooLong
                  ? "bg-rose-500"
                  : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, (descLen / descCharLimit) * 100)}%` }}
            />
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Enter meta description..."
            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
          />
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Page Content</span>
        </button>

        <button
          type="button"
          onClick={handleCopyTags}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-xs cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied HTML Tags!" : "Copy HTML Snippet"}</span>
        </button>
      </div>
    </div>
  );
}
