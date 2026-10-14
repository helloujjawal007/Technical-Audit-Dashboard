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
  Check,
  X,
  FileText,
  Shield,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { invokeEdgeFunction } from "@/lib/api";

type AuthStep = "choose" | "signup" | "signin" | "forgot" | "forgot_sent" | "reset";

interface AuthPageProps {
  onGuestLogin: () => void;
  isRecoveryMode?: boolean;
  onRecoveryComplete?: () => void;
  initialError?: string | null;
  onClearInitialError?: () => void;
}

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
  token?: string;
}

interface PasswordRules {
  hasMinLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

function evaluatePassword(pwd: string): { rules: PasswordRules; score: number; label: string; color: string } {
  const rules: PasswordRules = {
    hasMinLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSpecial: /[^A-Za-z0-9]/.test(pwd),
  };

  let score = 0;
  if (rules.hasMinLength) score++;
  if (rules.hasUpper) score++;
  if (rules.hasLower) score++;
  if (rules.hasNumber) score++;
  if (rules.hasSpecial) score++;

  let label = "Very Weak";
  let color = "bg-rose-500 text-rose-600";
  if (pwd.length === 0) {
    label = "";
    color = "bg-slate-200 text-slate-400";
  } else if (score <= 2) {
    label = "Weak";
    color = "bg-rose-500 text-rose-600";
  } else if (score === 3) {
    label = "Fair";
    color = "bg-amber-500 text-amber-600";
  } else if (score === 4) {
    label = "Good";
    color = "bg-teal-500 text-teal-600";
  } else if (score === 5) {
    label = "Strong";
    color = "bg-emerald-500 text-emerald-600";
  }

  return { rules, score, label, color };
}

function isValidStrictEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  if (trimmed.includes("..")) return false;
  // RFC 5322 compatible regex
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return re.test(trimmed);
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

function sanitizeFullName(name: string): string {
  return name
    .replace(/<[^>]*>?/gm, "") // strip HTML tags
    .replace(/['"`;\\]/g, "") // strip SQL / injection characters
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim();
}

export function AuthPage({
  onGuestLogin,
  isRecoveryMode = false,
  onRecoveryComplete,
  initialError,
  onClearInitialError,
}: AuthPageProps) {
  const [step, setStep] = useState<AuthStep>(isRecoveryMode ? "reset" : "choose");

  // Input states
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem("seo_pro_remember_me") !== "false";
    } catch {
      return true;
    }
  });

