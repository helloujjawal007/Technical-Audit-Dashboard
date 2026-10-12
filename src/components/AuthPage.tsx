import { useState, useEffect, useRef } from "react";
import {
  ScanSearch,
  Mail,
  User as UserIcon,
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  UserPlus,
  LogIn,
  Ghost,
  Wand2,
  ShieldCheck,
  RotateCw,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuthStep = "choose" | "signup" | "signin" | "forgot" | "forgot_sent" | "reset";

interface AuthPageProps {
  onGuestLogin: () => void;
  isRecoveryMode?: boolean;
  onRecoveryComplete?: () => void;
  initialError?: string | null;
  onClearInitialError?: () => void;
}

function normalizeAuthEmail(val: string): string {
  const trimmed = val.trim().toLowerCase();
  if (!trimmed) return "";
  if (!trimmed.includes("@")) {
    const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();
    if (adminEmail && adminEmail.split("@")[0] === trimmed) {
      return adminEmail;
    }
    return `${trimmed}@gmail.com`;
  }
  return trimmed;
}

function isValidEmailOrUsername(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }
  return /^[a-zA-Z0-9._-]+$/.test(trimmed);
}

export function AuthPage({
  onGuestLogin,
  isRecoveryMode = false,
  onRecoveryComplete,
  initialError,
  onClearInitialError,
}: AuthPageProps) {
  const [step, setStep] = useState<AuthStep>(isRecoveryMode ? "reset" : "choose");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Recovery & Reset fields
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isManualCode, setIsManualCode] = useState(false);
  const [activeSessionEmail, setActiveSessionEmail] = useState<string | null>(null);

  // Status and feedback
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError || null);
  const [info, setInfo] = useState<string | null>(null);

  const resetRequestInFlight = useRef(false);

  // Check for active session when in recovery mode
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setActiveSessionEmail(session.user.email);
        if (!email) {
          setEmail(session.user.email);
        }
      }
    });
  }, [email, step]);

  // Handle URL recovery state
  useEffect(() => {
    if (isRecoveryMode) {
      setStep("reset");
      setIsManualCode(false);
      setError(null);
      setInfo(null);
      return;
    }
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    if (
      hash.includes("type=recovery") ||
      hash.includes("type=reset") ||
      hash.includes("reset-password") ||
      search.includes("type=recovery") ||
      search.includes("reset=true")
    ) {
      setStep("reset");
      setIsManualCode(false);
      setError(null);
      setInfo(null);
    }
  }, [isRecoveryMode]);

  // Handle initial error passed from auth URL extraction
  useEffect(() => {
    if (initialError) {
      setError(initialError);
      onClearInitialError?.();
    }
  }, [initialError, onClearInitialError]);

  // Cooldown countdown timer for resending emails
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const resetFields = () => {
    setPassword("");
    setToken("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowNewPassword(false);
    setUnconfirmedEmail(null);
  };

  const handleStart = (m: "signin" | "signup") => {
    setStep(m === "signup" ? "signup" : "signin");
    setError(null);
    setInfo(null);
    resetFields();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = normalizeAuthEmail(email);

    if (!cleanEmail) {
      setError("Email or username is required.");
      return;
    }
    if (!isValidEmailOrUsername(email)) {
      setError("Please enter a valid email address or username.");
      return;
    }
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: name.trim(),
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (signUpError) {
        const message = signUpError.message.toLowerCase();
        if (message.includes("already") || message.includes("registered")) {
          setError("An account with this email already exists. Please sign in instead.");
          setStep("signin");
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      if (data?.session) {
        // Automatically signed in
        setInfo("Account created successfully! Welcome to SEO Audit Pro.");
      } else {
        // Confirmation email sent
        setInfo(
          `Account created! A confirmation email has been sent to ${cleanEmail}. Please check your inbox (and spam folder) and click the link to activate your account.`
        );
        setUnconfirmedEmail(cleanEmail);
        setStep("signin");
        setPassword("");
      }
    } catch (err) {
      console.error("Sign up error:", err);
      setError("Something went wrong during sign up. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = normalizeAuthEmail(email);

    if (!cleanEmail) {
      setError("Email or username is required.");
      return;
    }
    if (!isValidEmailOrUsername(email)) {
      setError("Please enter a valid email address or username.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    setUnconfirmedEmail(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (signInError) {
        const message = signInError.message.toLowerCase();
        if (message.includes("invalid") || message.includes("credentials")) {
          setError("Invalid email or password. Please verify your details or reset your password.");
        } else if (message.includes("not confirmed") || message.includes("unconfirmed")) {
          setUnconfirmedEmail(cleanEmail);
          setError("Your email address has not been confirmed yet. Please verify your email before logging in.");
        } else if (message.includes("rate limit") || message.includes("too many")) {
          setError("Too many login attempts. Please wait a few moments before trying again.");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      setInfo("Login successful! Redirecting to dashboard...");
    } catch (err) {
      console.error("Sign in error:", err);
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const targetEmail = unconfirmedEmail || normalizeAuthEmail(email);
    if (!targetEmail) return;

    setResendLoading(true);
    setError(null);
    setInfo(null);

    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (resendErr) {
        setError(resendErr.message || "Failed to resend confirmation email.");
      } else {
        setInfo(`Confirmation email resent to ${targetEmail}! Please check your inbox and spam folder.`);
        setResendCooldown(60);
      }
    } catch (err) {
      console.error("Resend confirmation error:", err);
      setError("Failed to resend confirmation email. Please try again later.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = normalizeAuthEmail(email);

    if (!cleanEmail) {
      setError("Email address is required for magic link.");
      return;
    }
    if (!cleanEmail.includes("@")) {
      setError("Please provide a full email address (e.g. you@example.com).");
      return;
    }

    setMagicLoading(true);
    setError(null);
    setInfo(null);

    try {
      const { error: magicError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (magicError) {
        setError(magicError.message);
      } else {
        setInfo(`Magic link sent! Check your inbox at ${cleanEmail} and click the link to sign in.`);
      }
    } catch (err) {
      console.error("Magic link error:", err);
      setError("Something went wrong sending magic link. Please try again.");
    } finally {
      setMagicLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetRequestInFlight.current) return;

    const cleanEmail = normalizeAuthEmail(email);

    if (!cleanEmail) {
      setError("Email or username is required.");
      return;
    }

    resetRequestInFlight.current = true;
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      // Direct redirect URL with fallback query and hash indicators
      const redirectUrl = `${window.location.origin}/?reset=true#type=recovery`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        throw resetError;
      }

      setEmail(cleanEmail);
      setResendCooldown(60);
      setStep("forgot_sent");
    } catch (err) {
      console.error("Password reset error:", err);
      const message = err instanceof Error ? err.message : "";
      if (/rate limit|too many requests|\b429\b/i.test(message)) {
        setError("Password reset emails are temporarily rate-limited. Please wait 1-2 minutes before trying again.");
      } else {
        setError(message || "Could not send password reset email. Please verify your address and try again.");
      }
    } finally {
      resetRequestInFlight.current = false;
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = normalizeAuthEmail(email || activeSessionEmail || "");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please verify both password fields.");
      return;
    }

    setResetLoading(true);
    setError(null);
    setInfo(null);

    try {
      const trimmedToken = token.trim();

      // Case 1: Manual code verification
      if (trimmedToken || isManualCode) {
        if (!cleanEmail) {
          setError("Email is required when verifying with a code.");
          setResetLoading(false);
          return;
        }

        if (!trimmedToken) {
          setError("Please enter the verification code sent to your email.");
          setResetLoading(false);
          return;
        }

        const { error: otpError } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: trimmedToken,
          type: "recovery",
        });

        if (otpError) {
          setError(otpError.message || "Invalid or expired verification code. Please request a new one.");
          setResetLoading(false);
          return;
        }
      }

      // Case 2: Update password for authenticated recovery session
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session) {
        setError(
          "No active reset session found. Please click the reset link in your email, or enter the verification code."
        );
        setIsManualCode(true);
        setResetLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        setError(updateError.message || "Failed to update password. Your reset link may have expired.");
        setResetLoading(false);
        return;
      }

      // Password updated successfully! Clear recovery session so user can log in cleanly
      try {
        await supabase.auth.signOut();
      } catch { /* ignore */ }

      onRecoveryComplete?.();
      setInfo("Password updated successfully! Please sign in with your new password.");
      setStep("signin");
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setToken("");
      setIsManualCode(false);
    } catch (err: unknown) {
      console.error("Password update error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* LOGO & BRANDING */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-700 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-700/20">
            <ScanSearch className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">SEO Audit Pro</h1>
            <p className="text-xs font-medium text-slate-400">Technical & On-Page SEO Intelligence</p>
          </div>
        </div>

        {/* MAIN CARD */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-7 sm:p-8 space-y-5">
          {/* STEP: CHOOSE */}
          {step === "choose" && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-black text-slate-800">Welcome to SEO Audit Pro</h2>
                <p className="text-xs text-slate-500">
                  Sign in to your account, create a new one, or test the engine instantly as a guest.
                </p>
              </div>

              {error && (
                <div className="flex gap-2.5 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-rose-700 text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleStart("signin")}
                  className="w-full rounded-2xl bg-teal-600 text-white py-3.5 font-bold hover:bg-teal-700 transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Account
                </button>

                <button
                  type="button"
                  onClick={() => handleStart("signup")}
                  className="w-full rounded-2xl border border-slate-200 py-3.5 font-bold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-slate-500" />
                  Create New Account
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Guest Login */}
              <button
                type="button"
                onClick={onGuestLogin}
                className="w-full rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/60 py-3.5 font-bold text-teal-800 hover:bg-teal-100/70 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Ghost className="w-4 h-4 text-teal-600" />
                Continue as Guest (5 Daily Audits)
              </button>
            </div>
          )}

          {/* STEP: SIGN IN */}
          {step === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>

              <div>
                <h2 className="text-xl font-black text-slate-800">Sign In</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter your credentials to access your dashboard.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com or username"
                    autoComplete="email"
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("forgot");
                      setError(null);
                      setInfo(null);
                    }}
                    className="text-xs text-teal-600 hover:underline font-bold cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex flex-col gap-2 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-rose-700 text-xs leading-relaxed">
                  <div className="flex gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                  {unconfirmedEmail && (
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resendLoading || resendCooldown > 0}
                      className="self-start mt-1 text-xs font-bold text-teal-700 hover:text-teal-900 underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {resendLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {resendCooldown > 0
                          ? `Resend available in ${resendCooldown}s`
                          : "Resend Confirmation Email"}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {info && (
                <div className="flex gap-2.5 bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-emerald-800 text-xs leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span>{info}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-teal-600 text-white py-3.5 font-bold hover:bg-teal-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Sign In</span>
              </button>

              {/* Magic link fallback */}
              <div className="pt-2">
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={magicLoading || !email.trim()}
                  className="w-full mt-2 rounded-2xl border border-slate-200 py-3 font-semibold text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {magicLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5 text-teal-600" />
                  )}
                  <span>Sign In with Email Magic Link</span>
                </button>
              </div>

              <p className="text-center text-xs text-slate-500 pt-1">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleStart("signup")}
                  className="text-teal-600 font-bold hover:underline cursor-pointer"
                >
                  Create one now
                </button>
              </p>
            </form>
          )}

          {/* STEP: SIGN UP */}
          {step === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>

              <div>
                <h2 className="text-xl font-black text-slate-800">Create Account</h2>
                <p className="text-xs text-slate-500 mt-0.5">Start running high-speed technical SEO audits.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex gap-2.5 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-rose-700 text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div className="flex gap-2.5 bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-emerald-800 text-xs leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span>{info}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-teal-600 text-white py-3.5 font-bold hover:bg-teal-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Create Account</span>
              </button>

              <p className="text-center text-xs text-slate-500 pt-1">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleStart("signin")}
                  className="text-teal-600 font-bold hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            </form>
          )}

          {/* STEP: FORGOT PASSWORD REQUEST */}
          {step === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setStep("signin");
                  setError(null);
                  setInfo(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </button>

              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 mx-auto flex items-center justify-center text-teal-600 shadow-sm">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-slate-800 pt-1">Reset Your Password</h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Enter your email address and we'll send you a password reset link.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
                  />
                </div>
              </div>

              {error && (
                <div className="flex gap-2.5 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-rose-700 text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-teal-600 text-white py-3.5 font-bold hover:bg-teal-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Send Reset Link</span>
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep("reset");
                    setIsManualCode(true);
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-xs text-slate-500 hover:text-teal-600 font-semibold underline cursor-pointer"
                >
                  Have a 6-digit verification code? Enter code manually
                </button>
              </div>
            </form>
          )}

          {/* STEP: FORGOT EMAIL SENT CONFIRMATION */}
          {step === "forgot_sent" && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 mx-auto flex items-center justify-center text-emerald-600 shadow-sm">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-black text-slate-800">Check Your Inbox</h2>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  We've sent a password reset link to:
                  <br />
                  <strong className="font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-1">
                    {email}
                  </strong>
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto pt-1">
                  Click the link in the email to set your new password. If you don't see it within a minute, check your spam or junk folder.
                </p>
              </div>

              {error && (
                <div className="flex gap-2.5 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-rose-700 text-xs text-left leading-relaxed">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div className="flex gap-2.5 bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-emerald-800 text-xs text-left leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span>{info}</span>
                </div>
              )}

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading || resendCooldown > 0}
                  className="w-full rounded-2xl border border-slate-200 py-3 font-bold text-xs text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>
                    {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : "Resend Reset Email"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("signin");
                    setError(null);
                    setInfo(null);
                  }}
                  className="w-full rounded-2xl bg-teal-600 text-white py-3 font-bold text-xs hover:bg-teal-700 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep("reset");
                    setIsManualCode(true);
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-xs text-slate-500 hover:text-teal-600 font-semibold underline cursor-pointer"
                >
                  Have a 6-digit verification code? Enter code manually
                </button>
              </div>
            </div>
          )}

          {/* STEP: RESET PASSWORD / SET NEW PASSWORD */}
          {step === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 mx-auto flex items-center justify-center text-teal-600 shadow-sm">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-slate-800 pt-1">
                  {isManualCode ? "Verify Code & Set Password" : "Set New Password"}
                </h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {isManualCode
                    ? "Enter the 6-digit code sent to your email and your new password."
                    : "Create a new strong password for your account."}
                </p>
                {(activeSessionEmail || email) && !isManualCode && (
                  <div className="pt-1">
                    <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                      Account: {activeSessionEmail || email}
                    </span>
                  </div>
                )}
              </div>

              {/* In manual code mode, show email and token fields */}
              {isManualCode && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      6-Digit Verification Code
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="123456"
                        required
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono tracking-widest text-center"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Confirm New Password
                  </label>
                  {confirmPassword && (
                    <span
                      className={`text-[11px] font-bold ${
                        newPassword === confirmPassword ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {newPassword === confirmPassword ? "✓ Passwords match" : "Passwords do not match"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
                  />
                </div>
              </div>

              {error && (
                <div className="flex gap-2.5 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-rose-700 text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div className="flex gap-2.5 bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-emerald-800 text-xs leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span>{info}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full rounded-2xl bg-teal-600 text-white py-3.5 font-bold hover:bg-teal-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 cursor-pointer"
              >
                {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Update Password</span>
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("signin");
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>

                <button
                  type="button"
                  onClick={() => setIsManualCode(!isManualCode)}
                  className="text-teal-600 hover:underline font-bold cursor-pointer"
                >
                  {isManualCode ? "Reset via email link instead" : "Enter verification code"}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By signing in, you agree to our Terms of Service & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
