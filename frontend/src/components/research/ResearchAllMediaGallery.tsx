import React, { useEffect, useState, useMemo } from "react";
import {
  Image as ImageIcon,
  Video,
  LoaderCircle,
  AlertCircle,
  RotateCw,
  Search,
  Filter,
  ExternalLink,
  MapPin,
  Calendar,
  Sparkles,
} from "lucide-react";
import { fetchAllCitizenMedia, fetchResearchCaseMedia } from "../../api/research";
import { CitizenMediaSummaryItem } from "../../types/research";

interface ResearchAllMediaGalleryProps {
  onSelectCase: (caseId: string) => void;
}

interface MediaCardProps {
  item: CitizenMediaSummaryItem;
  onSelectCase: (caseId: string) => void;
}

const MediaCard: React.FC<MediaCardProps> = ({ item, onSelectCase }) => {
  const [source, setSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const isVideo = item.content_type.startsWith("video/");

  useEffect(() => {
    let isCurrent = true;
    let objectUrl: string | null = null;
    setIsLoading(true);
    setError(null);
    setSource(null);

    fetchResearchCaseMedia(item.case_id, item.media_id)
      .then((blob) => {
        if (!isCurrent) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch((err: unknown) => {
        if (!isCurrent) return;
        setError(err instanceof Error ? err.message : "Failed to load binary.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.case_id, item.media_id, retryKey]);

  return (
    <article className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-xs transition-shadow hover:shadow-md flex flex-col">
      {/* Media Preview Box */}
      <div className="relative flex min-h-56 items-center justify-center bg-brand-bg p-2 sm:min-h-64 border-b border-brand-border">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-brand-secondary" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin text-brand-teal" />
            Loading preview…
          </div>
        ) : error ? (
          <div className="p-4 text-center space-y-2">
            <AlertCircle className="mx-auto h-6 w-6 text-brand-error" />
            <p className="text-xs text-brand-secondary break-words">{error}</p>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded border border-brand-border bg-white text-brand-dark hover:bg-brand-light"
            >
              <RotateCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        ) : isVideo && source ? (
          <video
            src={source}
            controls
            playsInline
            preload="metadata"
            className="max-h-60 w-full object-contain rounded-lg"
            aria-label={`Citizen video: ${item.original_filename}`}
          />
        ) : source ? (
          <img
            src={source}
            alt={`Citizen image: ${item.original_filename}`}
            className="max-h-60 w-full object-contain rounded-lg"
            loading="lazy"
          />
        ) : null}

        {/* Type Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-semibold">
          {isVideo ? <Video className="w-3 h-3 text-cyan-400" /> : <ImageIcon className="w-3 h-3 text-teal-400" />}
          <span>{isVideo ? "Video Evidence" : "Photo Evidence"}</span>
        </div>
      </div>

      {/* Meta & Case Details */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-brand-text truncate" title={item.original_filename}>
              {item.original_filename}
            </p>
            <span className="text-[10px] font-mono text-brand-secondary shrink-0">
              {(item.size_bytes / 1024).toFixed(1)} KB
            </span>
          </div>

          {item.report_description && (
            <p className="text-xs text-brand-secondary line-clamp-2 italic">
              "{item.report_description}"
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 text-[10px]">
            {item.water_appearance && (
              <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-900 border border-teal-200 font-medium">
                {item.water_appearance}
              </span>
            )}
            {item.flow_condition && (
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-medium">
                {item.flow_condition}
              </span>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-brand-border space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-brand-secondary">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(item.created_at).toLocaleDateString()}
            </span>
            {item.latitude !== null && item.longitude !== null && (
              <span className="flex items-center gap-1 font-mono">
                <MapPin className="w-3 h-3" />
                {item.latitude?.toFixed(2)}, {item.longitude?.toFixed(2)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelectCase(item.case_id)}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-brand-light text-brand-dark hover:bg-brand-teal hover:text-white transition-colors"
          >
            <span>Investigate Case (SS-{item.case_id.slice(0, 8)})</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </article>
  );
};

export const ResearchAllMediaGallery: React.FC<ResearchAllMediaGalleryProps> = ({ onSelectCase }) => {
  const [mediaList, setMediaList] = useState<CitizenMediaSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "image" | "video">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadMedia = () => {
    setIsLoading(true);
    setError(null);
    fetchAllCitizenMedia({
      media_type: filterType === "all" ? undefined : filterType,
      limit: 100,
    })
      .then((res) => {
        setMediaList(res.items || []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load citizen media files.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadMedia();
  }, [filterType]);

  const filteredMedia = useMemo(() => {
    if (!searchQuery.trim()) return mediaList;
    const q = searchQuery.toLowerCase();
    return mediaList.filter(
      (m) =>
        m.original_filename.toLowerCase().includes(q) ||
        m.case_id.toLowerCase().includes(q) ||
        (m.report_description && m.report_description.toLowerCase().includes(q))
    );
  }, [mediaList, searchQuery]);

  return (
    <div className="space-y-6 text-left w-full max-w-screen-2xl mx-auto py-4">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-brand-border p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-brand-teal" />
              <span>Researcher Workspace · Evidence Surveillance</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-brand-text">
              All Citizen Uploaded Media
            </h1>
            <p className="text-xs sm:text-sm text-brand-secondary max-w-2xl">
              Original, unmodified photographs and video evidence submitted by community observers across all urban catchments. Served under authorized researcher scrutiny.
            </p>
          </div>

          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-brand-teal">
              {filteredMedia.length}
            </span>
            <p className="text-[11px] text-brand-secondary">files available</p>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search filename, case UUID, cue…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-brand-border bg-gray-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <Filter className="w-3.5 h-3.5 text-brand-secondary mr-1" />
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterType === "all"
                  ? "bg-brand-dark text-white shadow-xs"
                  : "bg-gray-100 text-brand-secondary hover:text-brand-text"
              }`}
            >
              All Media
            </button>
            <button
              type="button"
              onClick={() => setFilterType("image")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                filterType === "image"
                  ? "bg-brand-dark text-white shadow-xs"
                  : "bg-gray-100 text-brand-secondary hover:text-brand-text"
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>Images</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType("video")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                filterType === "video"
                  ? "bg-brand-dark text-white shadow-xs"
                  : "bg-gray-100 text-brand-secondary hover:text-brand-text"
              }`}
            >
              <Video className="w-3 h-3" />
              <span>Videos</span>
            </button>
          </div>
        </div>
      </div>

      {/* Epistemic Boundary Notice */}
      <div className="p-3.5 rounded-xl bg-cyan-50/70 border border-cyan-100 flex items-start gap-3 text-xs text-cyan-950">
        <AlertCircle className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>One Health Evidence Boundary:</strong> Citizen media files record visual and physical conditions at the documented time and location. They do not constitute certified laboratory toxicity or pathogen confirmation without expert triage and field sampling.
        </p>
      </div>

      {/* Content Grid / Loading / Error */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-brand-border p-12 text-center shadow-xs space-y-3">
          <LoaderCircle className="w-8 h-8 text-brand-teal animate-spin mx-auto" />
          <h3 className="text-sm font-semibold text-brand-text">Loading citizen media files…</h3>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <p className="text-sm font-semibold text-red-900">{error}</p>
          <button
            type="button"
            onClick={loadMedia}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-red-700 text-white hover:bg-red-800 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-brand-border p-12 text-center shadow-xs space-y-2">
          <ImageIcon className="w-10 h-10 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-brand-text">No citizen media found</h3>
          <p className="text-xs text-brand-secondary max-w-md mx-auto">
            {searchQuery
              ? "No files match your search query."
              : "No photos or videos have been uploaded yet. When citizens submit observations with photos or videos, they appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredMedia.map((item) => (
            <MediaCard key={item.media_id} item={item} onSelectCase={onSelectCase} />
          ))}
        </div>
      )}
    </div>
  );
};
