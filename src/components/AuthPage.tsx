import { useState, useEffect } from "react";
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
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuthStep = "choose" | "signup" | "signin" | "forgot" | "reset";

interface AuthPageProps {
  onGuestLogin: () => void;
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AuthPage({ onGuestLogin }: AuthPageProps) {
  const [step, setStep] = useState<AuthStep>("choose");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("type=reset")) {
      setStep("reset");
      setError(null);
      setInfo(null);
    }
  }, []);

  const resetFields = () => {
    setEmail("");
    setName("");
    setPassword("");
    setShowPassword(false);
  };

  const handleStart = (m: "signin" | "signup") => {
    setStep(m === "signup" ? "signup" : "signin");
    setError(null);
    setInfo(null);
    resetFields();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Email is required.");
      return;
    }
    if (!isEmailAddress(cleanEmail)) {
      setError("Use your email address here, not your account ID.");
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
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

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Email is required.");
      return;
    }
    if (!isEmailAddress(cleanEmail)) {
      setError("Use your email address here, not your account ID.");
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
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Email is required for magic link.");
      return;
    }
    if (!isEmailAddress(cleanEmail)) {
      setError("Use your email address here, not your account ID.");
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

      setInfo("Magic link sent! Check your email and click the link to sign in. The link works in the same tab you open it from.");
    } catch (err) {
      console.error("Magic link error:", err);
      setError("Something went wrong. Please try again.");
    }

    setMagicLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Email is required.");
      return;
    }
    if (!isEmailAddress(cleanEmail)) {
      setError("Use your email address here, not your account ID.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not send reset email. Please try again.");
      }

      setInfo("Password reset link sent. Check your email and click the link to set a new password.");
      setStep("signin");
      setPassword("");
    } catch (err) {
      console.error("Password reset error:", err);
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setResetLoading(true);
    setError(null);
    setInfo(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        setError(updateError.message);
        setResetLoading(false);
        return;
      }

      setInfo("Password updated successfully! You can now sign in with your new password.");
      setStep("signin");
      setNewPassword("");
      setPassword("");
      window.history.replaceState(null, "", window.location.pathname);
    } catch (err) {
      console.error("Password update error:", err);
      setError("Something went wrong. Please try again.");
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
            <h1 className="text-xl font-bold text-slate-800">SEO Audit Dashboard</h1>
            <p className="text-xs text-slate-400">On-page, off-page & technical SEO analysis</p>
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
                Continue as Guest
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
                <p className="mt-1.5 text-xs text-slate-400">Use your email address, not the account ID.</p>
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

              <button
                type="button"
                onClick={() => { setStep("forgot"); setError(null); setInfo(null); }}
                className="text-sm text-teal-600 hover:underline font-medium"
              >
                Forgot password?
              </button>

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

          {/* FORGOT PASSWORD */}
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
                Enter your email and we'll send you a link to set a new password.
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
                Send Reset Link
              </button>
            </form>
          )}

          {/* RESET PASSWORD */}
          {step === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                  <KeyRound className="w-6 h-6 text-teal-600" />
                </div>
              </div>

              <h2 className="text-lg font-semibold text-center text-slate-800">Set New Password</h2>

              <p className="text-sm text-slate-500 text-center">
                Enter your new password below. Make it at least 6 characters.
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                disabled={resetLoading}
                className="w-full rounded-xl bg-teal-600 text-white py-3.5 font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resetLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                Update Password
              </button>
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
