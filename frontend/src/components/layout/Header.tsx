import React, { useState } from "react";
import { Droplets, ShieldCheck, User, Microscope, Menu, X } from "lucide-react";

export type CitizenTab = "home" | "observe" | "missions" | "impact";

interface HeaderProps {
  onNewObservation?: () => void;
  showNewButton?: boolean;
  mode?: "citizen" | "missions" | "research";
  citizenTab?: CitizenTab;
  onSwitchCitizenTab?: (tab: CitizenTab) => void;
  onSwitchMode?: (mode: "citizen" | "missions" | "research") => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNewObservation,
  showNewButton,
  mode = "citizen",
  citizenTab = "home",
  onSwitchCitizenTab,
  onSwitchMode,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isResearch = mode === "research";

  const handleCitizenNav = (tab: CitizenTab) => {
    if (onSwitchMode) onSwitchMode("citizen");
    if (onSwitchCitizenTab) onSwitchCitizenTab(tab);
    setMobileMenuOpen(false);
  };

  const handleMissionsNav = () => {
    if (onSwitchMode) onSwitchMode("missions");
    if (onSwitchCitizenTab) onSwitchCitizenTab("missions");
    setMobileMenuOpen(false);
  };

  const handleModeToggle = (targetMode: "citizen" | "research") => {
    if (onSwitchMode) onSwitchMode(targetMode);
    if (targetMode === "citizen" && onSwitchCitizenTab) onSwitchCitizenTab("home");
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-brand-surface border-b border-brand-border sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand & Catchment Identity */}
        <div
          className="flex items-center space-x-3 cursor-pointer shrink-0"
          onClick={() => {
            if (onSwitchMode) onSwitchMode("citizen");
            if (onSwitchCitizenTab) onSwitchCitizenTab("home");
          }}
        >
          <div className="w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center text-brand-teal">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-brand-text tracking-tight">StreamSignal</span>
              <span className="text-[11px] font-semibold bg-brand-light text-brand-dark px-2 py-0.5 rounded-full">
                One Health
              </span>
            </div>
            <p className="text-xs text-brand-secondary hidden sm:block">
              Urban Freshwater Evidence & Provenance System
            </p>
          </div>
        </div>

