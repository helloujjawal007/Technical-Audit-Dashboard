import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { invokeEdgeFunction } from "@/lib/api";

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
  clearRecovery: () => void;
  refreshSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
  signInAsGuest: () => void;
  exitGuest: () => void;
}

import { isSystemAdminUser } from "@/lib/admin";

const GUEST_KEY = "guest-session";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [guest, setGuest] = useState<GuestInfo | null>(null);
  const [isRecovery, setIsRecovery] = useState(() => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash || "";
    return hash.includes("type=recovery") || hash.includes("type=reset");
  });

  const clearRecovery = useCallback(() => {
    setIsRecovery(false);
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      (async () => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
        if (event === "PASSWORD_RECOVERY") {
          setIsRecovery(true);
        }
        if (newSession?.user) {
          setGuest(null);
          localStorage.removeItem(GUEST_KEY);
        }
      })();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      refreshSubscription();
    } else {
      setSubscription(null);
    }
  }, [user, refreshSubscription]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSubscription(null);
    setGuest(null);
    localStorage.removeItem(GUEST_KEY);
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
    localStorage.removeItem(GUEST_KEY);
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
