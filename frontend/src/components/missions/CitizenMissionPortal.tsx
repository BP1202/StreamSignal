import React, { useEffect, useState } from "react";
import { ContributorProfile, MissionItem } from "../../types/mission";
import {
  fetchCitizenMissions,
  fetchContributorProfile,
  startMission,
} from "../../api/missions";
import { fetchContributorContactRequests } from "../../api/contact";
import { ContributorIdentityBadge } from "./ContributorIdentityBadge";
import { AgentGuidedMissionFlow } from "./AgentGuidedMissionFlow";
import { CitizenContactRequestsModal } from "./CitizenContactRequestsModal";
import { MessageSquare, ChevronRight } from "lucide-react";

interface Props {
  onCaseCreated?: (caseId: string) => void;
  onGoToObserve?: () => void;
}

export const CitizenMissionPortal: React.FC<Props> = ({ onCaseCreated, onGoToObserve }) => {

  const [profile, setProfile] = useState<ContributorProfile | null>(null);
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [activeMission, setActiveMission] = useState<MissionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedCaseId, setSubmittedCaseId] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [pendingContactsCount, setPendingContactsCount] = useState(0);

  // Initialize or fetch persistent contributor identity
  useEffect(() => {
    const initContributor = async () => {
      try {
        const storedId = localStorage.getItem("streamsignal_contributor_id") || undefined;
        const p = await fetchContributorProfile(storedId);
        setProfile(p);
        localStorage.setItem("streamsignal_contributor_id", p.contributor_id);
      } catch (err: any) {
        console.error("Failed to load contributor profile:", err);
      }
    };
    initContributor();
  }, []);

  // Fetch real missions from backend
  const loadMissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchCitizenMissions(profile?.contributor_id);
      setMissions(res.missions);

      // Check for pending researcher inquiries
      if (profile?.contributor_id) {
        try {
          const inquiries = await fetchContributorContactRequests(profile.contributor_id);
          const pending = inquiries.filter((i) => i.status === "PENDING").length;
          setPendingContactsCount(pending);
        } catch {
          // Non-blocking inquiry check
        }
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load missions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      loadMissions();
    }
  }, [profile]);

  const handleStartMission = async (mission: MissionItem) => {
    if (!profile) return;
    try {
      setLoading(true);
      const started = await startMission(mission.id, profile.contributor_id);
      setActiveMission(started);
    } catch (err: any) {
      setError(err?.message || "Failed to start mission.");
    } finally {
      setLoading(false);
    }
  };

  const handleMissionSubmitted = (caseId: string) => {
    setSubmittedCaseId(caseId);
    setActiveMission(null);
    loadMissions();
    if (onCaseCreated) {
      onCaseCreated(caseId);
    }
  };

  if (activeMission && profile) {
    return (
      <AgentGuidedMissionFlow
        mission={activeMission}
        contributor={profile}
        onMissionUpdated={(updated) => setActiveMission(updated)}
        onMissionSubmitted={handleMissionSubmitted}
        onBack={() => setActiveMission(null)}
      />
    );
  }

  return (
    <div className="w-full max-w-screen-2xl mx-auto space-y-6 text-left">
      {/* Top Header & Contributor Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
        <div>
          <h1 className="text-xl font-bold text-brand-text flex items-center gap-2">
            <span>🎯</span> Citizen Evidence Missions
          </h1>
          <p className="text-xs text-brand-secondary mt-1">
            Targeted evidence-gathering missions requested by researchers and guided by the
            StreamSignal Evidence Mission Agent.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            className="text-xs font-semibold text-brand-text hover:text-brand-dark bg-brand-surface hover:bg-brand-light border border-brand-border px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
            <span>Communications</span>
            {pendingContactsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            )}
          </button>
          <ContributorIdentityBadge
            profile={profile}
            onProfileUpdated={(updated) => {
              setProfile(updated);
              localStorage.setItem("streamsignal_contributor_id", updated.contributor_id);
            }}
          />
        </div>
      </div>

      {/* Pending Researcher Contact Request Alert */}
      {pendingContactsCount > 0 && (
        <div className="p-4 rounded-xl bg-brand-light/60 border border-brand-border text-brand-dark flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs space-y-0.5">
            <span className="font-bold text-brand-dark flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-brand-teal" />
              Researcher Inquiry Awaiting Your Response ({pendingContactsCount})
            </span>
            <p className="text-brand-secondary">
              A researcher requested clarification or follow-up details on your observation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            className="text-xs font-semibold bg-brand-teal hover:bg-brand-dark text-white px-3.5 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Review Inquiries</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Submission Success Banner */}
      {submittedCaseId && (
        <div className="p-4 rounded-xl bg-brand-light/60 border border-brand-border text-brand-dark flex items-center justify-between">
          <div className="text-xs space-y-0.5">
            <span className="font-bold text-brand-dark block">
              🎉 Mission Completed & Evidence Submitted!
            </span>
            <span>
              Your evidence was handed off into SignalCase{" "}
              <code className="text-brand-teal font-mono font-bold">
                {submittedCaseId}
              </code>{" "}
              and is now active in the Research Workspace.
            </span>
          </div>
          <button
            onClick={() => setSubmittedCaseId(null)}
            className="text-xs text-brand-secondary hover:text-brand-text px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-brand-error text-xs flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-bold text-brand-error block">Evidence could not be loaded.</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadMissions}
            className="px-3 py-1.5 rounded-lg bg-brand-teal hover:bg-brand-dark text-white font-semibold transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Missions Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-brand-secondary animate-pulse">
          Loading evidence...
        </div>
      ) : missions.length === 0 ? (
        <div className="p-12 rounded-2xl bg-brand-surface border border-dashed border-brand-border text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-light flex items-center justify-center mx-auto text-2xl text-brand-teal">
            🌊
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-brand-text">
              No targeted missions are currently available.
            </h3>
            <p className="text-xs text-brand-secondary max-w-md mx-auto">
              Recommendations originate only from researcher-approved research needs that match active evidence gaps in your watershed.
            </p>
          </div>
          {onGoToObserve && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onGoToObserve}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-brand-teal hover:bg-cyan-600 text-white transition-all shadow-sm"
              >
                <span>Make an Observation</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {missions.map((m) => (
            <div
              key={m.id}
              className="p-3.5 sm:p-5 rounded-2xl bg-brand-surface border border-brand-border hover:border-brand-teal shadow-xs flex flex-col justify-between transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-dark bg-brand-light px-2 py-0.5 rounded border border-brand-border">
                    {m.mission_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] font-mono text-brand-secondary">
                    {m.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-brand-text">{m.title}</h3>
                  <p className="text-xs text-brand-secondary mt-1 line-clamp-2">
                    {m.purpose}
                  </p>
                </div>

                {/* Why this mission? */}
                <div className="p-3 rounded-xl bg-brand-bg border border-brand-border space-y-1.5 text-[11px]">
                  <span className="font-semibold text-brand-teal block">Why this mission?</span>
                  <ul className="text-brand-secondary space-y-1">
                    {(m.why_this_mission && m.why_this_mission.length > 0
                      ? m.why_this_mission
                      : [
                          `${(m.required_evidence[0] || "FLOW_CONDITION").toUpperCase()} is missing`,
                          "This research need is approved",
                          "Your selected area matches",
                          "You have not recently submitted this evidence",
                        ]
                    ).map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-brand-success font-bold">✓</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-brand-secondary border-t border-brand-border pt-1.5 leading-relaxed">
                    🛡 <em>Recommendation indicates evidence collection need only — not pollution or health risk.</em>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {m.required_evidence.map((req) => (
                    <span
                      key={req}
                      className="text-[10px] px-2 py-0.5 rounded bg-brand-light text-brand-dark border border-brand-border"
                    >
                      {req}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-brand-border flex items-center justify-between">
                <span className="text-[11px] text-brand-secondary">⏱ ~2–3 minutes</span>
                <button
                  onClick={() => handleStartMission(m)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-teal hover:bg-brand-dark text-white shadow-xs transition-all"
                >
                  Accept Mission →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Citizen Contact Requests Modal */}
      <CitizenContactRequestsModal
        contributorId={profile?.contributor_id}
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onRequestResponded={() => loadMissions()}
      />
    </div>
  );
};
