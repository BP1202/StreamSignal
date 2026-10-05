import React, { useEffect, useState } from "react";
import { Camera, Video, X, CheckCircle2, ArrowRight, HelpCircle, Image as ImageIcon } from "lucide-react";

interface PhotoCaptureStepProps {
  mediaFiles: File[];
  onSelectMedia: (files: File[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const PhotoCaptureStep: React.FC<PhotoCaptureStepProps> = ({
  mediaFiles,
  onSelectMedia,
  onNext,
  onBack,
}) => {
  const [previewItems, setPreviewItems] = useState<Array<{ file: File; url: string }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState<boolean>(false);

  useEffect(() => {
    const nextPreviews = mediaFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setPreviewItems(nextPreviews);
    return () => nextPreviews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [mediaFiles]);

  const handleProcessFiles = (files?: FileList | File[]) => {
    setErrorMsg(null);
    if (!files || files.length === 0) return;

    const selectedFiles = Array.from(files);
    if (mediaFiles.length + selectedFiles.length > 5) {
      setErrorMsg("You can attach up to 5 photos or videos to one observation.");
      return;
    }

    const MAX_BYTES = 10 * 1024 * 1024;
    const allowedTypes = [
      "image/jpeg", "image/png", "image/webp",
      "video/mp4", "video/quicktime", "video/webm",
    ];
    const unsupported = selectedFiles.find((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const extensionType: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
        mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
      };
      return !allowedTypes.includes(file.type || extensionType[extension || ""] || "");
    });
    if (unsupported) {
      setErrorMsg("Supported formats are JPEG, PNG, WebP, MP4, MOV, and WebM.");
      return;
    }

    if (selectedFiles.some((file) => file.size > MAX_BYTES)) {
      setErrorMsg("Each photo or video must be 10 MB or smaller.");
      return;
    }

    onSelectMedia([...mediaFiles, ...selectedFiles]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleProcessFiles(e.target.files || undefined);
    e.target.value = "";
  };

  const handleRemove = (removeIndex: number) => {
    onSelectMedia(mediaFiles.filter((_, index) => index !== removeIndex));
    setErrorMsg(null);
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-3.5 sm:p-6 shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-brand-text">Show us what you saw</h2>
            <p className="text-xs sm:text-sm text-brand-secondary mt-1">
              Attach up to five original photos or short videos. Files are uploaded with your observation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWhy(!showWhy)}
            className="inline-flex items-center space-x-1 text-xs text-brand-teal hover:text-brand-dark transition-colors shrink-0"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Why media matters?</span>
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
        {mediaFiles.length === 0 ? (
          <div className="space-y-4">
            <label
              htmlFor="citizen-media-gallery"
              className="w-full flex flex-col items-center justify-center border-2 border-dashed border-brand-border hover:border-brand-teal rounded-2xl p-6 sm:p-10 cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition-all text-center group"
            >
              <div className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center text-brand-teal group-hover:scale-110 transition-transform mb-3">
                <Camera className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-brand-text">
                Take a photo/video or select multiple files
              </p>
              <p className="text-xs text-brand-secondary mt-1">
                JPEG, PNG, WebP, MP4, MOV, or WebM &middot; Max 10 MB each
              </p>
            </label>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <label
                htmlFor="citizen-media-photo-camera"
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-brand-dark bg-brand-light hover:bg-brand-light/80 border border-brand-border transition-colors"
              >
                <Camera className="w-4 h-4 text-brand-teal" />
                <span>Take a Photo</span>
              </label>

              <label
                htmlFor="citizen-media-video-camera"
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-brand-dark bg-brand-light hover:bg-brand-light/80 border border-brand-border transition-colors"
              >
                <Video className="w-4 h-4 text-brand-teal" />
                <span>Record a Video</span>
              </label>

              <label
                htmlFor="citizen-media-gallery"
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-brand-text bg-white hover:bg-gray-50 border border-brand-border transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-brand-secondary" />
                <span>Choose from Gallery</span>
              </label>
            </div>

          </div>
        ) : (
          <div className="space-y-4">
            <div className={`grid grid-cols-1 gap-4 ${previewItems.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {previewItems.map(({ file, url }, index) => {
                const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
                return (
                  <article key={`${file.name}-${file.lastModified}-${index}`} className="overflow-hidden rounded-xl border border-brand-border bg-brand-bg">
                    <div className="relative flex h-48 items-center justify-center bg-brand-bg">
                      {isVideo ? (
                        <video src={url} controls playsInline className="h-full w-full object-contain" aria-label={`Selected video preview: ${file.name}`} />
                      ) : (
                        <img src={url} alt={`Selected photo preview: ${file.name}`} className="h-full w-full object-contain" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemove(index)}
                        className="absolute right-2 top-2 rounded-full bg-brand-dark p-1.5 text-white hover:bg-brand-teal"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 p-3">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-success" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-brand-text">{file.name}</p>
                        <p className="text-[11px] text-brand-secondary">
                          {isVideo ? "Video" : "Photo"} · {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {mediaFiles.length < 5 && (
              <div className="flex flex-wrap justify-center gap-2">
                <label htmlFor="citizen-media-photo-camera" className="rounded-lg border border-brand-border bg-white px-3 py-2 text-xs font-semibold text-brand-text hover:bg-brand-bg cursor-pointer">
                  <Camera className="mr-1.5 inline h-4 w-4" />Add photo
                </label>
                <label htmlFor="citizen-media-video-camera" className="rounded-lg border border-brand-border bg-white px-3 py-2 text-xs font-semibold text-brand-text hover:bg-brand-bg cursor-pointer">
                  <Video className="mr-1.5 inline h-4 w-4" />Add video
                </label>
                <label htmlFor="citizen-media-gallery" className="rounded-lg border border-brand-border bg-white px-3 py-2 text-xs font-semibold text-brand-text hover:bg-brand-bg cursor-pointer">
                  <ImageIcon className="mr-1.5 inline h-4 w-4" />Choose more files
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Keep the native pickers mounted while the preview list changes. */}
      <input
        id="citizen-media-gallery"
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
        multiple
        onChange={handleFileChange}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-20 focus:z-50 focus:rounded focus:bg-white focus:p-2"
      />
      <input
        id="citizen-media-photo-camera"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-20 focus:z-50 focus:rounded focus:bg-white focus:p-2"
      />
      <input
        id="citizen-media-video-camera"
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-20 focus:z-50 focus:rounded focus:bg-white focus:p-2"
      />

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
          {mediaFiles.length === 0 && (
            <button
              type="button"
              onClick={onNext}
              className="text-xs font-semibold text-brand-secondary hover:text-brand-dark px-3 py-2 transition-colors text-center"
            >
              Skip media for now &rarr;
            </button>
          )}

          <button
            type="button"
            onClick={onNext}
            className="w-full xs:w-auto inline-flex items-center justify-center space-x-2 px-5 sm:px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-brand-teal hover:bg-brand-dark transition-colors shadow-xs"
          >
            <span>{mediaFiles.length > 0 ? `Continue with ${mediaFiles.length} file${mediaFiles.length === 1 ? "" : "s"}` : "Continue to observation"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
