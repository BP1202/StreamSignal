import React, { useState } from "react";
import {
  Droplets,
  Microscope,
  User,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { citizenAccess } from "../../api/missions";

interface LandingAuthModalProps {
  isOpen: boolean;
  onCitizenEnter: (username: string, contributorId?: string) => void;
  onResearcherEnter: (reviewerId?: string) => void;
  isAuth0Configured: boolean;
  onAuth0SignIn: () => Promise<void>;
  onClose?: () => void;
}

export const LandingAuthModal: React.FC<LandingAuthModalProps> = ({
  isOpen,
  onCitizenEnter,
  onResearcherEnter,
  isAuth0Configured,
  onAuth0SignIn,
  onClose,
}) => {
  const [role, setRole] = useState<"citizen" | "researcher">("citizen");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [researcherEmail, setResearcherEmail] = useState("");
  const [researcherPassword, setResearcherPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Standard citizen login with entered username
  const handleCitizenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Please enter your username (e.g. aqua-001).");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const profile = await citizenAccess(trimmed);
      onCitizenEnter(profile.display_name, profile.contributor_id);
    } catch {
      // Fallback unique session handle if backend is unreachable
      onCitizenEnter(trimmed, `SS-C-${Math.floor(Math.random() * 8999) + 1000}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Instant guest access: automatically generate unique handle like aqua-001 without password
  const handleQuickGuestAccess = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const profile = await citizenAccess();
      onCitizenEnter(profile.display_name, profile.contributor_id);
    } catch {
      const fallbackNum = Math.floor(Math.random() * 900) + 100;
      const fallbackName = `aqua-${fallbackNum}`;
      onCitizenEnter(fallbackName, `SS-C-${fallbackNum}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Researcher sign-in (email/password or SSO)
  const handleResearcherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const email = researcherEmail.trim();
    const reviewerId = email || "REV-RESEARCHER-001";
    localStorage.setItem("streamsignal_reviewer_id", reviewerId);
    if (email) {
      localStorage.setItem("streamsignal_researcher_email", email);
    }
    try {
      if (isAuth0Configured) {
        await onAuth0SignIn();
      } else {
        onResearcherEnter(reviewerId);
      }
    } catch {
      setError("Failed to sign in. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSSOClick = async () => {
    setIsSubmitting(true);
    setError(null);
    const reviewerId = "REV-SSO-USER";
    localStorage.setItem("streamsignal_reviewer_id", reviewerId);
    try {
      if (isAuth0Configured) {
        await onAuth0SignIn();
      } else {
        onResearcherEnter(reviewerId);
      }
    } catch {
      setError("Failed to initiate Single Sign-On.");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white border border-brand-border shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Optional Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-brand-secondary hover:text-brand-text hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-brand-teal mx-auto shadow-2xs">
            <Droplets className="w-6 h-6" />
          </div>
          <h2 id="auth-modal-title" className="text-xl font-bold text-brand-text tracking-tight">
            Sign in to StreamSignal
          </h2>
          <p className="text-xs text-brand-secondary">
            Select your account type to access the platform
          </p>
        </div>

        {/* Role Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setRole("citizen");
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              role === "citizen"
                ? "bg-white text-brand-text shadow-xs"
                : "text-brand-secondary hover:text-brand-text"
            }`}
          >
            <User className="w-3.5 h-3.5 text-teal-600" />
            <span>Citizen</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRole("researcher");
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              role === "researcher"
                ? "bg-white text-brand-text shadow-xs"
                : "text-brand-secondary hover:text-brand-text"
            }`}
          >
            <Microscope className="w-3.5 h-3.5 text-indigo-600" />
            <span>Researcher</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 text-left">
            {error}
          </div>
        )}

        {/* CITIZEN LOGIN FORM */}
        {role === "citizen" && (
          <form onSubmit={handleCitizenLogin} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label htmlFor="citizen-username" className="block text-xs font-semibold text-brand-text">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-secondary">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="citizen-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. aqua-001"
                  maxLength={32}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-brand-border bg-gray-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal text-brand-text font-mono transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="citizen-password" className="block text-xs font-semibold text-brand-text">
                  Password
                </label>
                <span className="text-[10px] text-brand-secondary font-medium">Optional for citizens</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-secondary">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="citizen-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-brand-border bg-gray-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal text-brand-text transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-brand-teal hover:bg-cyan-600 text-white shadow-xs transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>

            {/* Regular Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-brand-border" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-white px-2 text-brand-secondary">or</span>
              </div>
            </div>

            {/* Instant Guest / Anonymous Access Button */}
            <button
              type="button"
              onClick={handleQuickGuestAccess}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-brand-text border border-brand-border transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Continue without password (guest aqua-xxx)</span>
            </button>
          </form>
        )}

        {/* RESEARCHER LOGIN FORM */}
        {role === "researcher" && (
          <form onSubmit={handleResearcherLogin} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label htmlFor="researcher-email" className="block text-xs font-semibold text-brand-text">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-secondary">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="researcher-email"
                  type="email"
                  value={researcherEmail}
                  onChange={(e) => setResearcherEmail(e.target.value)}
                  placeholder="name@organization.org"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-brand-border bg-gray-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal text-brand-text transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="researcher-password" className="block text-xs font-semibold text-brand-text">
                  Password
                </label>
                <a href="#forgot" onClick={(e) => e.preventDefault()} className="text-[11px] text-brand-teal hover:underline font-medium">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-secondary">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="researcher-password"
                  type="password"
                  value={researcherPassword}
                  onChange={(e) => setResearcherPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-brand-border bg-gray-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal text-brand-text transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Sign In as Researcher</span>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-brand-border" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-white px-2 text-brand-secondary">or</span>
              </div>
            </div>

            {/* Single Sign-On (SSO) Button */}
            <button
              type="button"
              onClick={handleSSOClick}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-brand-text border border-brand-border transition-colors disabled:opacity-50"
            >
              <Microscope className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isAuth0Configured ? "Sign in with Single Sign-On (SSO)" : "Enter Researcher Workspace (SSO)"}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-auto text-brand-secondary" />
            </button>
          </form>
        )}

        {/* Regular Footer */}
        <div className="pt-2 text-center text-[11px] text-brand-secondary border-t border-gray-100">
          <span>By continuing, you agree to StreamSignal's Terms & Privacy Policy</span>
        </div>
      </div>
    </div>
  );
};
