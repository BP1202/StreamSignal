import React, { useState } from "react";
import { ArrowRight, HelpCircle, AlertCircle, Check } from "lucide-react";
import { VISUAL_SIGNALS } from "../../types/journey";
import {
  WATER_APPEARANCE_OPTIONS,
  FLOW_CONDITION_OPTIONS,
  ODOR_OPTIONS,
} from "../../types/report";

interface ObservationSignalsStepProps {
  description: string;
  onChangeDescription: (desc: string) => void;
  waterAppearance: string;
  onChangeWaterAppearance: (val: string) => void;
  flowCondition: string;
  onChangeFlowCondition: (val: string) => void;
  odor: string;
  onChangeOdor: (val: string) => void;
  foamObserved: boolean;
  onToggleFoam: (val: boolean) => void;
  litterObserved: boolean;
  onToggleLitter: (val: boolean) => void;
  deadWildlifeObserved: boolean;
  onToggleWildlife: (val: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export const ObservationSignalsStep: React.FC<ObservationSignalsStepProps> = ({
  description,
  onChangeDescription,
  waterAppearance,
  onChangeWaterAppearance,
  flowCondition,
  onChangeFlowCondition,
  odor,
  onChangeOdor,
  foamObserved,
  onToggleFoam,
  litterObserved,
  onToggleLitter,
  deadWildlifeObserved,
  onToggleWildlife,
  onNext,
  onBack,
}) => {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (waterAppearance === "green_surface_material" || waterAppearance === "dark_discolored" || waterAppearance === "cloudy") s.add("color");
    if (waterAppearance === "oily_sheen") s.add("sheen");
    if (foamObserved) s.add("foam");
    if (litterObserved) s.add("litter");
    if (deadWildlifeObserved) s.add("wildlife");
    if (flowCondition) s.add("flow");
    if (odor && odor !== "none_noticed") s.add("odor");
    return s;
  });

  const [showWhy, setShowWhy] = useState<boolean>(false);
  const [descError, setDescError] = useState<string | null>(null);

  const handleToggleCard = (cardId: string, trigger: string) => {
    const next = new Set(selectedCards);
    if (next.has(cardId)) {
      next.delete(cardId);
      // reset associated field
      if (trigger === "foam") onToggleFoam(false);
      if (trigger === "litter") onToggleLitter(false);
      if (trigger === "wildlife") onToggleWildlife(false);
    } else {
      next.add(cardId);
      if (trigger === "foam") onToggleFoam(true);
      if (trigger === "litter") onToggleLitter(true);
      if (trigger === "wildlife") onToggleWildlife(true);
      if (trigger === "water_appearance" && !waterAppearance) {
        onChangeWaterAppearance(cardId === "sheen" ? "oily_sheen" : "green_surface_material");
      }
      if (trigger === "flow_condition" && !flowCondition) {
        onChangeFlowCondition("stagnant");
      }
      if (trigger === "odor" && !odor) {
        onChangeOdor("musty_earthy");
      }
    }
    setSelectedCards(next);
  };

  const handleContinue = () => {
    const cleanDesc = description.trim();
    if (!cleanDesc || cleanDesc.length < 3) {
      setDescError("Please describe what you observed (at least 3 characters).");
      return;
    }
    setDescError(null);
    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-3.5 sm:p-6 shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-brand-text">What caught your attention?</h2>
            <p className="text-xs sm:text-sm text-brand-secondary mt-1">
              Select any visual signals that you noticed today. You don't need to know the cause.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWhy(!showWhy)}
            className="inline-flex items-center space-x-1 text-xs text-brand-teal hover:text-brand-dark transition-colors shrink-0"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Why structured?</span>
          </button>
        </div>

        {showWhy && (
          <div className="mt-4 p-3.5 bg-brand-light/40 border border-brand-teal/20 rounded-lg text-xs text-brand-dark leading-relaxed">
            <strong>Why structured observations matter:</strong> Standardized observations help researchers compare reports across different urban streams and historical dates without guessing what informal words meant.
          </div>
        )}
      </div>

      {/* Visual Signal Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {VISUAL_SIGNALS.map((sig) => {
          const isSelected = selectedCards.has(sig.id);
          return (
            <button
              key={sig.id}
              type="button"
              onClick={() => handleToggleCard(sig.id, sig.fieldTrigger)}
              className={`p-3 sm:p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                isSelected
                  ? "border-brand-teal bg-brand-light/40 ring-1 ring-brand-teal shadow-xs"
                  : "border-brand-border bg-brand-surface hover:bg-gray-50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{sig.emoji}</span>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-brand-teal text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold text-brand-text">{sig.title}</p>
                <p className="text-[11px] text-brand-secondary leading-tight mt-1 line-clamp-2">
                  {sig.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Contextual Detail Expandables if selected */}
      {(selectedCards.has("color") || selectedCards.has("sheen") || selectedCards.has("flow") || selectedCards.has("odor")) && (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dark">
            Refine Documented Characteristics
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(selectedCards.has("color") || selectedCards.has("sheen")) && (
              <div>
                <label htmlFor="water_appearance" className="block text-xs font-semibold text-brand-text mb-1">
                  Water Appearance
                </label>
                <select
                  id="water_appearance"
                  value={waterAppearance}
                  onChange={(e) => onChangeWaterAppearance(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-xs bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                >
                  <option value="">-- Choose appearance --</option>
                  {WATER_APPEARANCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedCards.has("flow") && (
              <div>
                <label htmlFor="flow_condition" className="block text-xs font-semibold text-brand-text mb-1">
                  Flow Condition
                </label>
                <select
                  id="flow_condition"
                  value={flowCondition}
                  onChange={(e) => onChangeFlowCondition(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-xs bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                >
                  <option value="">-- Choose flow --</option>
                  {FLOW_CONDITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedCards.has("odor") && (
              <div>
                <label htmlFor="odor" className="block text-xs font-semibold text-brand-text mb-1">
                  Odor / Smell
                </label>
                <select
                  id="odor"
                  value={odor}
                  onChange={(e) => onChangeOdor(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-xs bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                >
                  <option value="">-- Choose smell --</option>
                  {ODOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Description Section */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-brand-border pb-2">
          <label htmlFor="description" className="block text-sm font-bold text-brand-text">
            Tell us what you noticed *
          </label>
          <span className="text-xs text-brand-secondary">{description.length} / 5000</span>
        </div>

        <p className="text-xs text-brand-secondary">
          Describe what you personally saw, smelled, or noticed in your own words. (No need to guess the cause).
        </p>

        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => {
            onChangeDescription(e.target.value);
            if (descError) setDescError(null);
          }}
          placeholder="e.g. I noticed a thick green layer along the bank with stagnant water and a noticeable earthy smell."
          className={`w-full px-3 py-2 border rounded-lg text-xs sm:text-sm bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal ${
            descError ? "border-brand-error ring-1 ring-brand-error" : "border-brand-border"
          }`}
          required
          minLength={3}
          maxLength={5000}
        />

        {descError && (
          <div className="flex items-center space-x-1.5 text-xs text-brand-error">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{descError}</span>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2 gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-brand-secondary hover:text-brand-text px-3 py-2 transition-colors"
        >
          &larr; Back
        </button>

        <button
          type="button"
          onClick={handleContinue}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-brand-teal hover:bg-brand-dark transition-colors shadow-xs"
        >
          <span>Continue to location</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
