import React, { useRef, useState } from "react";
import { Camera, UploadCloud, X, CheckCircle2, ArrowRight, HelpCircle, Image as ImageIcon } from "lucide-react";

interface PhotoCaptureStepProps {
  mediaFile: File | null;
  onSelectMedia: (file: File | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export const PhotoCaptureStep: React.FC<PhotoCaptureStepProps> = ({
  mediaFile,
  onSelectMedia,
  onNext,
  onBack,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => {
    if (mediaFile) {
      return URL.createObjectURL(mediaFile);
    }
    return null;
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFile = (file?: File) => {
    setErrorMsg(null);
    if (!file) return;

    // Validate size (10 MB backend limit)
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setErrorMsg("Image exceeds the 10 MB limit. Please select a smaller photo.");
      return;
    }

    // Validate MIME format
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setErrorMsg("Supported formats are JPEG, PNG, or WebP.");
      return;
    }

    onSelectMedia(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleProcessFile(file);
  };

  const handleRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    onSelectMedia(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-3.5 sm:p-6 shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-brand-text">Show us what you saw</h2>
            <p className="text-xs sm:text-sm text-brand-secondary mt-1">
              A photo preserves the exact water condition at the moment of your observation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWhy(!showWhy)}
            className="inline-flex items-center space-x-1 text-xs text-brand-teal hover:text-brand-dark transition-colors shrink-0"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Why photo matters?</span>
          </button>
        </div>

        {showWhy && (
          <div className="mt-4 p-3.5 bg-brand-light/40 border border-brand-teal/20 rounded-lg text-xs text-brand-dark leading-relaxed">
            <strong>Why your photo matters:</strong> Your original image becomes part of the permanent evidence record. Researchers can review actual visible surface features, discoloration, and patterns later without relying solely on automated text or memory.
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 border border-brand-error/30 rounded-lg text-xs text-brand-error font-medium">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Main Upload / Preview Area */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-3.5 sm:p-6 shadow-xs">
        {!previewUrl ? (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center border-2 border-dashed border-brand-border hover:border-brand-teal rounded-2xl p-6 sm:p-10 cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition-all text-center group"
            >
              <div className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center text-brand-teal group-hover:scale-110 transition-transform mb-3">
                <Camera className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-brand-text">
                Tap to take a photo or select an image
              </p>
              <p className="text-xs text-brand-secondary mt-1">
                JPEG, PNG, or WebP &middot; Max 10 MB
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-brand-dark bg-brand-light hover:bg-brand-light/80 border border-brand-border transition-colors"
              >
                <Camera className="w-4 h-4 text-brand-teal" />
                <span>Take a Photo</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-brand-text bg-white hover:bg-gray-50 border border-brand-border transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-brand-secondary" />
                <span>Choose from Gallery</span>
              </button>
            </div>

            {/* Hidden native inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-brand-border bg-gray-900 flex items-center justify-center max-h-[350px]">
              <img
                src={previewUrl}
                alt="Selected evidence preview"
                className="max-h-[350px] w-auto object-contain"
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-brand-light/30 border border-brand-border rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-brand-success shrink-0" />
                <div>
                  <p className="text-xs font-bold text-brand-text truncate max-w-[220px] sm:max-w-md">
                    {mediaFile?.name}
                  </p>
                  <p className="text-[11px] text-brand-secondary">
                    {mediaFile ? (mediaFile.size / 1024 / 1024).toFixed(2) : 0} MB &middot; Ready for secure evidence ingestion
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemove}
                className="text-xs text-brand-error hover:underline shrink-0"
              >
                Change photo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col-reverse xs:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-brand-secondary hover:text-brand-text px-4 py-2 transition-colors self-start xs:self-auto"
        >
          &larr; Back
        </button>

        <div className="flex flex-col xs:flex-row items-center gap-2.5 sm:gap-3 w-full xs:w-auto">
          {!previewUrl && (
            <button
              type="button"
              onClick={onNext}
              className="text-xs font-semibold text-brand-secondary hover:text-brand-dark px-3 py-2 transition-colors text-center"
            >
              Skip photo for now &rarr;
            </button>
          )}

          <button
            type="button"
            onClick={onNext}
            className="w-full xs:w-auto inline-flex items-center justify-center space-x-2 px-5 sm:px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-brand-teal hover:bg-brand-dark transition-colors shadow-xs"
          >
            <span>{previewUrl ? "Continue with this photo" : "Continue to observation"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
