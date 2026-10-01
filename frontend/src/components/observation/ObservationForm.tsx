import React, { useState } from "react";
import {
  MapPin,
  Camera,
  AlertCircle,
  X,
  UploadCloud,
  CheckCircle2,
} from "lucide-react";
import {
  ReportCreate,
  WATER_APPEARANCE_OPTIONS,
  FLOW_CONDITION_OPTIONS,
  ODOR_OPTIONS,
} from "../../types/report";

interface ObservationFormProps {
  onSubmit: (reportData: ReportCreate, mediaFile: File | null) => Promise<void>;
  isSubmitting: boolean;
  submittingMessage?: string;
  errorMessage?: string | null;
}

export const ObservationForm: React.FC<ObservationFormProps> = ({
  onSubmit,
  isSubmitting,
  submittingMessage,
  errorMessage,
}) => {
  // Form fields
  const [observedAt, setObservedAt] = useState(() => {
    const now = new Date();
    // Format to YYYY-MM-DDTHH:mm
    return now.toISOString().slice(0, 16);
  });
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [waterAppearance, setWaterAppearance] = useState<string>("");
  const [flowCondition, setFlowCondition] = useState<string>("");
  const [odor, setOdor] = useState<string>("");
  const [foamObserved, setFoamObserved] = useState<boolean>(false);
  const [litterObserved, setLitterObserved] = useState<boolean>(false);
  const [deadWildlifeObserved, setDeadWildlifeObserved] = useState<boolean>(false);

  // Media state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Geolocation state
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Client validation state
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
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGeoStatus("Coordinates acquired via browser GPS.");
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (10 MB backend limit)
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setMediaError("Image exceeds 10 MB limit. Please select a smaller photo.");
      return;
    }

    // Validate format
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setMediaError("Supported formats are JPEG, PNG, or WebP.");
      return;
    }

    setMediaFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleRemoveMedia = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setMediaFile(null);
    setPreviewUrl(null);
    setMediaError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const errors: Record<string, string> = {};

    // Validate description
    const cleanDesc = description.trim();
    if (!cleanDesc || cleanDesc.length < 3) {
      errors.description = "Description must be at least 3 characters long.";
    }

    // Validate coordinates
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      errors.latitude = "Latitude must be a valid number between -90 and 90.";
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      errors.longitude = "Longitude must be a valid number between -180 and 180.";
    }

    // Validate observed_at
    if (!observedAt) {
      errors.observed_at = "Observation timestamp is required.";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});

    const reportData: ReportCreate = {
      observed_at: new Date(observedAt).toISOString(),
      latitude: latNum,
      longitude: lonNum,
      description: cleanDesc,
      water_appearance: waterAppearance || null,
      flow_condition: flowCondition || null,
      odor: odor || null,
      foam_observed: foamObserved,
      litter_observed: litterObserved,
      dead_wildlife_observed: deadWildlifeObserved,
    };

    await onSubmit(reportData, mediaFile);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Introduction Card */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs">
        <h2 className="text-xl font-bold text-brand-text">Submit Freshwater Observation</h2>
        <p className="text-sm text-brand-secondary mt-1">
          Document observable conditions at an urban stream, canal, or pond. Your report forms a transparent, verifiable One Health evidence case for researchers and community monitors.
        </p>

        {errorMessage && (
          <div className="mt-4 p-4 bg-red-50 border border-brand-error/30 rounded-lg flex items-start space-x-3 text-sm text-red-800" role="alert">
            <AlertCircle className="w-5 h-5 text-brand-error shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Submission Error</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Section 1: Location & Time */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-6">
        <div className="flex items-center space-x-2 border-b border-brand-border pb-3">
          <MapPin className="w-5 h-5 text-brand-teal" />
          <h3 className="font-semibold text-brand-text">1. Location & Observation Time</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="observed_at" className="block text-xs font-semibold text-brand-text uppercase tracking-wider mb-1">
              Observation Time *
            </label>
            <input
              id="observed_at"
              type="datetime-local"
              value={observedAt}
              onChange={(e) => setObservedAt(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
              required
            />
            {validationErrors.observed_at && (
              <p className="text-xs text-brand-error mt-1">{validationErrors.observed_at}</p>
            )}
          </div>

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
              onChange={(e) => setLatitude(e.target.value)}
              disabled={isSubmitting}
              className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal ${
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
              onChange={(e) => setLongitude(e.target.value)}
              disabled={isSubmitting}
              className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal ${
                validationErrors.longitude ? "border-brand-error" : "border-brand-border"
              }`}
              required
            />
            {validationErrors.longitude && (
              <p className="text-xs text-brand-error mt-1">{validationErrors.longitude}</p>
            )}
          </div>
        </div>

        {/* Geolocation Button and feedback */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isSubmitting || isLocating}
            className="inline-flex items-center space-x-2 text-xs font-medium text-brand-dark bg-brand-light hover:bg-brand-light/80 px-3.5 py-2 rounded-lg transition-colors border border-brand-border"
          >
            <MapPin className="w-4 h-4 text-brand-teal" />
            <span>{isLocating ? "Acquiring GPS Coordinates..." : "Use Current Browser Location"}</span>
          </button>

          {geoStatus && (
            <p className="text-xs text-brand-secondary italic">
              {geoStatus}
            </p>
          )}
        </div>
      </div>

      {/* Section 2: Primary Observation Description */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-brand-border pb-3">
          <h3 className="font-semibold text-brand-text">2. Observation Description *</h3>
          <span className="text-xs text-brand-secondary">{description.length} / 5000 characters</span>
        </div>

        <div>
          <label htmlFor="description" className="block text-xs font-semibold text-brand-text uppercase tracking-wider mb-1">
            Observation Description *
          </label>
          <p className="text-xs text-brand-secondary mb-2">
            What did you observe? Describe physical cues such as discoloration, scum, surface film, or surroundings. (Avoid speculative diagnoses like "water is poisoned").
          </p>
          <textarea
            id="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g., Observed thick green floating layer near storm drain outlet with stagnant water and slight musty odor."
            className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal ${
              validationErrors.description ? "border-brand-error" : "border-brand-border"
            }`}
            required
            minLength={3}
            maxLength={5000}
          />
          {validationErrors.description && (
            <p className="text-xs text-brand-error mt-1">{validationErrors.description}</p>
          )}
        </div>
      </div>

      {/* Section 3: Contextual Characteristics */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-6">
        <h3 className="font-semibold text-brand-text border-b border-brand-border pb-3">
          3. Water Characteristics (Controlled Dimensions)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="water_appearance" className="block text-xs font-semibold text-brand-text uppercase tracking-wider mb-1">
              Water Appearance
            </label>
            <select
              id="water_appearance"
              value={waterAppearance}
              onChange={(e) => setWaterAppearance(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
            >
              <option value="">-- Not specified --</option>
              {WATER_APPEARANCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="flow_condition" className="block text-xs font-semibold text-brand-text uppercase tracking-wider mb-1">
              Flow Condition
            </label>
            <select
              id="flow_condition"
              value={flowCondition}
              onChange={(e) => setFlowCondition(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
            >
              <option value="">-- Not specified --</option>
              {FLOW_CONDITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="odor" className="block text-xs font-semibold text-brand-text uppercase tracking-wider mb-1">
              Odor / Smell
            </label>
            <select
              id="odor"
              value={odor}
              onChange={(e) => setOdor(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
            >
              <option value="">-- Not specified --</option>
              {ODOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Observable Triggers */}
        <div className="pt-2">
          <span className="block text-xs font-semibold text-brand-text uppercase tracking-wider mb-2">
            Specific Visible Signals
          </span>
          <p className="text-xs text-brand-secondary mb-3">
            Select only if directly observed. Leaving unchecked means not observed, not proven absent.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center space-x-2.5 p-3 rounded-lg border border-brand-border bg-gray-50/50 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={foamObserved}
                onChange={(e) => setFoamObserved(e.target.checked)}
                disabled={isSubmitting}
                className="w-4 h-4 text-brand-teal rounded border-brand-border focus:ring-brand-teal"
              />
              <span className="text-xs font-medium text-brand-text">Unnatural Foam Observed</span>
            </label>

            <label className="flex items-center space-x-2.5 p-3 rounded-lg border border-brand-border bg-gray-50/50 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={litterObserved}
                onChange={(e) => setLitterObserved(e.target.checked)}
                disabled={isSubmitting}
                className="w-4 h-4 text-brand-teal rounded border-brand-border focus:ring-brand-teal"
              />
              <span className="text-xs font-medium text-brand-text">Visible Litter / Debris</span>
            </label>

            <label className="flex items-center space-x-2.5 p-3 rounded-lg border border-brand-border bg-gray-50/50 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={deadWildlifeObserved}
                onChange={(e) => setDeadWildlifeObserved(e.target.checked)}
                disabled={isSubmitting}
                className="w-4 h-4 text-brand-teal rounded border-brand-border focus:ring-brand-teal"
              />
              <span className="text-xs font-medium text-brand-text">Dead Wildlife Observed</span>
            </label>
          </div>
        </div>
      </div>

      {/* Section 4: Photographic Evidence Upload */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-brand-border pb-3">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-brand-teal" />
            <h3 className="font-semibold text-brand-text">4. Photographic Media Evidence</h3>
          </div>
          <span className="text-xs text-brand-secondary">Optional (JPEG, PNG, WebP &le; 10 MB)</span>
        </div>

        {!previewUrl ? (
          <div>
            <label
              htmlFor="media_file"
              className="flex flex-col items-center justify-center border-2 border-dashed border-brand-border hover:border-brand-teal rounded-xl p-6 cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition-colors"
            >
              <UploadCloud className="w-8 h-8 text-brand-secondary mb-2" />
              <span className="text-sm font-medium text-brand-text">Click to select photo evidence</span>
              <span className="text-xs text-brand-secondary mt-1">JPEG, PNG, or WebP up to 10 MB</span>
              <input
                id="media_file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                disabled={isSubmitting}
                className="hidden"
              />
            </label>
            {mediaError && (
              <p className="text-xs text-brand-error mt-2">{mediaError}</p>
            )}
          </div>
        ) : (
          <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg border border-brand-border">
            <img
              src={previewUrl}
              alt="Evidence preview"
              className="w-24 h-24 object-cover rounded-md border border-brand-border"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-brand-success shrink-0" />
                <p className="text-xs font-semibold text-brand-text truncate">
                  {mediaFile?.name}
                </p>
              </div>
              <p className="text-xs text-brand-secondary mt-1">
                Size: {mediaFile ? (mediaFile.size / 1024 / 1024).toFixed(2) : 0} MB
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Cryptographic SHA-256 and content signature validation will be performed on upload.
              </p>
              <button
                type="button"
                onClick={handleRemoveMedia}
                disabled={isSubmitting}
                className="mt-2 text-xs text-brand-error hover:underline flex items-center space-x-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Remove photo</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Submission Actions */}
      <div className="flex items-center justify-end space-x-4 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-semibold text-white bg-brand-teal hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors min-w-[200px]"
        >
          {isSubmitting ? (
            <div className="flex items-center space-x-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{submittingMessage || "Processing..."}</span>
            </div>
          ) : (
            <span>Submit Citizen Observation &rarr;</span>
          )}
        </button>
      </div>
    </form>
  );
};
