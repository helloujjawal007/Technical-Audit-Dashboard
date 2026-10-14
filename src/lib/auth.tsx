import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { invokeEdgeFunction } from "@/lib/api";
import { isSystemAdminUser } from "@/lib/admin";

export interface Subscription {
  tier: string;
}

export interface GuestInfo {
  isGuest: true;
  ipKey: string;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  subscription: Subscription | null;
  guest: GuestInfo | null;
  isRecovery: boolean;
  authUrlError: string | null;
  emailVerifiedWelcome: boolean;
  clearEmailVerifiedWelcome: () => void;
  clearAuthUrlError: () => void;
  clearRecovery: () => void;
  refreshSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
  signInAsGuest: () => void;
  exitGuest: () => void;
}

const GUEST_KEY = "guest-session";
const RECOVERY_STORAGE_KEY = "supabase_auth_recovery_active";

function checkIsRecovery(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  const inStorage = sessionStorage.getItem(RECOVERY_STORAGE_KEY) === "true";

  return (
    inStorage ||
    hash.includes("type=recovery") ||
    hash.includes("type=reset") ||
    hash.includes("reset-password") ||
    search.includes("type=recovery") ||
    search.includes("reset=true")
  );
}

function checkIsEmailVerifiedRedirect(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  return (
    hash.includes("type=signup") ||
    search.includes("type=signup") ||
    hash.includes("type=email_change") ||
    search.includes("type=email_change")
  );
}

function extractUrlAuthError(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  if (!hash.includes("error") && !search.includes("error")) return null;

  const parseParam = (source: string, key: string) => {
    const match = source.match(new RegExp(`[?&#]${key}=([^&#]*)`));
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : null;
  };

  const desc = parseParam(search, "error_description") || parseParam(hash, "error_description");
  const code = parseParam(search, "error_code") || parseParam(hash, "error_code");

  if (code === "otp_expired") {
    return "This password reset link has expired or has already been used. Please request a new password reset link.";
  }
  if (desc) {
    return desc;
  }
  const err = parseParam(search, "error") || parseParam(hash, "error");
  if (err) {
    return `Authentication error: ${err}`;
  }
  return null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [guest, setGuest] = useState<GuestInfo | null>(null);
  const [authUrlError, setAuthUrlError] = useState<string | null>(() => extractUrlAuthError());
  const [emailVerifiedWelcome, setEmailVerifiedWelcome] = useState<boolean>(() => checkIsEmailVerifiedRedirect());
  const [isRecovery, setIsRecovery] = useState<boolean>(() => {
    // If there is an auth error, don't trap the user in reset mode
    if (extractUrlAuthError()) return false;
    return checkIsRecovery();
  });

  const clearAuthUrlError = useCallback(() => {
    setAuthUrlError(null);
  }, []);

  const clearEmailVerifiedWelcome = useCallback(() => {
    setEmailVerifiedWelcome(false);
  }, []);

  const clearRecovery = useCallback(() => {
    setIsRecovery(false);
    try {
      sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    } catch { /* ignore */ }
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const refreshSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      return;
    }

    const isTargetAdmin = isSystemAdminUser(user);

    const { data } = await supabase
      .from("user_subscriptions")
      .select("tier")
      .eq("user_id", user.id)
      .maybeSingle();

    if (isTargetAdmin) {
      setSubscription({ tier: "admin" });
      if (data?.tier !== "admin") {
        try {
          await supabase.from("user_subscriptions").upsert({
            user_id: user.id,
            tier: "admin",
          });
        } catch { /* ignore */ }
      }
      return;
    }

    setSubscription({ tier: data?.tier || "free" });
  }, [user]);

  useEffect(() => {
    // Check for existing guest session
    try {
      const stored = localStorage.getItem(GUEST_KEY);
      if (stored) {
        setGuest(JSON.parse(stored));
      }
    } catch { /* ignore */ }

    // If an error or verified param was in the URL, clean the URL so reloads are clean
    if ((authUrlError || emailVerifiedWelcome) && typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);

      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        try {
          sessionStorage.setItem(RECOVERY_STORAGE_KEY, "true");
        } catch { /* ignore */ }
      }

      if (event === "SIGNED_IN" && checkIsEmailVerifiedRedirect()) {
        setEmailVerifiedWelcome(true);
      }

      if (newSession?.user) {
        setGuest(null);
        try {
          localStorage.removeItem(GUEST_KEY);
        } catch { /* ignore */ }
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [authUrlError, emailVerifiedWelcome]);

  useEffect(() => {
    if (user) {
      refreshSubscription();
    } else {
      setSubscription(null);
    }
  }, [user, refreshSubscription]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("SignOut error:", err);
    } finally {
      setSession(null);
      setUser(null);
      setSubscription(null);
      setGuest(null);
      setIsRecovery(false);
      try {
        localStorage.removeItem(GUEST_KEY);
        sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
      } catch { /* ignore */ }
    }
  }, []);

  const signInAsGuest = useCallback(async () => {
    let ipKey = `guest-local-${Date.now()}`;
    try {
      const data = await invokeEdgeFunction<{ ip?: string }>("get-ip", {
        method: "GET",
      });
      if (data?.ip && data.ip !== "unknown") {
        ipKey = data.ip;
      }
    } catch { /* fallback to local key */ }
    const guestInfo: GuestInfo = { isGuest: true, ipKey };
    setGuest(guestInfo);
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(guestInfo));
    } catch { /* ignore */ }
  }, []);

  const exitGuest = useCallback(() => {
    setGuest(null);
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch { /* ignore */ }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        subscription,
        guest,
        isRecovery,
        authUrlError,
        emailVerifiedWelcome,
        clearEmailVerifiedWelcome,
        clearAuthUrlError,
        clearRecovery,
        refreshSubscription,
        signOut,
        signInAsGuest,
        exitGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
