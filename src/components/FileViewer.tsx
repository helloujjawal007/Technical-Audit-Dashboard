import { useState } from "react";
import { FileText, FileCode, ExternalLink } from "lucide-react";

interface FileViewerProps {
  robotsContent: string | null;
  sitemapContent: string | null;
  sitemapUrl?: string | null;
}

export function FileViewer({ robotsContent, sitemapContent, sitemapUrl }: FileViewerProps) {
  const [tab, setTab] = useState<"robots" | "sitemap">("robots");
  const content = tab === "robots" ? robotsContent : sitemapContent;

  const hasRobots = robotsContent !== null && robotsContent !== "";
  const hasSitemap = sitemapContent !== null && sitemapContent !== "";

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">Crawler Files</h3>
      </div>

      <div className="flex gap-1 mb-3 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          onClick={() => setTab("robots")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            tab === "robots" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          robots.txt
          {!hasRobots && <span className="ml-1.5 text-rose-400">missing</span>}
        </button>
        <button
          onClick={() => setTab("sitemap")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            tab === "sitemap" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          sitemap
          {!hasSitemap && <span className="ml-1.5 text-rose-400">missing</span>}
        </button>
      </div>

      {tab === "sitemap" && hasSitemap && sitemapUrl && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
          <ExternalLink className="w-3 h-3" />
          <a href={sitemapUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 truncate max-w-full">
            {sitemapUrl}
          </a>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-900 overflow-hidden">
        {content ? (
          <pre className="p-4 text-xs text-slate-300 overflow-x-auto max-h-80 font-mono leading-relaxed">
            {content}
          </pre>
        ) : (
          <div className="p-8 text-center">
            <FileCode className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {tab === "robots"
                ? "No robots.txt file found at /robots.txt"
                : "No sitemap found (checked sitemap.xml and sitemap_index.xml)"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
