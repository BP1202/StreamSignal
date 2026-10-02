import React from "react";
import { Camera, ArrowRight, ShieldCheck, Waves, Sparkles, Clock } from "lucide-react";

interface HeroLandingProps {
  onStartWithPhoto: () => void;
  onStartWithoutPhoto: () => void;
}

export const HeroLanding: React.FC<HeroLandingProps> = ({
  onStartWithPhoto,
  onStartWithoutPhoto,
}) => {
  return (
    <div className="space-y-8">
      {/* Hero Container */}
      <div className="bg-brand-surface rounded-2xl border border-brand-border p-8 sm:p-12 shadow-xs text-center space-y-6">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-brand-light text-brand-dark text-xs font-semibold border border-brand-border">
          <Waves className="w-3.5 h-3.5 text-brand-teal" />
          <span>Urban Freshwater Evidence System</span>
        </div>

        <div className="max-w-2xl mx-auto space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-brand-text tracking-tight leading-tight">
            Notice something unusual in a stream?
          </h1>
          <p className="text-base sm:text-lg text-brand-secondary leading-relaxed">
            Show us what you saw. We'll help turn your observation into structured, reviewable evidence for researchers and local monitors.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="max-w-md mx-auto pt-2 space-y-3">
          <button
            type="button"
            onClick={onStartWithPhoto}
            className="w-full inline-flex items-center justify-center space-x-3 px-6 py-4 rounded-xl text-base font-bold text-white bg-brand-teal hover:bg-brand-dark shadow-sm hover:shadow transition-all group"
          >
            <Camera className="w-5 h-5 text-brand-light group-hover:scale-110 transition-transform" />
            <span>Capture what you see</span>
            <span className="text-xs font-normal opacity-90 pl-1">(~30–60 seconds)</span>
          </button>

          <button
            type="button"
            onClick={onStartWithoutPhoto}
            className="w-full inline-flex items-center justify-center space-x-1.5 py-2.5 text-xs sm:text-sm font-semibold text-brand-secondary hover:text-brand-dark transition-colors"
          >
            <span>Or start without a photo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Trust & Educational Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-brand-border text-left">
          <div className="flex items-start space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-light flex items-center justify-center text-brand-teal shrink-0 mt-0.5">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-brand-text">Photo as Evidence</p>
              <p className="text-[11px] text-brand-secondary leading-tight mt-0.5">
                Preserves original physical cues for future researcher review.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-light flex items-center justify-center text-brand-teal shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-brand-text">Smart Guidance</p>
              <p className="text-[11px] text-brand-secondary leading-tight mt-0.5">
                No scientific jargon needed. We ask targeted questions to structure your observations.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-light flex items-center justify-center text-brand-teal shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-brand-text">SignalGuard Trust</p>
              <p className="text-[11px] text-brand-secondary leading-tight mt-0.5">
                Clearly separates citizen observations from automated inference and expert decisions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
