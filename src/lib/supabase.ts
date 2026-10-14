import { createClient } from "@supabase/supabase-js";

// Production defaults (safe for both local dev and hosted deployments like Vercel)
const DEFAULT_SUPABASE_URL = "https://vwcxxdqtjieotmhtifgz.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Y3h4ZHF0amllb3RtaHRpZmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzY0OTMsImV4cCI6MjEwNzMxMjQ5M30.akcki1QrALlbbLNF29zoTXx0P2YqEKOhy_b81HPH2ug";

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY;

// Pre-sanitize hash if URL contains multiple '#' characters from older redirect URLs
if (typeof window !== "undefined" && window.location.hash) {
  const rawHash = window.location.hash;
  if ((rawHash.match(/#/g) || []).length > 1) {
    try {
      const fixedHash = rawHash.slice(0, 1) + rawHash.slice(1).replace(/#/g, "&");
      window.location.hash = fixedHash;
    } catch { /* ignore */ }
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  },
});
