import { useState } from "react";
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2, Copy as CopyIcon } from "lucide-react";
import { invokeEdgeFunction } from "@/lib/api";

export function PlagiarismChecker() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    similarityScore: number;
    matchedSources: { url: string; snippet: string; similarity: number }[];
    uniqueScore: number;
  } | null>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 50) {
      setError("Please enter at least 50 characters to check.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await invokeEdgeFunction<{
        similarityScore: number;
        matchedSources: { url: string; snippet: string; similarity: number }[];
        uniqueScore: number;
      }>("plagiarism-check", {
        method: "POST",
        body: { text: text.trim() },
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }

    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-teal-600" />
          Plagiarism Checker
        </h1>
        <p className="text-sm text-slate-400 mt-1">Check your content for potential plagiarism and uniqueness.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <form onSubmit={handleCheck} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Paste Your Content</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the text you want to check for plagiarism here..."
              rows={10}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm resize-y"
            />
            <p className="text-xs text-slate-400 mt-1">{text.trim().split(/\s+/).filter(Boolean).length} words</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || text.trim().length < 50}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            {loading ? "Checking..." : "Check for Plagiarism"}
          </button>
        </form>
      </div>

      {result && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          {/* Score summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <span className="text-sm font-semibold text-teal-700">Unique Content</span>
              </div>
              <p className="text-3xl font-bold text-teal-700">{result.uniqueScore}%</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 mb-1">
                <CopyIcon className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700">Similarity</span>
              </div>
              <p className="text-3xl font-bold text-amber-700">{result.similarityScore}%</p>
            </div>
          </div>

          {/* Matched sources */}
          {result.matchedSources.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Potential Matches Found</h3>
              <div className="space-y-3">
                {result.matchedSources.map((src, i) => (
                  <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between mb-1">
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-teal-600 hover:underline truncate max-w-[70%]">
                        {src.url}
                      </a>
                      <span className="text-xs font-semibold text-amber-600">{src.similarity}% match</span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{src.snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">No significant matches found. Your content appears to be original.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
