import { useState, useEffect } from "react";
import {
  Send,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Zap,
  Globe,
  Building2,
  User,
  Mail,
  MapPin,
  Tag,
  Copy,
  Check,
} from "lucide-react";
import type { AuditResult } from "@/types";
import {
  extractAuditTakeaways,
  sendLeadToOutreach,
  type OutreachImportResponse,
} from "@/lib/outreachBridge";

interface SendToOutreachModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: Partial<AuditResult>;
  targetUrl: string;
  defaultBusinessName?: string;
}

export function SendToOutreachModal({
  isOpen,
  onClose,
  result,
  targetUrl,
  defaultBusinessName,
}: SendToOutreachModalProps) {
  let cleanDomain = "";
  try {
    cleanDomain = new URL(targetUrl).hostname.replace(/^www\./, "");
  } catch {
    cleanDomain = targetUrl.replace(/^https?:\/\//, "").split("/")[0];
  }

  const defaultName =
    defaultBusinessName ||
    cleanDomain
      .split(".")[0]
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const [businessName, setBusinessName] = useState(defaultName);
  const [websiteUrl, setWebsiteUrl] = useState(cleanDomain || targetUrl);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("General Website");
  const [location, setLocation] = useState("");
  const [takeaways, setTakeaways] = useState("");
  const [enrollAutopilot, setEnrollAutopilot] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<OutreachImportResponse | null>(null);
  const [copiedPitch, setCopiedPitch] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const autoTakeaways = extractAuditTakeaways(result);
      setTakeaways(autoTakeaways);
      setBusinessName(defaultName);
      setWebsiteUrl(cleanDomain || targetUrl);
      setError(null);
      setImportResult(null);
      setCopiedPitch(false);
    }
  }, [isOpen, result, targetUrl, defaultName, cleanDomain]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteUrl.trim()) {
      setError("Website URL is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await sendLeadToOutreach({
        business_name: businessName.trim() || cleanDomain,
        website_url: websiteUrl.trim(),
        email: email.trim() || undefined,
        first_name: firstName.trim() || undefined,
        category: category.trim() || "General Website",
        location: location.trim() || undefined,
        audit_key_takeaways: takeaways.trim(),
        enroll_autopilot: enrollAutopilot,
        result,
      });

      if (response.success) {
        setImportResult(response);
      } else {
        setError(response.message || "Failed to push to Outreach Dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to Outreach Dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPitch = () => {
    if (importResult?.generatedPitch?.body) {
      navigator.clipboard.writeText(
        `Subject: ${importResult.generatedPitch.subject}\n\n${importResult.generatedPitch.body}`
      );
      setCopiedPitch(true);
      setTimeout(() => setCopiedPitch(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-900 text-white p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black tracking-tight text-white">
                    Send to Outreach Dashboard
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-300 border border-teal-400/30">
                    ODS Bridge
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Compile client PDF report on disk & enqueue lead for 24/7 Autopilot cold pitch
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
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 max-h-[78vh] overflow-y-auto">
          {importResult ? (
            /* SUCCESS VIEW */
            <div className="space-y-6 animate-fade-in">
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-emerald-950">
                    Lead Pushed to Outreach Dashboard Successfully!
                  </h4>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    {importResult.message || `Lead "${businessName}" successfully imported and queued.`}
                  </p>
                  {importResult.lead?.audit_pdf_path && (
                    <div className="mt-2 text-[11px] font-mono text-emerald-700 bg-white/70 p-2 rounded-lg border border-emerald-200 break-all">
                      <span className="font-bold">Attached PDF: </span>
                      {importResult.lead.audit_pdf_path}
                    </div>
                  )}
                </div>
              </div>

              {/* Pitch Preview Box */}
              {importResult.generatedPitch && (
                <div className="space-y-3 bg-slate-50 rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        Generated Pitch (Template A — With PDF Attached)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyPitch}
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      {copiedPitch ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Pitch</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-xs">
                    <span className="font-bold text-slate-500">Subject: </span>
                    <span className="font-semibold text-slate-900">
                      {importResult.generatedPitch.subject}
                    </span>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                    {importResult.generatedPitch.body}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 pt-1">
                    <div className="flex items-center gap-1.5 font-bold text-teal-700">
                      <FileText className="w-3.5 h-3.5" />
                      <span>PDF Attachment: {importResult.generatedPitch.pdfFilename}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Status: {importResult.lead?.status || "active"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  Close & Continue
                </button>
              </div>
            </div>
          ) : (
            /* FORM VIEW */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Business Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Company / Business Name *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Salvation Land Management"
                    className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                {/* Website URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>Website Domain / URL *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="e.g. salvationlandmanagement.com"
                    className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                {/* Primary Contact Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Contact First / Full Name {"{{first_name}}"}</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Marcus"
                    className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                {/* Contact Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Prospect Email Address</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. contact@salvationlandmanagement.com"
                    className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                {/* Category / Industry */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    <span>Industry / Category</span>
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Land Management, E-Commerce"
                    className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Location (State / City)</span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Texas, Austin"
                    className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Priority Key Takeaways */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Audit Key Takeaways {"{{audit_key_takeaways}}"} *</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Appears in email body bullets
                  </span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={takeaways}
                  onChange={(e) => setTakeaways(e.target.value)}
                  placeholder="e.g. Server TTFB latency (554ms) and missing Schema.org LocalBusiness structured data"
                  className="w-full text-xs font-medium p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              {/* PDF Enclosure Info Box */}
              <div className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-teal-950">
                      Enclosed PDF: {cleanDomain}_technical_audit.pdf
                    </p>
                    <p className="text-[11px] text-teal-700">
                      Auto-generated to local disk (<code className="text-[10px]">reports/</code>) and attached to email
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-200/70 text-teal-900 shrink-0">
                  A4 Diagnostic
                </span>
              </div>

              {/* Autopilot Checkbox */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={enrollAutopilot}
                  onChange={(e) => setEnrollAutopilot(e.target.checked)}
                  className="mt-0.5 rounded-sm text-teal-600 focus:ring-teal-500"
                />
                <div className="text-xs">
                  <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-current" />
                    <span>Enroll in 24/7 Autopilot Queue (`status: active`)</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Autopilot will immediately generate the personalized cold pitch and deliver it with the PDF attached via rotating inboxes.
                  </p>
                </div>
              </label>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-xs shadow-md shadow-teal-600/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating PDF & Pushing Lead...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Push to Outreach Dashboard</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
