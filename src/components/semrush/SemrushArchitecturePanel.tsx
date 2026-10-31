import { useState } from "react";
import { Search } from "lucide-react";
import type { LinkAnalysis, LinkItem } from "@/types";

interface SemrushArchitecturePanelProps {
  linkAnalysis?: LinkAnalysis | null;
  links?: LinkItem[];
  pageUrl?: string;
}

export function SemrushArchitecturePanel({
  linkAnalysis,
  links = [],
}: SemrushArchitecturePanelProps) {
  const [searchAnchor, setSearchAnchor] = useState("");

  const internalLinks = linkAnalysis?.internal || [];
  const externalLinks = linkAnalysis?.external || [];
  const dofollowLinks = linkAnalysis?.dofollow || [];
  const nofollowLinks = linkAnalysis?.nofollow || [];

  const totalLinks = (internalLinks.length + externalLinks.length) || links.length || 1;
  const internalPct = Math.round((internalLinks.length / totalLinks) * 100);
  const externalPct = Math.round((externalLinks.length / totalLinks) * 100);

  // Group anchor texts
  const anchorMap = new Map<string, { count: number; targets: string[] }>();
  for (const l of internalLinks) {
    const text = (l.text || "").trim() || "(empty anchor / image link)";
    if (!anchorMap.has(text)) {
      anchorMap.set(text, { count: 0, targets: [] });
    }
    const item = anchorMap.get(text)!;
    item.count++;
    if (!item.targets.includes(l.href)) {
      item.targets.push(l.href);
    }
  }

  const sortedAnchors = Array.from(anchorMap.entries())
    .map(([text, data]) => ({ text, count: data.count, targets: data.targets }))
    .sort((a, b) => b.count - a.count);

  const filteredAnchors = sortedAnchors.filter((a) =>
    a.text.toLowerCase().includes(searchAnchor.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Architecture Overview Banner */}
      <div className="p-5 sm:p-6 rounded-3xl border border-slate-200/90 bg-white shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-800">
            Site Architecture & Link Equity
          </h3>
          <p className="text-xs text-slate-400">
            SEMrush internal linking metrics measuring link juice distribution, crawl depth, and equity balance
          </p>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
              Internal Links
            </span>
            <span className="text-2xl font-black text-indigo-950 mt-1 block">
              {internalLinks.length}
            </span>
            <span className="text-[10px] text-indigo-600 font-semibold">
              {internalPct}% of all page links
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              External Outlinks
            </span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">
              {externalLinks.length}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              {externalPct}% pointing outbound
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
              Dofollow Equity
            </span>
            <span className="text-2xl font-black text-emerald-950 mt-1 block">
              {dofollowLinks.length}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold">
              Passing PageRank juice
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
              Nofollow / Sponsored
            </span>
            <span className="text-2xl font-black text-amber-950 mt-1 block">
              {nofollowLinks.length}
            </span>
            <span className="text-[10px] text-amber-600 font-semibold">
              Restricted bot crawling
            </span>
          </div>
        </div>

        {/* Link Distribution Ratio Meter */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-xs font-bold text-slate-700">
            <span>Internal ({internalPct}%)</span>
            <span>External ({externalPct}%)</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="bg-indigo-600 h-full transition-all duration-700"
              style={{ width: `${internalPct}%` }}
              title={`Internal Links: ${internalLinks.length}`}
            />
            <div
              className="bg-amber-500 h-full transition-all duration-700"
              style={{ width: `${externalPct}%` }}
              title={`External Links: ${externalLinks.length}`}
            />
          </div>
        </div>
      </div>

      {/* Crawl Depth & Click Architecture */}
      <div className="p-5 sm:p-6 rounded-3xl border border-slate-200/90 bg-white shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
            Click Depth Distribution (Crawl Distance from Home)
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Pages requiring more than 3 clicks from the homepage receive significantly less Googlebot crawl frequency
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/40 text-center space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">1 Click (Hubs)</span>
            <p className="text-xl font-black text-emerald-800">Direct</p>
            <p className="text-[10px] text-emerald-600">High crawl priority</p>
          </div>

          <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/40 text-center space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">2 Clicks (Categories)</span>
            <p className="text-xl font-black text-blue-800">Optimal</p>
            <p className="text-[10px] text-blue-600">Standard crawl budget</p>
          </div>

          <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40 text-center space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">3 Clicks (Deep)</span>
            <p className="text-xl font-black text-amber-800">Acceptable</p>
            <p className="text-[10px] text-amber-600">Occasional re-crawling</p>
          </div>

          <div className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50/40 text-center space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">4+ Clicks (At Risk)</span>
            <p className="text-xl font-black text-rose-800">Orphan Risk</p>
            <p className="text-[10px] text-rose-600">Difficult to discover</p>
          </div>
        </div>
      </div>

      {/* Anchor Text Analysis Table */}
      <div className="p-5 sm:p-6 rounded-3xl border border-slate-200/90 bg-white shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              Internal Anchor Text Distribution ({sortedAnchors.length} unique anchors)
            </h4>
            <p className="text-xs text-slate-400">
              Descriptive anchor texts guide Google crawlers on the topical relevance of target URLs
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchAnchor}
              onChange={(e) => setSearchAnchor(e.target.value)}
              placeholder="Search anchors..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 overflow-hidden">
          {filteredAnchors.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No internal anchor texts found.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 border-b border-slate-100 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Anchor Text</th>
                  <th className="py-2.5 px-3 text-center">Frequency</th>
                  <th className="py-2.5 px-3">Example Target URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAnchors.slice(0, 50).map((a, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-800 max-w-xs truncate">
                      {a.text === "(empty anchor / image link)" ? (
                        <span className="text-amber-600 italic">{a.text}</span>
                      ) : (
                        `"${a.text}"`
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                        {a.count}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-blue-600 truncate max-w-sm">
                      <a href={a.targets[0]} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {a.targets[0]}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
