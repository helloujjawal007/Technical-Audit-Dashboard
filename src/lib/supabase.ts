import { createClient, type SupportedStorage } from "@supabase/supabase-js";

// Production defaults (safe for both local dev and hosted deployments like Vercel)
const DEFAULT_SUPABASE_URL = "https://vwcxxdqtjieotmhtifgz.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Y3h4ZHF0amllb3RtaHRpZmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzY0OTMsImV4cCI6MjEwNzMxMjQ5M30.akcki1QrALlbbLNF29zoTXx0P2YqEKOhy_b81HPH2ug";

export const supabaseUrl = ((typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL?.trim()) || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
export const supabaseAnonKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim()) || DEFAULT_SUPABASE_ANON_KEY;

// Pre-sanitize hash if URL contains multiple '#' characters from redirect links
if (typeof window !== "undefined" && window.location.hash) {
  const rawHash = window.location.hash;
  if ((rawHash.match(/#/g) || []).length > 1) {
    try {
      const fixedHash = rawHash.slice(0, 1) + rawHash.slice(1).replace(/#/g, "&");
      window.location.hash = fixedHash;
    } catch { /* ignore */ }
  }
}

/**
 * Custom auth storage adapter that honors the user's "Remember Me" preference.
 * - When Remember Me is enabled (default): Persists tokens in window.localStorage across restarts.
 * - When Remember Me is disabled: Confines session tokens to window.sessionStorage (cleared on window close).
 */
export const authStorageAdapter: SupportedStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const remember = localStorage.getItem("seo_pro_remember_me") !== "false";
      if (remember) {
        return localStorage.getItem(key);
      }
      return sessionStorage.getItem(key) || localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      const remember = localStorage.getItem("seo_pro_remember_me") !== "false";
      if (remember) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    } catch { /* ignore */ }
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch { /* ignore */ }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
    storage: authStorageAdapter,
  },
});
