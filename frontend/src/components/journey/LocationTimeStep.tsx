import React, { useState } from "react";
import { MapPin, Clock, HelpCircle, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

interface LocationTimeStepProps {
  latitude: string;
  onChangeLatitude: (lat: string) => void;
  longitude: string;
  onChangeLongitude: (lon: string) => void;
  observedAt: string;
  onChangeObservedAt: (time: string) => void;
  hasMedia: boolean;
  hasDescription: boolean;
  hasCharacteristics: boolean;
  isSubmitting: boolean;
  submittingMessage?: string;
  errorMessage?: string | null;
  onSubmit: () => Promise<void>;
  onBack: () => void;
}

export const LocationTimeStep: React.FC<LocationTimeStepProps> = ({
  latitude,
  onChangeLatitude,
  longitude,
  onChangeLongitude,
  observedAt,
  onChangeObservedAt,
  hasMedia,
  hasDescription,
  hasCharacteristics,
  isSubmitting,
  submittingMessage,
  errorMessage,
  onSubmit,
  onBack,
}) => {
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [showWhy, setShowWhy] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setGeoStatus("Requesting browser GPS location...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChangeLatitude(pos.coords.latitude.toFixed(6));
        onChangeLongitude(pos.coords.longitude.toFixed(6));
        setGeoStatus("Location coordinates acquired via browser GPS.");
        setIsLocating(false);
        setValidationErrors((prev) => {
          const next = { ...prev };
          delete next.latitude;
          delete next.longitude;
          return next;
        });
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus("Location access was denied. Please enter coordinates manually.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoStatus("Location information is unavailable. Please enter coordinates manually.");
        } else {
          setGeoStatus("Location request timed out. Please enter coordinates manually.");
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleValidateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const errors: Record<string, string> = {};
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      errors.latitude = "Latitude must be a valid number between -90 and 90.";
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      errors.longitude = "Longitude must be a valid number between -180 and 180.";
    }
    if (!observedAt) {
      errors.observed_at = "Observation timestamp is required.";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    await onSubmit();
  };

  // Calculate estimated completeness preview
  const items = [
    { label: "Description documented", checked: hasDescription },
    { label: "Photo evidence attached", checked: hasMedia },
    { label: "Water characteristics noted", checked: hasCharacteristics },
    { label: "Coordinates set", checked: !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude)) },
    { label: "Timestamp confirmed", checked: Boolean(observedAt) },
  ];
  const completedCount = items.filter((i) => i.checked).length;
  const estimatedPercent = Math.round((completedCount / items.length) * 100);

  return (
    <form onSubmit={handleValidateAndSubmit} className="space-y-6" noValidate>
      {/* Header */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-3.5 sm:p-6 shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-brand-text">Where & when did you see it?</h2>
            <p className="text-xs sm:text-sm text-brand-secondary mt-1">
              Coordinates tie your observation to the specific stream segment.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWhy(!showWhy)}
            className="inline-flex items-center space-x-1 text-xs text-brand-teal hover:text-brand-dark transition-colors shrink-0"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Why location?</span>
          </button>
        </div>

        {showWhy && (
          <div className="mt-4 p-3.5 bg-brand-light/40 border border-brand-teal/20 rounded-lg text-xs text-brand-dark leading-relaxed">
            <strong>Why your location matters:</strong> Precise coordinates allow StreamSignal's contextual layer (Pattern Echo) to connect observations to the same water body and identify repeated patterns over time.
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-3.5 bg-red-50 border border-brand-error/30 rounded-lg flex items-start space-x-2 text-xs text-red-800" role="alert">
            <AlertCircle className="w-4 h-4 text-brand-error shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Submission error</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Location Card */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-3.5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-brand-border pb-3">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-brand-teal" />
            <h3 className="font-semibold text-brand-text text-sm">Location Coordinates</h3>
          </div>
        </div>

        {/* GPS Quick Action */}
        <div className="p-4 bg-gray-50 rounded-xl border border-brand-border space-y-3">
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isSubmitting || isLocating}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-brand-teal hover:bg-brand-dark transition-colors shadow-xs"
          >
            <MapPin className="w-4 h-4" />
            <span>{isLocating ? "Acquiring GPS location..." : "Use Current Browser Location"}</span>
          </button>

          {geoStatus && (
            <p className="text-xs text-brand-secondary italic">
              {geoStatus}
            </p>
          )}
        </div>

        {/* Manual Fallback Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label htmlFor="latitude" className="block text-xs font-semibold text-brand-text uppercase tracking-wider mb-1">
              Latitude (-90 to 90) *
            </label>
            <input
              id="latitude"
              type="number"
              step="any"
              placeholder="e.g. 24.5854"
              value={latitude}
              onChange={(e) => onChangeLatitude(e.target.value)}
              disabled={isSubmitting}
              className={`w-full px-3 py-2 border rounded-lg text-xs sm:text-sm bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal ${
                validationErrors.latitude ? "border-brand-error" : "border-brand-border"
              }`}
              required
            />
            {validationErrors.latitude && (
              <p className="text-xs text-brand-error mt-1">{validationErrors.latitude}</p>
            )}
          </div>

          <div>
            <label htmlFor="longitude" className="block text-xs font-semibold text-brand-text uppercase tracking-wider mb-1">
              Longitude (-180 to 180) *
            </label>
            <input
              id="longitude"
              type="number"
              step="any"
              placeholder="e.g. 73.7125"
              value={longitude}
              onChange={(e) => onChangeLongitude(e.target.value)}
              disabled={isSubmitting}
              className={`w-full px-3 py-2 border rounded-lg text-xs sm:text-sm bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal ${
                validationErrors.longitude ? "border-brand-error" : "border-brand-border"
              }`}
              required
            />
            {validationErrors.longitude && (
              <p className="text-xs text-brand-error mt-1">{validationErrors.longitude}</p>
            )}
          </div>
        </div>
      </div>

      {/* Observation Time Card */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-brand-border pb-3">
          <Clock className="w-5 h-5 text-brand-teal" />
          <h3 className="font-semibold text-brand-text text-sm">When did you notice this?</h3>
        </div>

        <div>
          <label htmlFor="observed_at" className="block text-xs font-semibold text-brand-text uppercase tracking-wider mb-1">
            Observation Timestamp *
          </label>
          <input
            id="observed_at"
            type="datetime-local"
            value={observedAt}
            onChange={(e) => onChangeObservedAt(e.target.value)}
            disabled={isSubmitting}
            className="w-full sm:w-72 px-3 py-2 border border-brand-border rounded-lg text-xs sm:text-sm bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
            required
          />
          {validationErrors.observed_at && (
            <p className="text-xs text-brand-error mt-1">{validationErrors.observed_at}</p>
          )}
        </div>
      </div>

      {/* Evidence Completeness Panel */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-brand-border pb-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-brand-teal" />
            <span className="text-xs font-bold uppercase tracking-wider text-brand-text">
              Evidence Completeness
            </span>
          </div>
          <span className="text-xs font-bold text-brand-teal">{estimatedPercent}% Documented</span>
        </div>

        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-brand-teal h-2 rounded-full transition-all duration-300"
            style={{ width: `${estimatedPercent}%` }}
          />
        </div>

        <p className="text-[11px] text-brand-secondary">
          Completeness measures how many useful physical dimensions you've documented. It helps researchers compare data and does not indicate environmental hazard or certainty.
        </p>
      </div>

      {/* Navigation & Submit CTA */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="text-xs font-semibold text-brand-secondary hover:text-brand-text px-4 py-2 transition-colors disabled:opacity-50 text-center sm:text-left"
        >
          &larr; Back
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 sm:px-8 py-3 rounded-xl text-sm font-bold text-white bg-brand-teal hover:bg-brand-dark disabled:opacity-50 shadow-sm hover:shadow transition-all min-w-0 sm:min-w-[220px]"
        >
          {isSubmitting ? (
            <div className="flex items-center space-x-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{submittingMessage || "Creating Evidence Case..."}</span>
            </div>
          ) : (
            <>
              <span>Create my Evidence Case</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
