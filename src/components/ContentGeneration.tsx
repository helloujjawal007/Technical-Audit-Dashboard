import { useState } from "react";
import { PenLine, FileText, Type, Hash, Loader2, Copy, Check, Sparkles, Edit3, Save } from "lucide-react";
import { invokeEdgeFunction } from "@/lib/api";

type ContentType = "page" | "blog";
type SubType = "content" | "meta-title" | "meta-description";

const SUB_TYPES: { key: SubType; label: string; icon: typeof FileText; placeholder: string }[] = [
  { key: "content", label: "Page/Blog Content", icon: FileText, placeholder: "e.g. How to choose the best running shoes for beginners" },
  { key: "meta-title", label: "Meta Title", icon: Type, placeholder: "e.g. Best Running Shoes 2026 - Buyer's Guide" },
  { key: "meta-description", label: "Meta Description", icon: Hash, placeholder: "e.g. Discover the top running shoes for every budget and terrain" },
];

export function ContentGeneration() {
  const [contentType, setContentType] = useState<ContentType>("blog");
  const [subType, setSubType] = useState<SubType>("content");
  const [topic, setTopic] = useState("");
  const [wordCount, setWordCount] = useState(500);
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("professional");
  const [result, setResult] = useState("");
  const [editableResult, setEditableResult] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError("Please enter a topic or title.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult("");
    setEditableResult("");
    setIsEditing(false);

    try {
      const data = await invokeEdgeFunction<{ content?: string }>("content-generate", {
        method: "POST",
        body: {
          contentType,
          subType,
          topic: topic.trim(),
          wordCount,
          keywords: keywords.trim(),
          tone,
        },
      });

      setResult(data?.content || "");
      setEditableResult(data?.content || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }

    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editableResult : result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    setResult(editableResult);
    setIsEditing(false);
  };

  const activeSubType = SUB_TYPES.find((s) => s.key === subType)!;

  const wordCountOfResult = (isEditing ? editableResult : result).split(/\s+/).filter(Boolean).length;
  const h1Count = (isEditing ? editableResult : result).match(/^#\s/gm)?.length || 0;
  const h2Count = (isEditing ? editableResult : result).match(/^##\s/gm)?.length || 0;
  const h3Count = (isEditing ? editableResult : result).match(/^###\s/gm)?.length || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <PenLine className="w-6 h-6 text-teal-600" />
          Content Generation
        </h1>
        <p className="text-sm text-slate-400 mt-1">Generate SEO-optimized content for pages, blogs, meta titles, and meta descriptions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <form onSubmit={handleGenerate} className="space-y-5">
            {/* Content type */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Content Type</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContentType("page")}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    contentType === "page" ? "bg-teal-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Page
                </button>
                <button
                  type="button"
                  onClick={() => setContentType("blog")}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    contentType === "blog" ? "bg-teal-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Blog Post
                </button>
              </div>
            </div>

            {/* Sub-type */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">What to Generate</p>
              <div className="space-y-2">
                {SUB_TYPES.map((st) => {
                  const Icon = st.icon;
                  const active = subType === st.key;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setSubType(st.key)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all ${
                        active ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? "text-teal-600" : "text-slate-400"}`} />
                      <span className={`text-sm font-medium ${active ? "text-teal-700" : "text-slate-700"}`}>{st.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">
                {subType === "meta-title" ? "Title Topic" : subType === "meta-description" ? "Description Topic" : "Topic / Title"}
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={activeSubType.placeholder}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm"
              />
            </div>

            {/* Word count (only for content) */}
            {subType === "content" && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">
                  Word Count: <span className="text-teal-600 font-bold">{wordCount}</span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={3000}
                  step={100}
                  value={wordCount}
                  onChange={(e) => setWordCount(parseInt(e.target.value))}
                  className="w-full accent-teal-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>100</span>
                  <span>3000</span>
                </div>
                {wordCount >= 800 && (
                  <p className="text-xs text-teal-600 mt-2">
                    SEO structure: 1 H1, {wordCount >= 2500 ? "5-6" : wordCount >= 1500 ? "5" : "4-5"} H2, {wordCount >= 2500 ? "10-12" : wordCount >= 1500 ? "8-10" : "6-8"} H3
                  </p>
                )}
              </div>
            )}

            {/* Keywords */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Target Keywords (optional)</label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. running shoes, beginners, budget"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm"
              />
            </div>

            {/* Tone */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="friendly">Friendly</option>
                <option value="authoritative">Authoritative</option>
                <option value="conversational">Conversational</option>
              </select>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !topic.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? "Generating..." : "Generate Content"}
            </button>
          </form>
        </div>

        {/* Result */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">Generated Content</h2>
            {result && (
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <button
                    onClick={handleSaveEdit}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditableResult(result);
                      setIsEditing(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>

          {/* SEO stats bar */}
          {result && subType === "content" && !loading && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                {wordCountOfResult} words
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${h1Count === 1 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                H1: {h1Count} {h1Count === 1 ? "✓" : "(should be 1)"}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                H2: {h2Count}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                H3: {h3Count}
              </span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-teal-500 animate-spin mb-4" />
              <p className="text-sm text-slate-500">Generating your content...</p>
              <p className="text-xs text-slate-400 mt-1">This may take a few seconds for longer content.</p>
            </div>
          ) : result ? (
            isEditing ? (
              <textarea
                value={editableResult}
                onChange={(e) => setEditableResult(e.target.value)}
                className="w-full h-[600px] px-4 py-3 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm font-mono resize-y"
                placeholder="Edit your content here..."
              />
            ) : (
              <div className="prose prose-slate max-w-none">
                <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">{result}</div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
                <PenLine className="w-8 h-8 text-teal-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-700">Nothing generated yet</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">
                Fill in the form and click Generate to create SEO-optimized content.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
