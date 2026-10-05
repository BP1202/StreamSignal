import React, { useEffect, useState } from "react";
import { AlertCircle, Image as ImageIcon, LoaderCircle, RotateCw, Video } from "lucide-react";
import { fetchResearchCaseMedia } from "../../api/research";
import { ResearchMediaAttachment } from "../../types/research";

interface Props {
  caseId: string;
  media: ResearchMediaAttachment[];
}

interface MediaItemProps {
  caseId: string;
  item: ResearchMediaAttachment;
}

const MediaItem: React.FC<MediaItemProps> = ({ caseId, item }) => {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const isVideo = item.content_type.startsWith("video/");

  useEffect(() => {
    let isCurrent = true;
    let objectUrl: string | null = null;
    setIsLoading(true);
    setError(null);
    setSource(null);

    fetchResearchCaseMedia(caseId, item.media_id)
      .then((blob) => {
        if (!isCurrent) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch((cause: unknown) => {
        if (!isCurrent) return;
        setError(cause instanceof Error ? cause.message : "This media file could not be loaded.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [caseId, item.media_id, retryKey]);

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
      <div className="flex min-h-64 items-center justify-center bg-brand-bg p-2 sm:min-h-80">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-brand-secondary" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin text-brand-teal" />
            Loading original media…
          </div>
        ) : error ? (
          <div className="max-w-md space-y-3 p-6 text-center" role="alert">
            <AlertCircle className="mx-auto h-8 w-8 text-brand-error" />
            <p className="text-sm font-semibold text-brand-text">Media could not be loaded</p>
            <p className="break-words text-xs text-brand-secondary">{error}</p>
            <button
              type="button"
              onClick={() => setRetryKey((value) => value + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-white px-3 py-2 text-xs font-semibold text-brand-dark hover:bg-brand-light"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : source && isVideo ? (
          <video
            src={source}
            controls
            playsInline
            preload="metadata"
            className="max-h-[480px] w-full object-contain"
            aria-label={`Citizen-submitted video: ${item.original_filename}`}
            onError={() => setError("The browser could not decode this video file.")}
          />
        ) : source ? (
          <img
            src={source}
            alt={`Citizen-submitted image: ${item.original_filename}`}
            className="max-h-[480px] w-full object-contain"
            onError={() => setError("The browser could not display this image file.")}
          />
        ) : null}
      </div>
      <div className="space-y-2 border-t border-brand-border p-3.5 sm:p-4">
        <div className="flex min-w-0 items-center gap-2">
          {isVideo ? (
            <Video className="h-4 w-4 shrink-0 text-brand-teal" />
          ) : (
            <ImageIcon className="h-4 w-4 shrink-0 text-brand-teal" />
          )}
          <p className="truncate text-sm font-semibold text-brand-text" title={item.original_filename}>
            {item.original_filename}
          </p>
        </div>
        <p className="text-xs text-brand-secondary">
          Uploaded: {new Date(item.created_at).toLocaleString()}
        </p>
        <p className="text-xs text-brand-secondary">Source: Citizen observation</p>
        <p className="border-t border-brand-border pt-2 text-xs text-brand-secondary">
          Boundary: Media documents the submitted observation only; it does not establish pollution, toxicity, or cause.
        </p>
      </div>
    </article>
  );
};

export const ResearchMediaGallery: React.FC<Props> = ({ caseId, media }) => {
  if (media.length === 0) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-brand-border bg-brand-surface p-3.5 shadow-xs sm:p-5" aria-labelledby="citizen-media-heading">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-brand-border pb-3">
        <div>
          <h2 id="citizen-media-heading" className="text-base font-bold text-brand-text">
            Original citizen media
          </h2>
          <p className="mt-0.5 text-xs text-brand-secondary">
            {media.length} attached file{media.length === 1 ? "" : "s"} · served through researcher authorization
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        {media.map((item) => (
          <MediaItem key={item.media_id} caseId={caseId} item={item} />
        ))}
      </div>
    </section>
  );
};
