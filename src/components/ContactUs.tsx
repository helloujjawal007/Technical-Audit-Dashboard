import { useState } from "react";
import { Mail, MapPin, Phone, Loader2, CheckCircle2, AlertCircle, Send, User, MessageSquare, Sparkles } from "lucide-react";

export function ContactUs() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim() || "General Inquiry",
          message: message.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not send message. Please try again.");
      }

      setSuccess(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }

    setLoading(false);
  };

  const inputClass = (field: string) => `
    w-full pl-12 pr-4 py-3.5 rounded-xl border bg-slate-50/50 text-slate-800 placeholder:text-slate-400
    transition-all duration-200 text-sm
    ${focusedField === field
      ? "border-teal-500 ring-4 ring-teal-500/10 bg-white"
      : "border-slate-200 hover:border-slate-300"
    }
    focus:outline-none
  `;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Mail className="w-6 h-6 text-teal-600" />
          Contact Us
        </h1>
        <p className="text-sm text-slate-400 mt-1">Have a question or need help? Send us a message and we'll get back to you.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {success ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-slate-700">Message Sent!</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-sm">Thank you for reaching out. We'll respond to your email within 24 hours.</p>
              <button
                onClick={() => setSuccess(false)}
                className="mt-6 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-all shadow-sm hover:shadow-md"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Send a Message</h2>
                  <p className="text-xs text-slate-400">We typically respond within 24 hours</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Name *</label>
                    <div className="relative">
                      <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${focusedField === "name" ? "text-teal-500" : "text-slate-400"}`} />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onFocus={() => setFocusedField("name")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Your name"
                        className={inputClass("name")}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Email *</label>
                    <div className="relative">
                      <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${focusedField === "email" ? "text-teal-500" : "text-slate-400"}`} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="you@example.com"
                        className={inputClass("email")}
                      />
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Subject</label>
                  <div className="relative">
                    <MessageSquare className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${focusedField === "subject" ? "text-teal-500" : "text-slate-400"}`} />
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      onFocus={() => setFocusedField("subject")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="What's this about?"
                      className={inputClass("subject")}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Message *</label>
                  <div className="relative">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onFocus={() => setFocusedField("message")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Tell us how we can help..."
                      rows={6}
                      className={`
                        w-full px-4 py-3.5 rounded-xl border bg-slate-50/50 text-slate-800 placeholder:text-slate-400
                        transition-all duration-200 text-sm resize-y
                        ${focusedField === "message"
                          ? "border-teal-500 ring-4 ring-teal-500/10 bg-white"
                          : "border-slate-200 hover:border-slate-300"
                        }
                        focus:outline-none
                      `}
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3.5 rounded-xl bg-rose-50 text-rose-700 text-sm border border-rose-100">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 text-white font-medium hover:from-teal-700 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {loading ? "Sending..." : "Send Message"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Contact info sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Get in Touch</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 group">
                <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                  <Mail className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="text-sm font-medium text-slate-700">support@seopro.tools</p>
                </div>
              </div>
              <div className="flex items-start gap-3 group">
                <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                  <Phone className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Phone</p>
                  <p className="text-sm font-medium text-slate-700">+1 (555) 123-4567</p>
                </div>
              </div>
              <div className="flex items-start gap-3 group">
                <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                  <MapPin className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Address</p>
                  <p className="text-sm font-medium text-slate-700">123 SEO Street, Suite 100<br />San Francisco, CA 94103</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-50 to-teal-50/50 rounded-2xl border border-teal-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-semibold text-teal-700">Response Time</h3>
            </div>
            <p className="text-xs text-teal-600 leading-relaxed">We typically respond within 24 hours during business days. For urgent issues, please call us directly.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
