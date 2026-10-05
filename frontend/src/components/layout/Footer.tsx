import React from "react";
import { Info, ShieldAlert } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-brand-surface border-t border-brand-border mt-16 py-8 text-xs text-brand-secondary">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-brand-border pb-4">
          <div>
            <p className="font-semibold text-brand-text">StreamSignal Evidence Platform</p>
            <p className="text-gray-500 text-[11px] sm:text-xs">Urban Freshwater Evidence System & One Health Surveillance</p>
          </div>
          <div className="flex items-center space-x-2 text-brand-dark bg-brand-light/50 px-2.5 sm:px-3 py-1.5 rounded-md border border-brand-border text-[11px] sm:text-xs">
            <Info className="w-4 h-4 text-brand-teal shrink-0" />
            <span>Separating Citizen Evidence, Machine Assistance, and Human Decision</span>
          </div>
        </div>

        <div className="flex items-start space-x-2 text-gray-500 text-[10px] sm:text-[11px] leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-brand-warning shrink-0 mt-0.5" />
          <p>
            <strong>Scientific Boundary:</strong> StreamSignal is an evidence-intake and provenance system, not a diagnostic or pollution-attribution tool. Visual observations, completeness metrics, and historical similarity do not confirm contamination, toxicity, organism identity, or public health risks without authorized human expert and instrument verification.
          </p>
        </div>
      </div>
    </footer>
  );
};
