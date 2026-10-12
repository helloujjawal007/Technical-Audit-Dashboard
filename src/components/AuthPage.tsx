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
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuthStep = "choose" | "signup" | "signin" | "forgot" | "reset";

interface AuthPageProps {
  onGuestLogin: () => void;
  isRecoveryMode?: boolean;
  onRecoveryComplete?: () => void;
}

function normalizeAuthEmail(val: string): string {
  const trimmed = val.trim().toLowerCase();
  if (!trimmed) return "";
  if (!trimmed.includes("@")) {
    if (trimmed === "ujjawalkumar5651") {
      return "ujjawalkumar5651@gmail.com";
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

export function AuthPage({ onGuestLogin, isRecoveryMode = false, onRecoveryComplete }: AuthPageProps) {
  const [step, setStep] = useState<AuthStep>(isRecoveryMode ? "reset" : "choose");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Recovery fields
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const resetRequestInFlight = useRef(false);

  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (isRecoveryMode) {
      setStep("reset");
      setError(null);
      setInfo(null);
      return;
    }
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("type=reset")) {
      setStep("reset");
      setError(null);
      setInfo(null);
    }
  }, [isRecoveryMode]);

  const resetFields = () => {
    setEmail("");
    setName("");
    setPassword("");
    setToken("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowNewPassword(false);
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
      const { error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: name.trim(),
          },
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

      setInfo("Account created successfully! You can now sign in with your email and password.");
      setStep("signin");
      setPassword("");
    } catch (err) {
      console.error("Sign up error:", err);
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
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

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (signInError) {
        const message = signInError.message.toLowerCase();
        if (message.includes("invalid") || message.includes("credentials")) {
          setError("Invalid email or password. Please try again.");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      setInfo("Login successful. Redirecting to dashboard...");
    } catch (err) {
      console.error("Sign in error:", err);
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = normalizeAuthEmail(email);

    if (!cleanEmail) {
      setError("Email is required for magic link.");
      return;
    }
    if (!cleanEmail.includes("@")) {
      setError("Please provide a full email address for magic link.");
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
        setMagicLoading(false);
        return;
      }

      setInfo("Magic link sent! Check your email and click the link to sign in.");
    } catch (err) {
      console.error("Magic link error:", err);
      setError("Something went wrong. Please try again.");
    }

    setMagicLoading(false);
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
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/#type=recovery`,
      });

      if (resetError) {
        throw resetError;
      }

      setToken("");
      setInfo(`If an account exists for ${cleanEmail}, a password reset email has been sent. Check your inbox and spam folder.`);
      setStep("reset");
    } catch (err) {
      console.error("Password reset error:", err);
      const message = err instanceof Error ? err.message : "";
      setError(
        /rate limit|too many requests|\b429\b/i.test(message)
          ? "Password reset emails are temporarily rate-limited. Please wait before trying again. For reliable delivery, configure custom SMTP in your Supabase Auth settings."
          : "Could not send the password reset email. Please check the address and try again."
      );
    } finally {
      resetRequestInFlight.current = false;
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = normalizeAuthEmail(email);

    if (!cleanEmail) {
      setError("Email is required.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setResetLoading(true);
    setError(null);
    setInfo(null);

    try {
      const trimmedToken = token.trim();

      // If user entered a verification token/code
      if (trimmedToken) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: trimmedToken,
          type: "recovery",
        });

        if (otpError) {
          setError(otpError.message || "Invalid or expired verification code.");
          setResetLoading(false);
          return;
        }
      }

      // Update password for authenticated recovery session
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        setError(updateError.message || "Please enter the verification code sent to your email.");
        setResetLoading(false);
        return;
      }

      setInfo("Password updated successfully! You can now sign in with your new password.");
      setStep("signin");
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setToken("");
      onRecoveryComplete?.();
      window.history.replaceState(null, "", window.location.pathname);
    } catch (err: unknown) {
      console.error("Password update error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }

    setResetLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* LOGO */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center shadow-md">
            <ScanSearch className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">SEO Audit Pro</h1>
            <p className="text-xs text-slate-400">Technical & On-Page SEO Dashboard</p>
          </div>
        </div>

        {/* MAIN CARD */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          {/* CHOOSE */}
          {step === "choose" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800 text-center">Welcome</h2>
              <p className="text-sm text-slate-400 text-center">
                Sign in to your account or create a new one to start auditing.
              </p>
              <button
                onClick={() => handleStart("signin")}
                className="w-full rounded-xl bg-teal-600 text-white py-3.5 font-medium hover:bg-teal-700 transition flex items-center justify-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                Sign In
              </button>
              <button
                onClick={() => handleStart("signup")}
                className="w-full rounded-xl border border-slate-200 py-3.5 font-medium text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Create New Account
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Guest login */}
              <button
                onClick={onGuestLogin}
                className="w-full rounded-xl border-2 border-teal-200 bg-teal-50 py-3.5 font-medium text-teal-700 hover:bg-teal-100 transition flex items-center justify-center gap-2"
              >
                <Ghost className="w-5 h-5" />
                Continue as Guest (5 Audits/day)
              </button>
            </div>
          )}

          {/* SIGN UP */}
          {step === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <h2 className="text-lg font-semibold text-slate-800">Create Your Account</h2>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Email or Username</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com or username"
                    autoComplete="email"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    className="w-full pl-12 pr-12 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex gap-2 bg-red-50 p-3 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div className="flex gap-2 bg-green-50 p-3 rounded-lg text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{info}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-teal-600 text-white py-3.5 font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                Create Account
              </button>

              <p className="text-center text-sm text-slate-500">
                Already have an account?{" "}
                <button type="button" onClick={() => handleStart("signin")} className="text-teal-600 font-medium">
                  Sign In
                </button>
              </p>
            </form>
          )}

          {/* SIGN IN */}
          {step === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <h2 className="text-lg font-semibold text-slate-800">Sign In</h2>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Email or Username</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com or username"
                    autoComplete="email"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-400">Enter your email address or account username (e.g. ujjawalkumar5651).</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                    className="w-full pl-12 pr-12 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setStep("forgot"); setError(null); setInfo(null); }}
                  className="text-sm text-teal-600 hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className="flex gap-2 bg-red-50 p-3 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div className="flex gap-2 bg-green-50 p-3 rounded-lg text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{info}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-teal-600 text-white py-3.5 font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                Sign In
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">or sign in with</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Magic link button */}
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={magicLoading || !email.trim()}
                className="w-full rounded-xl border border-slate-200 py-3.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {magicLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5 text-teal-600" />}
                Send Magic Link
              </button>

              <p className="text-center text-sm text-slate-500">
                Don't have an account?{" "}
                <button type="button" onClick={() => handleStart("signup")} className="text-teal-600 font-medium">
                  Sign Up
                </button>
              </p>
            </form>
          )}

          {/* FORGOT PASSWORD - STEP 1: REQUEST CODE / LINK */}
          {step === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <button
                type="button"
                onClick={() => { setStep("signin"); setError(null); setInfo(null); }}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </button>

              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                  <KeyRound className="w-6 h-6 text-teal-600" />
                </div>
              </div>

              <h2 className="text-lg font-semibold text-center text-slate-800">Forgot Password</h2>

              <p className="text-sm text-slate-500 text-center">
                Enter your email address or username. We will send a recovery code or password reset link to your email.
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Email or Username</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com or username"
                    autoComplete="email"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              {error && (
                <div className="flex gap-2 bg-red-50 p-3 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div className="flex gap-2 bg-green-50 p-3 rounded-lg text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{info}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-teal-600 text-white py-3.5 font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                Send Reset Email
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setStep("reset"); setError(null); setInfo(null); }}
                  className="text-xs text-slate-500 hover:text-teal-600 underline"
                >
                  Already have a verification code? Enter it here
                </button>
              </div>
            </form>
          )}

          {/* RESET PASSWORD - STEP 2: VERIFY TOKEN & SET NEW PASSWORD */}
          {step === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-teal-600" />
                </div>
              </div>

              <h2 className="text-lg font-semibold text-center text-slate-800">Set New Password</h2>

              <p className="text-sm text-slate-500 text-center">
                Enter the verification token sent to your email (or set your new password directly if you clicked the email link).
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Verification Code / Token</label>
                  <span className="text-[11px] text-slate-400">Optional if opened via email link</span>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="6-digit code (e.g. 123456)"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    className="w-full pl-12 pr-12 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              {error && (
                <div className="flex gap-2 bg-red-50 p-3 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div className="flex gap-2 bg-green-50 p-3 rounded-lg text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{info}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full rounded-xl bg-teal-600 text-white py-3.5 font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resetLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                Update Password
              </button>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => { setStep("signin"); setError(null); setInfo(null); }}
                  className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Resend Code
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
