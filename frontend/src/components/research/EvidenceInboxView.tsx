import React, { useState, useEffect, useCallback } from "react";
import {
  ResearchInboxItem,
  ResearchInboxResponse,
  TriageAction,
  EvidenceQualityTier,
} from "../../types/research";
import { fetchResearchInbox } from "../../api/research";
import { ApiError } from "../../api/client";
import {
  useResearchRealtime,
  RealtimeEvent,
  SignalCaseCreatedPayload,
} from "../../api/websocket";
import {
  Inbox,
  Filter,
  CheckCircle2,
  Clock,
  MapPin,
  Image as ImageIcon,
  History,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowRight,
  ShieldCheck,
  Eye,
  Bell,
  Radio,
  X,
  Compass,
} from "lucide-react";
import { EvidenceGapIntelligencePanel } from "./EvidenceGapIntelligencePanel";
import { MissionNeedsTracker } from "./MissionNeedsTracker";

interface EvidenceInboxViewProps {
  onSelectCase: (caseId: string) => void;
  initialWorkspaceTab?: "inbox" | "gaps_and_needs";
}

export const EvidenceInboxView: React.FC<EvidenceInboxViewProps> = ({
  onSelectCase,
  initialWorkspaceTab = "inbox",
}) => {
  const [inboxData, setInboxData] = useState<ResearchInboxResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newCaseAlert, setNewCaseAlert] = useState<RealtimeEvent<SignalCaseCreatedPayload> | null>(null);

  // Sub-tabs
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"inbox" | "gaps_and_needs">(initialWorkspaceTab);

  useEffect(() => {
    setActiveWorkspaceTab(initialWorkspaceTab);
  }, [initialWorkspaceTab]);
  const [needsRefreshTrigger, setNeedsRefreshTrigger] = useState<number>(0);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [qualityFilter, setQualityFilter] = useState<string>("ALL");
  const [hasMedia, setHasMedia] = useState<boolean | undefined>(undefined);
  const [hasPatternEcho, setHasPatternEcho] = useState<boolean | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadInbox = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setError(null);
    try {
      const params: any = { limit: 50, offset: 0 };
      if (actionFilter !== "ALL") params.action = actionFilter;
      if (qualityFilter !== "ALL") params.quality_rating = qualityFilter;
      if (hasMedia !== undefined) params.has_media = hasMedia;
      if (hasPatternEcho !== undefined) params.has_pattern_echo = hasPatternEcho;

      const data = await fetchResearchInbox(params);

      // Deduplicate items deterministically by case_id
      const seen = new Set<string>();
      const uniqueItems = data.items.filter((item) => {
        if (seen.has(item.case_id)) return false;
        seen.add(item.case_id);
        return true;
      });
      setInboxData({ ...data, items: uniqueItems, total: uniqueItems.length });
      setLastSyncTime(new Date());
      setError(null);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load research evidence inbox.";
      setError(msg);
      setInboxData(null);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [actionFilter, qualityFilter, hasMedia, hasPatternEcho]);

  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Realtime Live Evidence Bridge hook
  const { connectionStatus, reconnect } = useResearchRealtime({
    onSignalCaseCreated: (event) => {
      setNewCaseAlert(event);
      loadInbox(false);
    },
    onEvidenceUpdated: () => {
      loadInbox(false);
    },
    onHumanReviewRecorded: () => {
      loadInbox(false);
    },
    onReconnect: () => {
      loadInbox(false);
    },
  });

  useEffect(() => {
    loadInbox(true);
  }, [loadInbox]);

  // Client-side text search within fetched batch
  const filteredItems = (inboxData?.items || []).filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const caseIdMatch = item.case_id.toLowerCase().includes(query);
    const descMatch = (item.description || "").toLowerCase().includes(query);
    const actionMatch = item.triage_action.toLowerCase().includes(query);
    const reasonsMatch = item.why_surfaced.some((r) =>
      r.summary.toLowerCase().includes(query)
    );
    return caseIdMatch || descMatch || actionMatch || reasonsMatch;
  });

  const getTriageBadge = (action: TriageAction) => {
    switch (action) {
      case "EXPERT_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
            <Eye className="w-3 h-3" /> EXPERT REVIEW
          </span>
        );
      case "FIELD_VERIFICATION":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <MapPin className="w-3 h-3" /> FIELD VERIFICATION
          </span>
        );
      case "REQUEST_MORE_EVIDENCE":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            <RefreshCw className="w-3 h-3" /> MORE EVIDENCE NEEDED
          </span>
        );
      case "MONITOR":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 border border-gray-200">
            <ShieldCheck className="w-3 h-3" /> MONITOR
          </span>
        );
    }
  };

  const getQualityBadge = (tier: EvidenceQualityTier) => {
    switch (tier) {
      case "COMPLETE":
        return (
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-sm">
            COMPLETE
          </span>
        );
      case "PARTIAL":
        return (
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-sm">
            PARTIAL
          </span>
        );
      case "INSUFFICIENT":
      default:
        return (
          <span className="text-[11px] font-semibold text-gray-700 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-sm">
            INSUFFICIENT
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Workspace Header */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-teal bg-brand-light px-2.5 py-0.5 rounded-full">
              Researcher Investigation Hub
            </span>
            <span className="text-xs text-brand-secondary">
              Deterministic Evidence Surface
            </span>
          </div>
          <h1 className="text-2xl font-bold text-brand-text tracking-tight">
            Research Evidence Workspace
          </h1>
          <p className="text-sm text-brand-secondary mt-1">
            Investigate surfaced SignalCases with transparent triage recommendations, deterministic Why-This-Case rationales, and SignalGuard trust boundaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Realtime Live Connection Indicator */}
          <div
            data-testid="live-indicator"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-white shadow-2xs"
          >
            {connectionStatus === "CONNECTED" && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700">● Live</span>
              </>
            )}
            {connectionStatus === "RECONNECTING" && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                <span className="text-amber-700">○ Reconnecting...</span>
              </>
            )}
            {connectionStatus === "CONNECTING" && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-blue-700">○ Connecting...</span>
              </>
            )}
            {connectionStatus === "DISCONNECTED" && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                <span className="text-gray-600">Live connection unavailable.</span>
                <span className="text-[10px] text-gray-500 font-mono">
                  Last synchronized: {lastSyncTime.toLocaleTimeString()}
                </span>
                <button
                  type="button"
                  onClick={reconnect}
                  className="px-2 py-0.5 bg-brand-dark hover:bg-slate-800 text-white rounded text-[10px] font-bold transition-colors ml-1"
                >
                  Reconnect
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => loadInbox(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-secondary hover:text-brand-text bg-gray-50 hover:bg-gray-100 border border-brand-border px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-brand-teal" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Workspace Sub-Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-b border-brand-border pb-3">
        <button
          onClick={() => setActiveWorkspaceTab("inbox")}
          className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeWorkspaceTab === "inbox"
              ? "bg-brand-dark text-white shadow-xs"
              : "bg-white text-brand-secondary hover:text-brand-text border border-brand-border"
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>SignalCase Inbox</span>
          {inboxData && !error && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                activeWorkspaceTab === "inbox"
                  ? "bg-brand-teal text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {inboxData.total}
            </span>
          )}
          {error && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
              Error
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveWorkspaceTab("gaps_and_needs")}
          className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeWorkspaceTab === "gaps_and_needs"
              ? "bg-brand-dark text-white shadow-xs"
              : "bg-white text-brand-secondary hover:text-brand-text border border-brand-border"
          }`}
        >
          <Compass className="w-4 h-4 text-sky-400" />
          <span>Evidence Gap Intelligence & Mission Needs</span>
        </button>
      </div>

      {/* TAB 2: Evidence Gap Intelligence & Mission Needs */}
      {activeWorkspaceTab === "gaps_and_needs" && (
        <div className="space-y-6">
          <EvidenceGapIntelligencePanel
            onNeedCreated={() => setNeedsRefreshTrigger((prev) => prev + 1)}
          />
          <MissionNeedsTracker refreshTrigger={needsRefreshTrigger} />
        </div>
      )}

      {/* TAB 1: SignalCase Inbox View */}
      {activeWorkspaceTab === "inbox" && (
        <>

      {/* Live New SignalCase Notification Card */}
      {newCaseAlert && (
        <div
          data-testid="new-evidence-alert"
          className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
        >
          <div className="flex items-start gap-3">
            <span className="p-2 bg-emerald-100 rounded-lg text-emerald-700 mt-0.5">
              <Bell className="w-5 h-5 animate-bounce" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-700 text-white px-2 py-0.5 rounded">
                  NEW EVIDENCE
                </span>
                <span className="font-mono text-xs font-bold text-emerald-950">
                  SS-{newCaseAlert.case_id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-brand-text font-semibold mt-1">
                A new SignalCase was received: {newCaseAlert.payload.title}
              </p>
              <p className="text-[11px] text-brand-secondary">
                Completeness:{" "}
                {newCaseAlert.payload.completeness_score != null
                  ? `${Math.round(newCaseAlert.payload.completeness_score * 100)}%`
                  : "Assessing"}{" "}
                • Media: {newCaseAlert.payload.media_count ?? 0} photo evidence attached
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => onSelectCase(newCaseAlert.case_id)}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
            >
              Open Case
            </button>
            <button
              onClick={() => setNewCaseAlert(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              title="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-brand-border p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Action Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-medium">
            <button
              onClick={() => setActionFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                actionFilter === "ALL"
                  ? "bg-brand-dark text-white font-semibold shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All Cases
            </button>
            <button
              onClick={() => setActionFilter("EXPERT_REVIEW")}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                actionFilter === "EXPERT_REVIEW"
                  ? "bg-red-700 text-white font-semibold shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Needs Review
            </button>
            <button
              onClick={() => setActionFilter("FIELD_VERIFICATION")}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                actionFilter === "FIELD_VERIFICATION"
                  ? "bg-amber-700 text-white font-semibold shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Field Verification
            </button>
            <button
              onClick={() => setActionFilter("REQUEST_MORE_EVIDENCE")}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                actionFilter === "REQUEST_MORE_EVIDENCE"
                  ? "bg-blue-700 text-white font-semibold shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Evidence Gap
            </button>
            <button
              onClick={() => setActionFilter("MONITOR")}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                actionFilter === "MONITOR"
                  ? "bg-gray-700 text-white font-semibold shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Routine Monitor
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search case, signal, or reason..."
              className="w-full text-xs pl-9 pr-3 py-1.5 border border-brand-border rounded-lg bg-gray-50 focus:bg-white focus:outline-brand-teal"
            />
          </div>
        </div>

        {/* Toggle Badges (Has Media / Has Pattern Echo) */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100 text-xs text-brand-secondary">
          <span className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">
            Toggles:
          </span>
          <button
            type="button"
            onClick={() => setHasMedia((prev) => (prev === true ? undefined : true))}
            className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
              hasMedia === true
                ? "bg-brand-light border-brand-teal text-brand-teal font-semibold"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Has Photo Evidence
          </button>

          <button
            type="button"
            onClick={() => setHasPatternEcho((prev) => (prev === true ? undefined : true))}
            className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
              hasPatternEcho === true
                ? "bg-purple-50 border-purple-300 text-purple-700 font-semibold"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Pattern Echo Matches
          </button>

          {(hasMedia !== undefined || hasPatternEcho !== undefined || actionFilter !== "ALL" || searchQuery) && (
            <button
              onClick={() => {
                setActionFilter("ALL");
                setQualityFilter("ALL");
                setHasMedia(undefined);
                setHasPatternEcho(undefined);
                setSearchQuery("");
              }}
              className="text-[11px] text-gray-500 hover:text-gray-800 underline ml-auto"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Main Inbox State Handling */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-brand-border p-12 text-center shadow-xs space-y-3">
          <RefreshCw className="w-8 h-8 text-brand-teal animate-spin mx-auto" />
          <h3 className="text-base font-semibold text-brand-text">
            Loading evidence...
          </h3>
          <p className="text-xs text-brand-secondary max-w-md mx-auto">
            Composing multi-layered evidence from citizen reports, Pillow visual observation extraction, Pattern Echo spatial clusters, and SignalGuard contracts.
          </p>
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h3 className="text-base font-semibold text-red-900">
            Evidence could not be loaded.
          </h3>
          <p className="text-xs text-red-700 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => loadInbox(true)}
            className="text-xs font-semibold text-white bg-red-700 hover:bg-red-800 px-4 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && filteredItems.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center space-y-3">
          <Inbox className="w-10 h-10 text-gray-400 mx-auto" />
          <h3 className="text-base font-semibold text-brand-text">
            No evidence has been recorded yet.
          </h3>
          <p className="text-xs text-brand-secondary max-w-md mx-auto">
            No evidence cases match the selected filters or search query. Try resetting filters or submitting a new observation from the Citizen flow.
          </p>
        </div>
      )}

      {/* Case Cards List */}
      {!isLoading && !error && filteredItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-brand-secondary px-1">
            <span>
              Showing <strong className="text-brand-text">{filteredItems.length}</strong> case{filteredItems.length === 1 ? "" : "s"}
            </span>
            <span className="text-[11px] text-gray-400">
              Sorted deterministically by Triage Priority & Context Strength
            </span>
          </div>

          {filteredItems.map((item) => {
            const shortId = `SS-${item.case_id.slice(0, 8).toUpperCase()}`;
            const pct = Math.round(item.completeness_score * 100);

            return (
              <div
                key={item.case_id}
                className="bg-white rounded-xl border border-brand-border hover:border-brand-teal/50 hover:shadow-md transition-all p-3.5 sm:p-5 space-y-4"
              >
                {/* Card Top: Identity & Action Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="font-mono text-xs font-bold bg-gray-100 text-brand-text px-2 py-1 rounded-md">
                      {shortId}
                    </span>
                    <span className="text-xs text-brand-secondary flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {new Date(item.observed_at).toLocaleString()}
                    </span>
                    <span className="text-xs text-brand-secondary flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
                    </span>
                  </div>

                  <div>{getTriageBadge(item.triage_action)}</div>
                </div>

                {/* Evidence Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 bg-gray-50/70 p-3 rounded-lg text-xs">
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase font-semibold block mb-0.5">
                      Completeness
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 h-1.5 rounded-full overflow-hidden shrink-0">
                        <div
                          className="bg-brand-teal h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-bold text-brand-text">{pct}%</span>
                      {getQualityBadge(item.quality_rating)}
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-500 text-[10px] uppercase font-semibold block mb-0.5">
                      Media Evidence
                    </span>
                    <span className="font-medium text-brand-text flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-brand-teal" />
                      {item.media_count} photo{item.media_count === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 text-[10px] uppercase font-semibold block mb-0.5">
                      Pattern Echo
                    </span>
                    <span className="font-medium text-brand-text flex items-center gap-1">
                      <History className="w-3.5 h-3.5 text-purple-600" />
                      {item.pattern_echo_count} historical match{item.pattern_echo_count === 1 ? "" : "es"}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 text-[10px] uppercase font-semibold block mb-0.5">
                      Human Review
                    </span>
                    <span className="font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-sm inline-block text-[11px]">
                      {item.human_decision_status}
                    </span>
                  </div>
                </div>

                {/* Description snippet if present */}
                {item.description && (
                  <p className="text-xs text-brand-secondary italic line-clamp-2">
                    "{item.description}"
                  </p>
                )}

                {/* Signature Feature: WHY THIS CASE SURFACED */}
                <div className="bg-brand-light/40 border border-brand-border/60 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-brand-dark uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" />
                      Why This Case Surfaced
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      deterministic-rationale
                    </span>
                  </div>

                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-brand-text">
                    {item.why_surfaced.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-brand-teal font-bold shrink-0">✓</span>
                        <div>
                          <span className="font-medium">{reason.summary}</span>
                          {reason.details && (
                            <span className="block text-[11px] text-brand-secondary mt-0.5">
                              {reason.details}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bottom CTA */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => onSelectCase(item.case_id)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-semibold bg-brand-teal hover:bg-brand-dark text-white px-4 py-2 rounded-lg transition-colors shadow-xs"
                  >
                    <span>Investigate Evidence Case</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
};