        {/* Center: Surface-Specific Context & Sub-Nav (Desktop) */}
        {isResearch ? (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Microscope className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-white">Research Workspace</span>
            <span className="text-slate-500">|</span>
            <span className="text-[11px] text-cyan-300 font-mono">Evidence Triage & Case Review</span>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-brand-border">
            <button
              type="button"
              onClick={() => handleCitizenNav("home")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                citizenTab === "home" && mode === "citizen"
                  ? "bg-white text-brand-text shadow-xs"
                  : "text-brand-secondary hover:text-brand-text"
              }`}
            >
              💧 WaterSignal
            </button>
            <button
              type="button"
              onClick={() => {
                handleCitizenNav("observe");
                if (onNewObservation) onNewObservation();
              }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                citizenTab === "observe" && mode === "citizen"
                  ? "bg-white text-brand-text shadow-xs"
                  : "text-brand-secondary hover:text-brand-text"
              }`}
            >
              📸 Citizen Observe
            </button>
            <button
              type="button"
              onClick={handleMissionsNav}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                mode === "missions" || citizenTab === "missions"
                  ? "bg-white text-brand-text shadow-xs"
                  : "text-brand-secondary hover:text-brand-text"
              }`}
            >
              <span>🎯 Citizen Missions</span>
            </button>
            <button
              type="button"
              onClick={() => handleCitizenNav("impact")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                citizenTab === "impact" && mode === "citizen"
                  ? "bg-white text-brand-text shadow-xs"
                  : "text-brand-secondary hover:text-brand-text"
              }`}
            >
              🌱 My Impact
            </button>
          </div>
        )}

        {/* Right: Actor Switcher & Safety Badge */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="hidden lg:flex items-center space-x-1 text-xs text-brand-secondary bg-gray-50 border border-brand-border px-2.5 py-1 rounded-md">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
            <span>SignalGuard Active</span>
          </div>

          {/* Actor Role Switcher Toggle (Desktop) */}
          <div className="hidden sm:flex items-center">
            {isResearch ? (
              <button
                type="button"
                onClick={() => handleModeToggle("citizen")}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-brand-text border border-brand-border transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <User className="w-3.5 h-3.5 text-brand-teal" />
                <span>Citizen Observe</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleModeToggle("research")}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-dark hover:bg-slate-800 text-white border border-slate-700 transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Microscope className="w-3.5 h-3.5 text-cyan-400" />
                <span>Research Workspace</span>
                <span className="text-[10px] bg-brand-teal px-1.5 py-0.2 rounded-full font-mono text-white">
                  Inbox
                </span>
              </button>
            )}
          </div>

          {showNewButton && mode === "citizen" && citizenTab === "observe" && (
            <button
              onClick={onNewObservation}
              type="button"
              className="text-xs sm:text-sm font-medium bg-brand-teal text-white hover:bg-brand-dark px-3.5 py-1.5 rounded-md transition-colors shadow-xs"
            >
              + New Observation
            </button>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-brand-secondary hover:text-brand-text hover:bg-gray-100 transition-colors border border-brand-border"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-brand-border bg-brand-surface px-4 py-3 space-y-2 shadow-inner animate-in slide-in-from-top duration-150">
          {/* Surface Indicator */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 text-xs">
            <span className="text-brand-secondary font-medium">Active Surface:</span>
            <span className="font-semibold text-brand-text">
              {isResearch ? "🔬 Research Workspace" : "💧 Citizen WaterSignal"}
            </span>
          </div>

          {/* Sub-nav Buttons */}
          {!isResearch && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleCitizenNav("home")}
                className={`text-xs font-semibold p-2.5 rounded-lg text-left transition-all ${
                  citizenTab === "home"
                    ? "bg-cyan-50 text-cyan-900 border border-cyan-200 font-bold"
                    : "bg-gray-50 text-brand-secondary hover:bg-gray-100"
                }`}
              >
                💧 WaterSignal
              </button>
              <button
                type="button"
                onClick={() => {
                  handleCitizenNav("observe");
                  if (onNewObservation) onNewObservation();
                }}
                className={`text-xs font-semibold p-2.5 rounded-lg text-left transition-all ${
                  citizenTab === "observe"
                    ? "bg-cyan-50 text-cyan-900 border border-cyan-200 font-bold"
                    : "bg-gray-50 text-brand-secondary hover:bg-gray-100"
                }`}
              >
                📸 Citizen Observe
              </button>
              <button
                type="button"
                onClick={handleMissionsNav}
                className={`text-xs font-semibold p-2.5 rounded-lg text-left transition-all ${
                  mode === "missions" || citizenTab === "missions"
                    ? "bg-cyan-50 text-cyan-900 border border-cyan-200 font-bold"
                    : "bg-gray-50 text-brand-secondary hover:bg-gray-100"
                }`}
              >
                🎯 Missions
              </button>
              <button
                type="button"
                onClick={() => handleCitizenNav("impact")}
                className={`text-xs font-semibold p-2.5 rounded-lg text-left transition-all ${
                  citizenTab === "impact"
                    ? "bg-cyan-50 text-cyan-900 border border-cyan-200 font-bold"
                    : "bg-gray-50 text-brand-secondary hover:bg-gray-100"
                }`}
              >
                🌱 My Impact
              </button>
            </div>
          )}

          {/* Actor Role Switcher (Mobile) */}
          <div className="pt-2 border-t border-gray-100">
            {isResearch ? (
              <button
                type="button"
                onClick={() => handleModeToggle("citizen")}
                className="w-full text-xs font-semibold p-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-brand-text border border-brand-border transition-colors flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4 text-brand-teal" />
                <span>Switch to Citizen Observe Surface</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleModeToggle("research")}
                className="w-full text-xs font-semibold p-2.5 rounded-lg bg-brand-dark hover:bg-slate-800 text-white border border-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                <Microscope className="w-4 h-4 text-cyan-400" />
                <span>Switch to Research Workspace</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
