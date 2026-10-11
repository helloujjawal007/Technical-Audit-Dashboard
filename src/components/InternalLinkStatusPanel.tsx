import { LinkIcon, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import type { InternalLinkStatus } from "@/types";

export function InternalLinkStatusPanel({ links }: { links: InternalLinkStatus[] }) {
  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LinkIcon className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-600">No internal links checked</p>
        <p className="text-xs text-slate-400 mt-1">Internal links are checked during staging and domain audits.</p>
      </div>
    );
  }

  const ok = links.filter((l) => (l.status ?? 0) >= 200 && (l.status ?? 0) < 300);
  const redirected = links.filter((l) => (l.status ?? 0) >= 300 && (l.status ?? 0) < 400);
  const broken = links.filter((l) => (l.status ?? 0) === 0 || (l.status ?? 0) >= 400);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <LinkIcon className="w-5 h-5 text-blue-500" />
        <h3 className="text-sm font-semibold text-slate-700">Internal Link Status</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="OK (2xx)" value={ok.length} color="text-emerald-600" bg="bg-emerald-50" />
        <StatBox label="Redirected (3xx)" value={redirected.length} color="text-amber-600" bg="bg-amber-50" />
        <StatBox label="Broken (4xx/5xx)" value={broken.length} color="text-rose-600" bg="bg-rose-50" />
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {links.map((link, i) => {
          const status = link.status ?? 0;
          const isOk = status >= 200 && status < 300;
          const isRedirect = status >= 300 && status < 400;
          const isBroken = status === 0 || status >= 400;

          return (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-white">
              {isOk && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
              {isRedirect && <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
              {isBroken && <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />}

              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 truncate">{link.text || "(no text)"}</p>
                <p className="text-xs text-slate-400 truncate font-mono">{link.href}</p>
                {link.redirect && (
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowRight className="w-3 h-3 text-amber-500" />
                    <span className="text-xs text-amber-600 truncate font-mono">{link.redirect}</span>
                  </div>
                )}
                {link.error && <p className="text-xs text-rose-500 mt-1">{link.error}</p>}
              </div>

              <CopyButton text={link.href} />

              <span className={`text-xs font-bold flex-shrink-0 px-2 py-1 rounded ${
                isOk ? "bg-emerald-50 text-emerald-700" :
                isRedirect ? "bg-amber-50 text-amber-700" :
                "bg-rose-50 text-rose-700"
              }`}>
                {status || "ERR"}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        Internal links are checked once and cached. Duplicate URLs across pages reuse the cached result.
      </p>
    </div>
  );
}

function StatBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`rounded-xl ${bg} p-3 text-center`}>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
