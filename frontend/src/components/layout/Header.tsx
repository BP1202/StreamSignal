import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Droplets,
  Menu,
  X,
  Inbox,
  Compass,
  Waves,
  Camera,
  Target,
  Sprout,
  Image as ImageIcon,
  User,
  Microscope,
  LogOut,
  LogIn,
} from "lucide-react";

export type CitizenTab = "home" | "observe" | "missions" | "impact";
export type ResearchTab = "inbox" | "gaps" | "media";

interface HeaderProps {
  mode?: "citizen" | "missions" | "research";
  citizenTab?: CitizenTab;
  researchTab?: ResearchTab;
  userRole?: "citizen" | "researcher" | null;
  citizenUsername?: string | null;
  onSwitchCitizenTab?: (tab: CitizenTab) => void;
  onSwitchResearchTab?: (tab: ResearchTab) => void;
  onSwitchMode?: (mode: "citizen" | "missions" | "research") => void;
  onOpenLoginModal?: () => void;
  onLogout?: () => void;
  onNewObservation?: () => void;
  showNewButton?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  mode = "citizen",
  citizenTab = "home",
  researchTab = "inbox",
  userRole = "citizen",
  citizenUsername = null,
  onSwitchCitizenTab,
  onSwitchResearchTab,
  onSwitchMode,
  onOpenLoginModal,
  onLogout,
}) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wasDrawerOpenRef = useRef(false);

  const isResearch = mode === "research";

  // Close drawer with Escape key and manage focus
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mobileDrawerOpen) {
          setMobileDrawerOpen(false);
        }
        return;
      }
      if (e.key === "Tab" && mobileDrawerOpen) {
        const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [mobileDrawerOpen]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Focus close button when drawer opens
  useEffect(() => {
    if (mobileDrawerOpen) {
      closeButtonRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      if (wasDrawerOpenRef.current) menuButtonRef.current?.focus();
    }
    wasDrawerOpenRef.current = mobileDrawerOpen;
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileDrawerOpen]);

  const handleCitizenNav = (tab: CitizenTab) => {
    if (onSwitchMode) onSwitchMode("citizen");
    if (onSwitchCitizenTab) onSwitchCitizenTab(tab);
    setMobileDrawerOpen(false);
  };

  const handleMissionsNav = () => {
    if (onSwitchMode) onSwitchMode("missions");
    if (onSwitchCitizenTab) onSwitchCitizenTab("missions");
    setMobileDrawerOpen(false);
  };

  const handleResearchNav = (tab: ResearchTab) => {
    if (onSwitchMode) onSwitchMode("research");
    if (onSwitchResearchTab) onSwitchResearchTab(tab);
    setMobileDrawerOpen(false);
  };

  return (
    <header className="bg-brand-surface border-b border-brand-border sticky top-0 z-30 shadow-2xs">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand & Catchment Identity */}
        <div
          className="flex items-center space-x-2 sm:space-x-3 cursor-pointer shrink-0"
          onClick={() => {
            if (isResearch) {
              handleResearchNav("inbox");
            } else {
              handleCitizenNav("home");
            }
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              if (isResearch) handleResearchNav("inbox");
              else handleCitizenNav("home");
            }
          }}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-brand-light flex items-center justify-center text-brand-teal shrink-0 shadow-2xs">
            <Droplets className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="font-bold text-base sm:text-lg text-brand-text tracking-tight">
                StreamSignal
              </span>
            </div>
          </div>
        </div>

        {/* Center: Surface-Specific Desktop Navigation */}
        <nav
          aria-label="Main Navigation"
          className="hidden lg:flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl border border-brand-border shadow-inner"
        >
          {isResearch ? (
            /* RESEARCHER NAVIGATION: Inbox, Citizen Media, Evidence Gaps */
            <>
              <button
                type="button"
                onClick={() => handleResearchNav("inbox")}
                aria-current={researchTab === "inbox" ? "page" : undefined}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  researchTab === "inbox"
                    ? "bg-white text-brand-dark shadow-xs border border-gray-200 font-bold"
                    : "text-brand-secondary hover:text-brand-text"
                }`}
              >
                <Inbox className="w-3.5 h-3.5 text-brand-teal" />
                <span>Inbox</span>
              </button>

              <button
                type="button"
                onClick={() => handleResearchNav("media")}
                aria-current={researchTab === "media" ? "page" : undefined}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  researchTab === "media"
                    ? "bg-white text-brand-dark shadow-xs border border-gray-200 font-bold"
                    : "text-brand-secondary hover:text-brand-text"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                <span>Citizen Media</span>
              </button>

              <button
                type="button"
                onClick={() => handleResearchNav("gaps")}
                aria-current={researchTab === "gaps" ? "page" : undefined}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  researchTab === "gaps"
                    ? "bg-white text-brand-dark shadow-xs border border-gray-200 font-bold"
                    : "text-brand-secondary hover:text-brand-text"
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-sky-500" />
                <span>Evidence Gaps</span>
              </button>
            </>
          ) : (
            /* CITIZEN NAVIGATION: WaterSignal, Observe, Missions, My Impact */
            <>
              <button
                type="button"
                onClick={() => handleCitizenNav("home")}
                aria-current={citizenTab === "home" && mode === "citizen" ? "page" : undefined}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  citizenTab === "home" && mode === "citizen"
                    ? "bg-white text-brand-text shadow-xs border border-gray-200 font-bold"
                    : "text-brand-secondary hover:text-brand-text"
                }`}
              >
                <Waves className="w-3.5 h-3.5 text-cyan-600" />
                <span>WaterSignal</span>
              </button>

              <button
                type="button"
                onClick={() => handleCitizenNav("observe")}
                aria-current={citizenTab === "observe" && mode === "citizen" ? "page" : undefined}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  citizenTab === "observe" && mode === "citizen"
                    ? "bg-white text-brand-text shadow-xs border border-gray-200 font-bold"
                    : "text-brand-secondary hover:text-brand-text"
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-teal-600" />
                <span>Observe</span>
              </button>

              <button
                type="button"
                onClick={handleMissionsNav}
                aria-current={mode === "missions" || citizenTab === "missions" ? "page" : undefined}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  mode === "missions" || citizenTab === "missions"
                    ? "bg-white text-brand-text shadow-xs border border-gray-200 font-bold"
                    : "text-brand-secondary hover:text-brand-text"
                }`}
              >
                <Target className="w-3.5 h-3.5 text-amber-600" />
                <span>Missions</span>
              </button>

              <button
                type="button"
                onClick={() => handleCitizenNav("impact")}
                aria-current={citizenTab === "impact" && mode === "citizen" ? "page" : undefined}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  citizenTab === "impact" && mode === "citizen"
                    ? "bg-white text-brand-text shadow-xs border border-gray-200 font-bold"
                    : "text-brand-secondary hover:text-brand-text"
                }`}
              >
                <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                <span>My Impact</span>
              </button>
            </>
          )}
        </nav>

        {/* Right: Account, Mode Switcher & Login/Logout Area */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Mode Switcher (Visible on desktop when onSwitchMode provided) */}
          {onSwitchMode && (
            <div className="hidden sm:flex items-center">
              {isResearch ? (
                <button
                  type="button"
                  onClick={() => onSwitchMode("citizen")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-brand-text border border-brand-border transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-teal-600" />
                  <span>Citizen Observe</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSwitchMode("research")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-brand-text border border-brand-border transition-colors"
                >
                  <Microscope className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Research Workspace</span>
                </button>
              )}
            </div>
          )}

          {/* User Profile Badge (Desktop) */}
          {userRole === "researcher" ? (
            <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-semibold">
              <Microscope className="w-3 h-3 text-indigo-600" />
              <span>Researcher</span>
            </div>
          ) : userRole === "citizen" && citizenUsername ? (
            <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold font-mono">
              <User className="w-3 h-3 text-teal-600" />
              <span>{citizenUsername}</span>
            </div>
          ) : null}

          {/* Login / Logout Controls */}
          {userRole ? (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-secondary hover:text-brand-text hover:bg-gray-100 border border-brand-border transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Log Out</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-teal hover:bg-cyan-600 transition-colors shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          )}

          {/* Mobile Menu Toggle Button (Accessible Hamburger) */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden p-2 rounded-lg text-brand-secondary hover:text-brand-text hover:bg-gray-100 transition-colors border border-brand-border shrink-0"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileDrawerOpen}
            aria-controls="mobile-navigation-drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer / Sheet */}
      {mobileDrawerOpen && (
        <div
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="fixed inset-0 z-50 lg:hidden flex justify-end"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Sliding Sheet Container */}
          <div
            ref={drawerRef}
            className="relative w-full max-w-[290px] sm:max-w-xs bg-brand-surface h-full shadow-2xl z-10 flex flex-col justify-between p-5 overflow-y-auto animate-in slide-in-from-right duration-200"
          >
            {/* Top Sheet Header */}
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-brand-border">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-light flex items-center justify-center text-brand-teal shrink-0">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-base text-brand-text">StreamSignal</span>
                    <p className="text-[10px] text-brand-secondary">
                      {isResearch ? "Research Workspace" : "Community Observations"}
                    </p>
                  </div>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors focus:ring-2 focus:ring-brand-teal"
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Surface Navigation Links */}
              <nav aria-label="Mobile Navigation" className="mt-5 space-y-1.5">
                {isResearch ? (
                  /* RESEARCHER MOBILE NAV: Inbox, Citizen Media, Evidence Gaps */
                  <>
                    <button
                      type="button"
                      onClick={() => handleResearchNav("inbox")}
                      aria-current={researchTab === "inbox" ? "page" : undefined}
                      className={`w-full text-left text-sm font-semibold p-3 rounded-xl transition-all flex items-center gap-3 ${
                        researchTab === "inbox"
                          ? "bg-brand-light text-brand-dark border-l-4 border-brand-teal font-bold shadow-xs"
                          : "text-brand-secondary hover:bg-gray-50 hover:text-brand-text"
                      }`}
                    >
                      <Inbox className="w-4 h-4 text-brand-teal" />
                      <span>Inbox</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResearchNav("media")}
                      aria-current={researchTab === "media" ? "page" : undefined}
                      className={`w-full text-left text-sm font-semibold p-3 rounded-xl transition-all flex items-center gap-3 ${
                        researchTab === "media"
                          ? "bg-brand-light text-brand-dark border-l-4 border-brand-teal font-bold shadow-xs"
                          : "text-brand-secondary hover:bg-gray-50 hover:text-brand-text"
                      }`}
                    >
                      <ImageIcon className="w-4 h-4 text-teal-600" />
                      <span>Citizen Media</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResearchNav("gaps")}
                      aria-current={researchTab === "gaps" ? "page" : undefined}
                      className={`w-full text-left text-sm font-semibold p-3 rounded-xl transition-all flex items-center gap-3 ${
                        researchTab === "gaps"
                          ? "bg-brand-light text-brand-dark border-l-4 border-brand-teal font-bold shadow-xs"
                          : "text-brand-secondary hover:bg-gray-50 hover:text-brand-text"
                      }`}
                    >
                      <Compass className="w-4 h-4 text-sky-500" />
                      <span>Evidence Gaps</span>
                    </button>
                  </>
                ) : (
                  /* CITIZEN MOBILE NAV: WaterSignal, Observe, Missions, My Impact */
                  <>
                    <button
                      type="button"
                      onClick={() => handleCitizenNav("home")}
                      aria-current={citizenTab === "home" && mode === "citizen" ? "page" : undefined}
                      className={`w-full text-left text-sm font-semibold p-3 rounded-xl transition-all flex items-center gap-3 ${
                        citizenTab === "home" && mode === "citizen"
                          ? "bg-brand-light text-brand-dark border-l-4 border-brand-teal font-bold shadow-xs"
                          : "text-brand-secondary hover:bg-gray-50 hover:text-brand-text"
                      }`}
                    >
                      <Waves className="w-4 h-4 text-teal-600" />
                      <span>WaterSignal</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleCitizenNav("observe");
                      }}
                      aria-current={citizenTab === "observe" && mode === "citizen" ? "page" : undefined}
                      className={`w-full text-left text-sm font-semibold p-3 rounded-xl transition-all flex items-center gap-3 ${
                        citizenTab === "observe" && mode === "citizen"
                          ? "bg-brand-light text-brand-dark border-l-4 border-brand-teal font-bold shadow-xs"
                          : "text-brand-secondary hover:bg-gray-50 hover:text-brand-text"
                      }`}
                    >
                      <Camera className="w-4 h-4 text-teal-600" />
                      <span>Observe</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleMissionsNav}
                      aria-current={mode === "missions" || citizenTab === "missions" ? "page" : undefined}
                      className={`w-full text-left text-sm font-semibold p-3 rounded-xl transition-all flex items-center gap-3 ${
                        mode === "missions" || citizenTab === "missions"
                          ? "bg-brand-light text-brand-dark border-l-4 border-brand-teal font-bold shadow-xs"
                          : "text-brand-secondary hover:bg-gray-50 hover:text-brand-text"
                      }`}
                    >
                      <Target className="w-4 h-4 text-amber-600" />
                      <span>Missions</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCitizenNav("impact")}
                      aria-current={citizenTab === "impact" && mode === "citizen" ? "page" : undefined}
                      className={`w-full text-left text-sm font-semibold p-3 rounded-xl transition-all flex items-center gap-3 ${
                        citizenTab === "impact" && mode === "citizen"
                          ? "bg-brand-light text-brand-dark border-l-4 border-brand-teal font-bold shadow-xs"
                          : "text-brand-secondary hover:bg-gray-50 hover:text-brand-text"
                      }`}
                    >
                      <Sprout className="w-4 h-4 text-emerald-600" />
                      <span>My Impact</span>
                    </button>
                  </>
                )}
              </nav>
            </div>

            {/* Bottom Drawer: Identity, Mode Switch & Log out */}
            <div className="pt-4 border-t border-brand-border space-y-3">
              {/* User Identity Chip */}
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-brand-text">
                  {userRole === "researcher"
                    ? "Researcher Profile"
                    : citizenUsername
                    ? `Citizen (${citizenUsername})`
                    : "Citizen Profile"}
                </span>
                {userRole && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      if (onLogout) onLogout();
                    }}
                    className="text-[11px] font-bold text-red-600 hover:underline"
                  >
                    Log Out
                  </button>
                )}
              </div>

              {onSwitchMode && (
                <div>
                  {isResearch ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSwitchMode("citizen");
                        setMobileDrawerOpen(false);
                      }}
                      className="w-full text-xs font-semibold p-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-brand-text border border-brand-border transition-colors flex items-center justify-center gap-2"
                    >
                      <User className="w-4 h-4 text-brand-teal" />
                      <span>Citizen Observe</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onSwitchMode("research");
                        setMobileDrawerOpen(false);
                      }}
                      className="w-full text-xs font-semibold p-2.5 rounded-lg bg-brand-dark hover:bg-slate-800 text-white border border-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Microscope className="w-4 h-4 text-cyan-400" />
                      <span>Research Workspace</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
