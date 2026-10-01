import React from "react";
import { Droplets, ShieldCheck } from "lucide-react";

interface HeaderProps {
  onNewObservation?: () => void;
  showNewButton?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onNewObservation, showNewButton }) => {
  return (
    <header className="bg-brand-surface border-b border-brand-border sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={onNewObservation}>
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

        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center space-x-1 text-xs text-brand-secondary bg-gray-50 border border-brand-border px-2.5 py-1 rounded-md">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
            <span>SignalGuard Evidence Trust Active</span>
          </div>
          {showNewButton && (
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