  // Recovery & Reset fields
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [isManualCode, setIsManualCode] = useState(false);
  const [activeSessionEmail, setActiveSessionEmail] = useState<string | null>(null);
  const [directResetUrl, setDirectResetUrl] = useState<string | null>(null);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError || null);
  const [info, setInfo] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Terms / Privacy modal
  const [modalTab, setModalTab] = useState<"terms" | "privacy" | null>(null);

  // In-flight guard to prevent double submit
  const inFlightRef = useRef(false);

  // DOM Refs for programmatic focus
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);

  // Password evaluation
  const signupEval = evaluatePassword(password);
  const resetEval = evaluatePassword(newPassword);

  // Check for active recovery session on mount or step change
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

  // Handle initial error from URL extraction
  useEffect(() => {
    if (initialError) {
      setError(initialError);
      onClearInitialError?.();
    }
  }, [initialError, onClearInitialError]);

  // Cooldown countdown timer for resending
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const clearErrors = () => {
    setError(null);
    setFieldErrors({});
    setInfo(null);
  };

  const resetFields = () => {
    setPassword("");
    setConfirmPassword("");
    setToken("");
    setNewPassword("");
    setResetConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowNewPassword(false);
    setShowResetConfirmPassword(false);
    setUnconfirmedEmail(null);
    setAgreeTerms(false);
    setDirectResetUrl(null);
    clearErrors();
  };

  const handleBackToSignIn = () => {
    onRecoveryComplete?.();
    try {
      sessionStorage.removeItem("supabase_auth_recovery_active");
    } catch { /* ignore */ }
    setStep("signin");
    clearErrors();
  };

  const handleStart = (m: "signin" | "signup") => {
    onRecoveryComplete?.();
    try {
      sessionStorage.removeItem("supabase_auth_recovery_active");
    } catch { /* ignore */ }
    setStep(m === "signup" ? "signup" : "signin");
    resetFields();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current || loading) return;

    clearErrors();
    const errors: FieldErrors = {};

    const cleanName = sanitizeFullName(name);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      errors.name = "Full name is required.";
    } else if (cleanName.length < 2) {
      errors.name = "Full name must be at least 2 characters.";
    }

    if (!cleanEmail) {
      errors.email = "Email address is required.";
    } else if (!isValidStrictEmail(cleanEmail)) {
      errors.email = "Please enter a valid email address (e.g. you@example.com).";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    } else if (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      errors.password = "Password must include uppercase, number, and special character.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Confirm password is required.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (!agreeTerms) {
      errors.terms = "You must agree to the Terms of Service & Privacy Policy.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.name) nameRef.current?.focus();
      else if (errors.email) emailRef.current?.focus();
      else if (errors.password) passwordRef.current?.focus();
      else if (errors.confirmPassword) confirmPasswordRef.current?.focus();
      else if (errors.terms) termsRef.current?.focus();
      return;
    }

    inFlightRef.current = true;
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanName,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (signUpError) {
        const message = signUpError.message.toLowerCase();
        if (message.includes("already") || message.includes("registered")) {
          setError("An account with this email already exists. Please sign in instead.");
          setStep("signin");
          setEmail(cleanEmail);
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (data?.session) {
        setInfo("Account created successfully! Welcome to SEO Audit Pro.");
      } else {
        setInfo(
          `Account created! A confirmation email has been sent to ${cleanEmail}. Please check your inbox (and spam folder) and click the link to activate your account.`
        );
        setUnconfirmedEmail(cleanEmail);
        setStep("signin");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      console.error("Sign up error:", err);
      setError("An unexpected error occurred during registration. Please try again.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current || loading) return;

    clearErrors();
    onRecoveryComplete?.();
    try {
      sessionStorage.removeItem("supabase_auth_recovery_active");
    } catch { /* ignore */ }

    const errors: FieldErrors = {};

    const cleanInput = email.trim();
    const cleanEmail = normalizeAuthEmail(cleanInput);

    if (!cleanInput) {
      errors.email = "Email or username is required.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.email) emailRef.current?.focus();
      else if (errors.password) passwordRef.current?.focus();
      return;
    }

    inFlightRef.current = true;
    setLoading(true);

    try {
      // Remember me preference
      try {
        localStorage.setItem("seo_pro_remember_me", rememberMe ? "true" : "false");
      } catch { /* ignore */ }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (signInError) {
        const message = signInError.message.toLowerCase();
        if (message.includes("invalid") || message.includes("credentials")) {
          setError("Invalid email or password. Please verify your credentials or reset your password.");
        } else if (message.includes("not confirmed") || message.includes("unconfirmed")) {
          setUnconfirmedEmail(cleanEmail);
          setError("Your email address has not been confirmed yet. Please verify your email before signing in.");
        } else if (message.includes("rate limit") || message.includes("too many")) {
          setError("Too many login attempts. Please wait 1-2 minutes before trying again.");
        } else {
          setError(signInError.message);
        }
        return;
      }

      setInfo("Login successful! Redirecting to dashboard...");
    } catch (err) {
      console.error("Sign in error:", err);
      setError("Something went wrong. Please check your internet connection and try again.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const targetEmail = unconfirmedEmail || normalizeAuthEmail(email);
    if (!targetEmail || resendLoading || resendCooldown > 0) return;

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
    if (magicLoading) return;

    clearErrors();
    const cleanEmail = normalizeAuthEmail(email);

    if (!cleanEmail || !isValidStrictEmail(cleanEmail)) {
      setFieldErrors({ email: "Please enter a valid email address (e.g. you@example.com)." });
      emailRef.current?.focus();
      return;
    }

    setMagicLoading(true);

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
      setError("Failed to send magic link. Please check your connection and try again.");
    } finally {
      setMagicLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current || loading) return;

    clearErrors();
    const cleanInput = email.trim();
    const cleanEmail = normalizeAuthEmail(cleanInput);

    if (!cleanInput) {
      setFieldErrors({ email: "Email or username is required." });
      emailRef.current?.focus();
      return;
    }

    inFlightRef.current = true;
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;

      // Call our resilient edge function first which handles rate-limits gracefully
      let edgeResult: {
        success?: boolean;
        email_sent?: boolean;
        rate_limited?: boolean;
        action_link?: string;
        email_otp?: string;
        message?: string;
      } | null = null;

      try {
        edgeResult = await invokeEdgeFunction<{
          success?: boolean;
          email_sent?: boolean;
          rate_limited?: boolean;
          action_link?: string;
          email_otp?: string;
          message?: string;
        }>("password-reset", {
          body: { email: cleanEmail, redirectTo: redirectUrl },
        });
      } catch (edgeErr) {
        console.warn("password-reset edge function fallback:", edgeErr);
      }

      if (edgeResult?.success) {
        setEmail(cleanEmail);
        if (edgeResult.rate_limited && edgeResult.email_otp) {
          // Mail server rate limit detected, but we generated the OTP and reset link directly!
          setToken(edgeResult.email_otp);
          if (edgeResult.action_link) setDirectResetUrl(edgeResult.action_link);
          setIsManualCode(true);
          setStep("reset");
          setInfo(
            `Email dispatch was rate-limited by the mail server, but we generated your secure verification code (${edgeResult.email_otp}). You can set your new password below immediately.`
          );
          return;
        }

        setResendCooldown(15);
        setStep("forgot_sent");
        return;
      }

      // If edge function wasn't available, fall back to direct Supabase Auth
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        throw resetError;
      }

      setEmail(cleanEmail);
      setResendCooldown(15);
      setStep("forgot_sent");
    } catch (err) {
      console.error("Password reset error:", err);
      const message = err instanceof Error ? err.message : "";
      if (/rate limit|too many requests|\b429\b/i.test(message)) {
        setError(
          "Password reset emails are temporarily rate-limited by the mail server. You can enter your verification code below to reset immediately."
        );
        setResendCooldown(15);
      } else {
        setError(message || "Could not send password reset email. Please verify your address and try again.");
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current || resetLoading) return;

    clearErrors();
    const errors: FieldErrors = {};

    const cleanEmail = normalizeAuthEmail(email || activeSessionEmail || "");
    const trimmedToken = token.trim();

    if (isManualCode) {
      if (!cleanEmail) {
        errors.email = "Email address is required.";
      }
      if (!trimmedToken) {
        errors.token = "Verification code is required.";
      } else if (!/^\d{6,8}$/.test(trimmedToken)) {
        errors.token = "Verification code must be 6 to 8 digits.";
      }
    }

    if (!newPassword) {
      errors.password = "New password is required.";
    } else if (newPassword.length < 8) {
      errors.password = "New password must be at least 8 characters.";
    } else if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      errors.password = "Password must include uppercase, number, and special character.";
    }

    if (!resetConfirmPassword) {
      errors.confirmPassword = "Confirm password is required.";
    } else if (newPassword !== resetConfirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.email) emailRef.current?.focus();
      else if (errors.token) tokenRef.current?.focus();
      else if (errors.password) newPasswordRef.current?.focus();
      return;
    }

    inFlightRef.current = true;
    setResetLoading(true);

    try {
      // Manual verification code branch
      if (isManualCode && trimmedToken) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: trimmedToken,
          type: "recovery",
        });

        if (otpError) {
          setError(otpError.message || "Invalid or expired verification code. Please request a new one.");
          return;
        }
      }

      // Check active session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        setError(
          "No active reset session found. Please click the reset link in your email, or enter your 6 to 8 digit verification code."
        );
        setIsManualCode(true);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        setError(updateError.message || "Failed to update password. Your reset link may have expired.");
        return;
      }

      // Successfully updated password!
      // Do NOT sign out — the user has verified ownership and is already authenticated.
      // Clear recovery state so the application smoothly displays the active dashboard.
      try {
        sessionStorage.removeItem("supabase_auth_recovery_active");
      } catch { /* ignore */ }

      onRecoveryComplete?.();
      setInfo("Password updated successfully! Welcome back to SEO Audit Pro.");
    } catch (err: unknown) {
      console.error("Password update error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong updating password.");
    } finally {
      inFlightRef.current = false;
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
                <div className="flex gap-2.5 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-rose-700 text-xs leading-relaxed" role="alert">
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
            <form onSubmit={handleSignIn} noValidate className="space-y-4">
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

              {/* Field: Email or Username */}
              <div>
                <label htmlFor="signin-email" className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Email or Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={emailRef}
                    id="signin-email"
                    name="email"
                    type="text"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="you@example.com or username"
                    autoComplete="email"
                    maxLength={255}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "signin-email-error" : undefined}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${
                      fieldErrors.email
                        ? "border-rose-300 bg-rose-50/30 focus:ring-rose-500/20 text-rose-900"
                        : "border-slate-200 focus:ring-teal-500/20 text-slate-800"
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p id="signin-email-error" className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.email}</span>
                  </p>
                )}
              </div>

              {/* Field: Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="signin-password" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("forgot");
                      clearErrors();
                    }}
                    className="text-xs text-teal-600 hover:underline font-bold cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={passwordRef}
                    id="signin-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    maxLength={128}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? "signin-password-error" : undefined}
                    className={`w-full pl-11 pr-11 py-3 rounded-xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${
                      fieldErrors.password
                        ? "border-rose-300 bg-rose-50/30 focus:ring-rose-500/20 text-rose-900"
                        : "border-slate-200 focus:ring-teal-500/20 text-slate-800"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="signin-password-error" className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.password}</span>
                  </p>
                )}
              </div>

              {/* Remember Me Checkbox */}
              <div className="pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span>Remember me on this browser</span>
                </label>
              </div>

              {/* Consolidated Alert */}
              {error && (
                <div className="flex flex-col gap-2 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-rose-700 text-xs leading-relaxed" role="alert">
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
                <div className="flex gap-2.5 bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-emerald-800 text-xs leading-relaxed" role="status">
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

              {/* Magic Link */}
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
            <form onSubmit={handleSignUp} noValidate className="space-y-4">
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

              {/* Full Name */}
              <div>
                <label htmlFor="signup-name" className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={nameRef}
                    id="signup-name"
                    name="name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder="John Doe"
                    autoComplete="name"
                    maxLength={100}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? "signup-name-error" : undefined}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${
                      fieldErrors.name
                        ? "border-rose-300 bg-rose-50/30 focus:ring-rose-500/20 text-rose-900"
                        : "border-slate-200 focus:ring-teal-500/20 text-slate-800"
                    }`}
                  />
                </div>
                {fieldErrors.name && (
                  <p id="signup-name-error" className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.name}</span>
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label htmlFor="signup-email" className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={emailRef}
                    id="signup-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={255}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${
                      fieldErrors.email
                        ? "border-rose-300 bg-rose-50/30 focus:ring-rose-500/20 text-rose-900"
                        : "border-slate-200 focus:ring-teal-500/20 text-slate-800"
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p id="signup-email-error" className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.email}</span>
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="signup-password" className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={passwordRef}
                    id="signup-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    maxLength={128}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? "signup-password-error" : undefined}
                    className={`w-full pl-11 pr-11 py-3 rounded-xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${
                      fieldErrors.password
                        ? "border-rose-300 bg-rose-50/30 focus:ring-rose-500/20 text-rose-900"
                        : "border-slate-200 focus:ring-teal-500/20 text-slate-800"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="signup-password-error" className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.password}</span>
                  </p>
                )}

                {/* Password Strength Meter */}
                {password && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-500">Password Strength</span>
                      <span className={signupEval.color.split(" ")[1]}>{signupEval.label}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <div
                          key={lvl}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            signupEval.score >= lvl ? signupEval.color.split(" ")[0] : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Upfront Password Rules Checklist */}
                <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1 text-xs">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Password Requirements:
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <div className={`flex items-center gap-1.5 font-medium ${signupEval.rules.hasMinLength ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      {signupEval.rules.hasMinLength ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                      <span>8+ characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium ${signupEval.rules.hasUpper ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      {signupEval.rules.hasUpper ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                      <span>Uppercase (A-Z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium ${signupEval.rules.hasNumber ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      {signupEval.rules.hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                      <span>Number (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium ${signupEval.rules.hasSpecial ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      {signupEval.rules.hasSpecial ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                      <span>Special (!@#$%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="signup-confirm-password" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  {confirmPassword && (
                    <span className={`text-[11px] font-bold ${password === confirmPassword ? "text-emerald-600" : "text-rose-500"}`}>
                      {password === confirmPassword ? "✓ Passwords match" : "Passwords do not match"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={confirmPasswordRef}
                    id="signup-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    maxLength={128}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    aria-describedby={fieldErrors.confirmPassword ? "signup-confirm-password-error" : undefined}
                    className={`w-full pl-11 pr-11 py-3 rounded-xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${
                      fieldErrors.confirmPassword
                        ? "border-rose-300 bg-rose-50/30 focus:ring-rose-500/20 text-rose-900"
                        : "border-slate-200 focus:ring-teal-500/20 text-slate-800"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p id="signup-confirm-password-error" className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.confirmPassword}</span>
                  </p>
                )}
              </div>

              {/* Required Terms & Privacy Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-slate-600 font-medium">
                  <input
                    ref={termsRef}
                    id="signup-terms"
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => {
                      setAgreeTerms(e.target.checked);
                      if (fieldErrors.terms) setFieldErrors((prev) => ({ ...prev, terms: undefined }));
                    }}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span className="leading-relaxed">
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setModalTab("terms")}
                      className="text-teal-600 font-bold hover:underline cursor-pointer inline"
                    >
                      Terms of Service
                    </button>{" "}
                    and{" "}
                    <button
                      type="button"
                      onClick={() => setModalTab("privacy")}
                      className="text-teal-600 font-bold hover:underline cursor-pointer inline"
                    >
                      Privacy Policy
                    </button>
                    . <span className="text-rose-500">*</span>
                  </span>
                </label>
                {fieldErrors.terms && (
                  <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.terms}</span>
                  </p>
                )}
              </div>

              {/* Consolidated Alert */}
              {error && (
                <div className="flex gap-2.5 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-rose-700 text-xs leading-relaxed" role="alert">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div className="flex gap-2.5 bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-emerald-800 text-xs leading-relaxed" role="status">
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

          {/* STEP: FORGOT PASSWORD */}
          {step === "forgot" && (
            <form onSubmit={handleForgotPassword} noValidate className="space-y-4">
              <button
                type="button"
                onClick={handleBackToSignIn}
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
                <label htmlFor="forgot-email" className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={emailRef}
                    id="forgot-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={255}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "forgot-email-error" : undefined}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${
                      fieldErrors.email
                        ? "border-rose-300 bg-rose-50/30 focus:ring-rose-500/20 text-rose-900"
                        : "border-slate-200 focus:ring-teal-500/20 text-slate-800"
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p id="forgot-email-error" className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.email}</span>
                  </p>
                )}
              </div>

              {error && (
                <div className="flex gap-2.5 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-rose-700 text-xs leading-relaxed" role="alert">
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
                    clearErrors();
                  }}
                  className="text-xs text-slate-500 hover:text-teal-600 font-semibold underline cursor-pointer"
                >
                  Have a verification code? Enter code manually
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
                  Click the button in that email to set your new password. If you don't see it within a minute, check your spam or junk folder.
                </p>
              </div>

              {error && (
                <div className="flex gap-2.5 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-rose-700 text-xs text-left leading-relaxed" role="alert">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div className="flex gap-2.5 bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-emerald-800 text-xs text-left leading-relaxed" role="status">
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
                  onClick={handleBackToSignIn}
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
                    clearErrors();
                  }}
                  className="text-xs text-slate-500 hover:text-teal-600 font-semibold underline cursor-pointer"
                >
                  Have a verification code? Enter code manually
                </button>
              </div>
            </div>
          )}

          {/* STEP: RESET PASSWORD (SET NEW PASSWORD) */}
          {step === "reset" && (
            <form onSubmit={handleResetPassword} noValidate className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 mx-auto flex items-center justify-center text-teal-600 shadow-sm">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-slate-800 pt-1">
                  {isManualCode ? "Verify Code & Set Password" : "Set New Password"}
                </h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {isManualCode
                    ? "Enter your verification code and choose your new password."
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

              {directResetUrl && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl text-xs text-teal-800 flex items-center justify-between gap-2 shadow-xs animate-fade-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span className="truncate">One-click auto reset link is ready</span>
                  </div>
                  <a
                    href={directResetUrl}
                    className="font-bold text-teal-700 hover:text-teal-900 bg-white px-2.5 py-1 rounded-lg border border-teal-200 inline-flex items-center gap-1 flex-shrink-0 transition hover:shadow-xs"
                  >
                    Open Link <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* In manual code mode, show email and token fields */}
              {isManualCode && (
                <>
                  <div>
                    <label htmlFor="reset-email" className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        ref={emailRef}
                        id="reset-email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        placeholder="you@example.com"
                        autoComplete="email"
                        maxLength={255}
                        aria-required="true"
                        aria-invalid={Boolean(fieldErrors.email)}
                        className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${
                          fieldErrors.email
                            ? "border-rose-300 bg-rose-50/30 focus:ring-rose-500/20 text-rose-900"
                            : "border-slate-200 focus:ring-teal-500/20 text-slate-800"
                        }`}
                      />
                    </div>
                    {fieldErrors.email && (
                      <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1.5" role="alert">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.email}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="reset-token" className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Verification Code (6–8 Digits) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        ref={tokenRef}
                        id="reset-token"
                        name="token"
                        type="text"
                        value={token}
                        onChange={(e) => {
                          setToken(e.target.value);
                          if (fieldErrors.token) setFieldErrors((prev) => ({ ...prev, token: undefined }));
                        }}
                        placeholder="123456"
                        maxLength={8}
                        aria-required="true"
                        aria-invalid={Boolean(fieldErrors.token)}
                        className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 font-mono tracking-widest text-center ${
                          fieldErrors.token
                            ? "border-rose-300 bg-rose-50/30 focus:ring-rose-500/20 text-rose-900"
                            : "border-slate-200 focus:ring-teal-500/20 text-slate-800"
                        }`}
                      />
                    </div>
                    {fieldErrors.token && (
                      <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1.5" role="alert">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.token}</span>
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* New Password */}
              <div>
                <label htmlFor="reset-new-password" className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={newPasswordRef}
                    id="reset-new-password"
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder="Enter new strong password"
                    autoComplete="new-password"
                    maxLength={128}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.password)}
                    className={`w-full pl-11 pr-11 py-3 rounded-xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${
                      fieldErrors.password
                        ? "border-rose-300 bg-rose-50/30 focus:ring-rose-500/20 text-rose-900"
                        : "border-slate-200 focus:ring-teal-500/20 text-slate-800"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.password}</span>
                  </p>
                )}

                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-500">Password Strength</span>
                      <span className={resetEval.color.split(" ")[1]}>{resetEval.label}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <div
                          key={lvl}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            resetEval.score >= lvl ? resetEval.color.split(" ")[0] : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Password Rules Checklist */}
                <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1 text-xs">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Password Requirements:
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <div className={`flex items-center gap-1.5 font-medium ${resetEval.rules.hasMinLength ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      {resetEval.rules.hasMinLength ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                      <span>8+ characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium ${resetEval.rules.hasUpper ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      {resetEval.rules.hasUpper ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                      <span>Uppercase (A-Z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium ${resetEval.rules.hasNumber ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      {resetEval.rules.hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                      <span>Number (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium ${resetEval.rules.hasSpecial ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                      {resetEval.rules.hasSpecial ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                      <span>Special (!@#$%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="reset-confirm-password" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  {resetConfirmPassword && (
                    <span className={`text-[11px] font-bold ${newPassword === resetConfirmPassword ? "text-emerald-600" : "text-rose-500"}`}>
                      {newPassword === resetConfirmPassword ? "✓ Passwords match" : "Passwords do not match"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="reset-confirm-password"
                    name="resetConfirmPassword"
                    type={showResetConfirmPassword ? "text" : "password"}
                    value={resetConfirmPassword}
                    onChange={(e) => {
                      setResetConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    maxLength={128}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    className={`w-full pl-11 pr-11 py-3 rounded-xl border text-sm font-medium transition focus:outline-none focus:ring-2 ${
                      fieldErrors.confirmPassword
                        ? "border-rose-300 bg-rose-50/30 focus:ring-rose-500/20 text-rose-900"
                        : "border-slate-200 focus:ring-teal-500/20 text-slate-800"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                    aria-label={showResetConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showResetConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1.5" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.confirmPassword}</span>
                  </p>
                )}
              </div>

              {/* Consolidated Alert */}
              {error && (
                <div className="flex gap-2.5 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-rose-700 text-xs leading-relaxed" role="alert">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div className="flex gap-2.5 bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-emerald-800 text-xs leading-relaxed" role="status">
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
                  onClick={handleBackToSignIn}
                  className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsManualCode(!isManualCode);
                    clearErrors();
                  }}
                  className="text-teal-600 hover:underline font-bold cursor-pointer"
                >
                  {isManualCode ? "Reset via email link instead" : "Enter verification code"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* FOOTER */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Protected by SEO Audit Pro security & encryption standards.
        </p>
      </div>

      {/* TERMS & PRIVACY INTERACTIVE MODAL */}
      {modalTab && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setModalTab(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                {modalTab === "terms" ? (
                  <FileText className="w-5 h-5 text-teal-600" />
                ) : (
                  <Shield className="w-5 h-5 text-teal-600" />
                )}
                <h3 className="text-base font-bold text-slate-900">
                  {modalTab === "terms" ? "Terms of Service" : "Privacy Policy"}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-xl bg-slate-200/60 p-0.5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setModalTab("terms")}
                    className={`px-3 py-1 rounded-lg transition ${
                      modalTab === "terms" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Terms
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab("privacy")}
                    className={`px-3 py-1 rounded-lg transition ${
                      modalTab === "privacy" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Privacy
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setModalTab(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600 leading-relaxed font-normal">
              {modalTab === "terms" ? (
                <>
                  <h4 className="font-bold text-slate-900 text-sm">1. Acceptance of Terms</h4>
                  <p>
                    By accessing or using SEO Audit Pro ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to all terms and conditions, you may not access or use our services.
                  </p>
                  <h4 className="font-bold text-slate-900 text-sm">2. Authorized Auditing & Crawler Compliance</h4>
                  <p>
                    You represent and warrant that you have lawful permission to initiate technical scans, crawls, and SEO inspections on any URLs or domains you submit. You agree not to use the engine for denial-of-service, scraping copyrighted non-public material, or bypassing access controls.
                  </p>
                  <h4 className="font-bold text-slate-900 text-sm">3. Quotas & Fair Use</h4>
                  <p>
                    Usage of automated audit pipelines and API endpoints is subject to daily tier limits. Automated reverse engineering, abusive bot creation, or deliberate overloading of scanning workers will result in immediate suspension.
                  </p>
                  <h4 className="font-bold text-slate-900 text-sm">4. Limitation of Liability</h4>
                  <p>
                    SEO Audit Pro provides recommendations and automated diagnostics "as is" without warranty of any kind. We do not guarantee specific ranking positions or revenue outcomes resulting from SEO audit findings.
                  </p>
                </>
              ) : (
                <>
                  <h4 className="font-bold text-slate-900 text-sm">1. Information We Collect</h4>
                  <p>
                    We collect account information (name, email address), audit targets (requested URLs), scan results, and technical logs required to calculate SEO diagnostics, Core Web Vitals, and site hygiene scores.
                  </p>
                  <h4 className="font-bold text-slate-900 text-sm">2. How We Protect Your Data</h4>
                  <p>
                    All traffic is transmitted using TLS 1.3 encryption. Passwords and credentials are cryptographically hashed and never stored in plain text. We do not sell or lease your personal information or audit history to third parties.
                  </p>
                  <h4 className="font-bold text-slate-900 text-sm">3. Session & Storage</h4>
                  <p>
                    We utilize encrypted session tokens and local storage to preserve your authenticated dashboard session and audit history across device reboots. You can delete your audit records or account data at any time from your settings panel.
                  </p>
                  <h4 className="font-bold text-slate-900 text-sm">4. Data Deletion Rights</h4>
                  <p>
                    In accordance with global privacy regulations (GDPR, CCPA), you hold the right to export or permanently purge all personal information and audit history tied to your account.
                  </p>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setModalTab(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgreeTerms(true);
                  setModalTab(null);
                  if (fieldErrors.terms) setFieldErrors((prev) => ({ ...prev, terms: undefined }));
                }}
                className="px-5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>I Understand & Agree</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
