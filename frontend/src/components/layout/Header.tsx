import React from "react";
import { Droplets, ShieldCheck } from "lucide-react";

interface HeaderProps {
  onNewObservation?: () => void;
  showNewButton?: boolean;
  mode?: "citizen" | "research";
  onSwitchMode?: (mode: "citizen" | "research") => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNewObservation,
  showNewButton,
  mode = "citizen",
  onSwitchMode,
}) => {
  return (
    <header className="bg-brand-surface border-b border-brand-border sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div
          className="flex items-center space-x-3 cursor-pointer"
          onClick={() => {
            if (onSwitchMode) onSwitchMode("citizen");
            if (onNewObservation) onNewObservation();
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

        {/* Workspace Mode Navigation */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg border border-brand-border">
          <button
            type="button"
            onClick={() => onSwitchMode?.("citizen")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
              mode === "citizen"
                ? "bg-white text-brand-text shadow-xs"
                : "text-brand-secondary hover:text-brand-text"
            }`}
          >
            Citizen Observe
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode?.("research")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              mode === "research"
                ? "bg-brand-dark text-white shadow-xs"
                : "text-brand-secondary hover:text-brand-text"
            }`}
          >
            <span>Research Workspace</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                mode === "research" ? "bg-brand-teal text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              Inbox
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden lg:flex items-center space-x-1 text-xs text-brand-secondary bg-gray-50 border border-brand-border px-2.5 py-1 rounded-md">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
            <span>SignalGuard Active</span>
          </div>
          {mode === "citizen" && showNewButton && (
            <button
              onClick={onNewObservation}
              type="button"
              className="text-xs sm:text-sm font-medium bg-brand-teal text-white hover:bg-brand-dark px-3.5 py-1.5 rounded-md transition-colors shadow-xs"
            >
              + New Observation
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
