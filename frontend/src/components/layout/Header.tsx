import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Droplets,
  Microscope,
  Menu,
  X,
  User,
  Inbox,
  FolderGit2,
  Compass,
  Network,
  Waves,
  Camera,
  Target,
  Sprout,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

export type CitizenTab = "home" | "observe" | "missions" | "impact";
export type ResearchTab = "inbox" | "cases" | "gaps" | "interop";

interface HeaderProps {
  onNewObservation?: () => void;
  showNewButton?: boolean;
  mode?: "citizen" | "missions" | "research";
  citizenTab?: CitizenTab;
  researchTab?: ResearchTab;
  onSwitchCitizenTab?: (tab: CitizenTab) => void;
  onSwitchResearchTab?: (tab: ResearchTab) => void;
  onSwitchMode?: (mode: "citizen" | "missions" | "research") => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNewObservation,
  showNewButton,
  mode = "citizen",
  citizenTab = "home",
  researchTab = "inbox",
  onSwitchCitizenTab,
  onSwitchResearchTab,
  onSwitchMode,
}) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);

  const isResearch = mode === "research";

  // Close drawer with Escape key and manage focus
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mobileDrawerOpen) {
          setMobileDrawerOpen(false);
        }
        if (accountMenuOpen) {
          setAccountMenuOpen(false);
        }
      }
    },
    [mobileDrawerOpen, accountMenuOpen]
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
    }
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

  const handleModeToggle = (targetMode: "citizen" | "research") => {
    if (onSwitchMode) onSwitchMode(targetMode);
    if (targetMode === "citizen" && onSwitchCitizenTab) onSwitchCitizenTab("home");
    setAccountMenuOpen(false);
    setMobileDrawerOpen(false);
  };

  return (
    <header className="bg-brand-surface border-b border-brand-border sticky top-0 z-30 shadow-2xs">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
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
              <span
                className={`text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full hidden sm:inline-block ${
                  isResearch
                    ? "bg-slate-900 text-cyan-300 border border-slate-700 font-mono"
                    : "bg-teal-50 text-brand-teal border border-teal-200"
                }`}
              >
                {isResearch ? "Research" : "One Health"}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Surface-Specific Desktop Navigation */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl border border-brand-border shadow-inner"
        >
          {isResearch ? (
            /* RESEARCHER NAVIGATION: Inbox, SignalCases, Evidence Gaps, Interoperability */
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
                onClick={() => handleResearchNav("cases")}
                aria-current={researchTab === "cases" ? "page" : undefined}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  researchTab === "cases"
                    ? "bg-white text-brand-dark shadow-xs border border-gray-200 font-bold"
                    : "text-brand-secondary hover:text-brand-text"
                }`}
              >
                <FolderGit2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>SignalCases</span>
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

              <button
                type="button"
                onClick={() => handleResearchNav("interop")}
                aria-current={researchTab === "interop" ? "page" : undefined}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  researchTab === "interop"
                    ? "bg-white text-brand-dark shadow-xs border border-gray-200 font-bold"
                    : "text-brand-secondary hover:text-brand-text"
                }`}
              >
                <Network className="w-3.5 h-3.5 text-emerald-500" />
                <span>Interoperability</span>
              </button>
            </>
          ) : (
            /* CITIZEN NAVIGATION: WaterSignal, Observe, Missions, My Impact (NO duplicated citizen labels) */
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
                onClick={() => {
                  handleCitizenNav("observe");
                  if (onNewObservation) onNewObservation();
                }}
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

        {/* Right: Account & Action Area */}
        <div className="flex items-center space-x-2 shrink-0">
          {showNewButton && mode === "citizen" && citizenTab === "observe" && (
            <button
              onClick={onNewObservation}
              type="button"
              className="text-xs sm:text-sm font-medium bg-brand-teal text-white hover:bg-brand-dark px-2.5 sm:px-3.5 py-1.5 rounded-md transition-colors shadow-xs whitespace-nowrap"
            >
              <span className="hidden sm:inline">+ New Observation</span>
              <span className="sm:hidden">+ New</span>
            </button>
          )}

          {/* Desktop Account Menu */}
          <div className="relative hidden md:block">
            <button
              ref={accountButtonRef}
              type="button"
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-brand-text border border-brand-border transition-colors shadow-2xs"
              aria-expanded={accountMenuOpen}
              aria-haspopup="true"
            >
              <User className="w-3.5 h-3.5 text-brand-teal" />
              <span>Account</span>
              <ChevronDown className="w-3 h-3 text-brand-secondary" />
            </button>

            {accountMenuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-64 bg-white border border-brand-border rounded-xl shadow-lg p-3 z-50 animate-in fade-in zoom-in-95 duration-100"
                role="menu"
              >
                <div className="pb-2.5 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                      Active Role
                    </span>
                    <span className="text-[10px] font-semibold bg-brand-light text-brand-dark px-1.5 py-0.5 rounded">
                      {isResearch ? "Researcher" : "Citizen"}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-brand-text mt-1">
                    {isResearch ? "Limnology Research Desk" : "Community Contributor"}
                  </p>
                  <p className="text-[11px] text-brand-secondary">
                    {isResearch ? "Dr. One Health Analyst" : "BrookDragonfly-2378"}
                  </p>
                </div>

                <div className="pt-2 space-y-1">
                  {isResearch ? (
                    <button
                      type="button"
                      onClick={() => handleModeToggle("citizen")}
                      className="w-full text-left text-xs font-semibold px-2.5 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-brand-text transition-colors flex items-center justify-between"
                      role="menuitem"
                    >
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-teal-600" />
                        <span>Citizen Observe</span>
                      </span>
                      <span className="text-[10px] text-brand-secondary">Switch</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleModeToggle("research")}
                      className="w-full text-left text-xs font-semibold px-2.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center justify-between"
                      role="menuitem"
                    >
                      <span className="flex items-center gap-1.5">
                        <Microscope className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Research Workspace</span>
                      </span>
                      <span className="text-[10px] text-cyan-300">Switch</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Switch Button (Desktop) to preserve direct 1-click test workflows */}
          <div className="hidden lg:flex items-center">
            {isResearch ? (
              <button
                type="button"
                onClick={() => handleModeToggle("citizen")}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-brand-text border border-brand-border transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <User className="w-3.5 h-3.5 text-brand-teal" />
                <span>Citizen Observe</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleModeToggle("research")}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-brand-dark hover:bg-slate-800 text-white border border-slate-700 transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Microscope className="w-3.5 h-3.5 text-cyan-400" />
                <span>Research Workspace</span>
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle Button (Accessible Hamburger) */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden p-2 rounded-lg text-brand-secondary hover:text-brand-text hover:bg-gray-100 transition-colors border border-brand-border shrink-0"
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
          className="fixed inset-0 z-50 md:hidden flex justify-end"
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
            className="relative w-full max-w-[290px] sm:max-w-xs bg-white h-full shadow-2xl z-10 flex flex-col justify-between p-5 overflow-y-auto animate-in slide-in-from-right duration-200"
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
                      {isResearch ? "🔬 Research Workspace" : "💧 Citizen WaterSignal"}
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
                  /* RESEARCHER MOBILE NAV: Inbox, SignalCases, Evidence Gaps, Interoperability */
                  <>
                    <button
                      type="button"
                      onClick={() => handleResearchNav("inbox")}
                      aria-current={researchTab === "inbox" ? "page" : undefined}
                      className={`w-full text-left text-sm font-semibold p-3 rounded-xl transition-all flex items-center gap-3 ${
                        researchTab === "inbox"
                          ? "bg-cyan-50 text-cyan-900 border-l-4 border-cyan-600 font-bold shadow-xs"
                          : "text-brand-secondary hover:bg-gray-50 hover:text-brand-text"
                      }`}
                    >
                      <Inbox className="w-4 h-4 text-cyan-600" />
                      <span>Inbox</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResearchNav("cases")}
                      aria-current={researchTab === "cases" ? "page" : undefined}
                      className={`w-full text-left text-sm font-semibold p-3 rounded-xl transition-all flex items-center gap-3 ${
                        researchTab === "cases"
                          ? "bg-cyan-50 text-cyan-900 border-l-4 border-cyan-600 font-bold shadow-xs"
                          : "text-brand-secondary hover:bg-gray-50 hover:text-brand-text"
                      }`}
                    >
                      <FolderGit2 className="w-4 h-4 text-indigo-500" />
                      <span>SignalCases</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResearchNav("gaps")}
                      aria-current={researchTab === "gaps" ? "page" : undefined}
                      className={`w-full text-left text-sm font-semibold p-3 rounded-xl transition-all flex items-center gap-3 ${
                        researchTab === "gaps"
                          ? "bg-cyan-50 text-cyan-900 border-l-4 border-cyan-600 font-bold shadow-xs"
                          : "text-brand-secondary hover:bg-gray-50 hover:text-brand-text"
                      }`}
                    >
                      <Compass className="w-4 h-4 text-sky-500" />
                      <span>Evidence Gaps</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResearchNav("interop")}
                      aria-current={researchTab === "interop" ? "page" : undefined}
                      className={`w-full text-left text-sm font-semibold p-3 rounded-xl transition-all flex items-center gap-3 ${
                        researchTab === "interop"
                          ? "bg-cyan-50 text-cyan-900 border-l-4 border-cyan-600 font-bold shadow-xs"
                          : "text-brand-secondary hover:bg-gray-50 hover:text-brand-text"
                      }`}
                    >
                      <Network className="w-4 h-4 text-emerald-500" />
                      <span>Interoperability</span>
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
                          ? "bg-teal-50 text-brand-dark border-l-4 border-brand-teal font-bold shadow-xs"
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
                        if (onNewObservation) onNewObservation();
                      }}
                      aria-current={citizenTab === "observe" && mode === "citizen" ? "page" : undefined}
                      className={`w-full text-left text-sm font-semibold p-3 rounded-xl transition-all flex items-center gap-3 ${
                        citizenTab === "observe" && mode === "citizen"
                          ? "bg-teal-50 text-brand-dark border-l-4 border-brand-teal font-bold shadow-xs"
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
                          ? "bg-teal-50 text-brand-dark border-l-4 border-brand-teal font-bold shadow-xs"
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
                          ? "bg-teal-50 text-brand-dark border-l-4 border-brand-teal font-bold shadow-xs"
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

            {/* Bottom Drawer: Account & Mode Switcher */}
            <div className="pt-4 border-t border-brand-border space-y-3">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-brand-teal shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-brand-text">Account</span>
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  </div>
                  <p className="text-[11px] text-brand-secondary">
                    {isResearch ? "Researcher Profile" : "Contributor Profile"}
                  </p>
                </div>
              </div>

              {isResearch ? (
                <button
                  type="button"
                  onClick={() => handleModeToggle("citizen")}
                  className="w-full text-xs font-semibold p-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-brand-text border border-brand-border transition-colors flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4 text-brand-teal" />
                  <span>Citizen Observe</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleModeToggle("research")}
                  className="w-full text-xs font-semibold p-2.5 rounded-lg bg-brand-dark hover:bg-slate-800 text-white border border-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Microscope className="w-4 h-4 text-cyan-400" />
                  <span>Research Workspace</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

