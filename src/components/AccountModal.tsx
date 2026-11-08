import { useState, useRef, useEffect } from "react";
import {
  X,
  User as UserIcon,
  Mail,
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  Sparkles,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  userName: string;
  userEmail?: string | null;
  isAdmin: boolean;
  tier?: string;
  initialPromptSetPassword?: boolean;
  onPasswordUpdated?: () => void;
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

export function AccountModal({
  isOpen,
  onClose,
  userName,
  userEmail,
  isAdmin,
  tier = "free",
  initialPromptSetPassword = false,
  onPasswordUpdated,
}: AccountModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const newPasswordRef = useRef<HTMLInputElement>(null);
  const passwordEval = evaluatePassword(newPassword);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      if (initialPromptSetPassword) {
        setTimeout(() => newPasswordRef.current?.focus(), 150);
      }
    }
  }, [isOpen, initialPromptSetPassword]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newPassword) {
      setError("Please enter a new password.");
      newPasswordRef.current?.focus();
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      newPasswordRef.current?.focus();
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setError("Password must include uppercase, lowercase, number, and special character.");
      newPasswordRef.current?.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please verify both fields.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message || "Failed to update password. Please try again.");
        return;
      }

      setSuccess("Password successfully updated and saved in our database! You can now log in anytime with your email and password.");
      setNewPassword("");
      setConfirmPassword("");
      onPasswordUpdated?.();
    } catch (err) {
      console.error("Update password error:", err);
      setError("An unexpected error occurred while updating password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-xs">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Account & Security</h3>
              <p className="text-xs text-slate-500">Manage credentials and login password</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600">
          {/* Magic Link Notice (if opened from magic link) */}
          {initialPromptSetPassword && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/80 text-teal-900 space-y-1 shadow-xs animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-teal-800 text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>You Logged In via Magic Link!</span>
              </div>
              <p className="text-xs text-teal-700 leading-relaxed">
                Set a permanent account password below so you can sign in directly with your email and password in the future without waiting for email links.
              </p>
            </div>
          )}

          {/* User Profile Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center text-base font-extrabold shadow-sm">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">{userName}</h4>
                  <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{userEmail || "No email available"}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-800 border border-amber-300/70 shadow-xs">
                    <ShieldCheck className="w-3 h-3 text-amber-600" />
                    <span>Super Admin</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                    Standard User
                  </span>
                )}
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Tier: <strong className="text-teal-700 font-bold">{tier}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Update Password Form */}
          <form onSubmit={handleUpdatePassword} className="space-y-4 pt-1">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <KeyRound className="w-4 h-4 text-teal-600" />
              <h4 className="font-extrabold text-slate-800 text-sm">Set / Update Account Password</h4>
            </div>

            <p className="text-slate-500 text-xs leading-relaxed">
              Updating your password will save it to our database. You will be able to log in immediately using this password on any device.
            </p>

            {/* Success Alert */}
            {success && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5 shadow-xs animate-fade-in" role="status">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span className="font-medium text-xs leading-relaxed">{success}</span>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 shadow-xs animate-fade-in" role="alert">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <span className="font-medium text-xs leading-relaxed">{error}</span>
              </div>
            )}

            {/* New Password Input */}
            <div>
              <label htmlFor="account-new-password" className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  ref={newPasswordRef}
                  id="account-new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter strong new password"
                  autoComplete="new-password"
                  maxLength={128}
                  className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800"
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

              {/* Password Strength Meter */}
              {newPassword && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-500">Password Strength</span>
                    <span className={passwordEval.color.split(" ")[1]}>{passwordEval.label}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          passwordEval.score >= lvl ? passwordEval.color.split(" ")[0] : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements Checklist */}
              <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1 text-xs">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Password Requirements:
                </p>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <div className={`flex items-center gap-1.5 font-medium ${passwordEval.rules.hasMinLength ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                    {passwordEval.rules.hasMinLength ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                    <span>8+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 font-medium ${passwordEval.rules.hasUpper ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                    {passwordEval.rules.hasUpper ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                    <span>Uppercase (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 font-medium ${passwordEval.rules.hasLower ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                    {passwordEval.rules.hasLower ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                    <span>Lowercase (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 font-medium ${passwordEval.rules.hasNumber ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                    {passwordEval.rules.hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                    <span>Number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 font-medium col-span-2 ${passwordEval.rules.hasSpecial ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                    {passwordEval.rules.hasSpecial ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1" />}
                    <span>Special character (!@#$%^&*)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="account-confirm-password" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                {confirmPassword && (
                  <span className={`text-[11px] font-bold ${newPassword === confirmPassword ? "text-emerald-600" : "text-rose-500"}`}>
                    {newPassword === confirmPassword ? "✓ Passwords match" : "Passwords do not match"}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="account-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                  maxLength={128}
                  className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !newPassword || newPassword !== confirmPassword}
                className="w-full rounded-2xl bg-teal-600 text-white py-3 font-bold text-xs hover:bg-teal-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Save Password to Database</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Encrypted with Supabase Auth bcrypt standards
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
