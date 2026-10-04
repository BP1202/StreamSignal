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
    <div className="w-full max-w-5xl mx-auto space-y-6 text-left">
      {/* Top Header & Contributor Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>🎯</span> Citizen Evidence Missions
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Targeted evidence-gathering missions requested by researchers and guided by the
            StreamSignal Evidence Mission Agent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
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
        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-200 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs space-y-0.5">
            <span className="font-bold text-teal-100 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-teal-400" />
              Researcher Inquiry Awaiting Your Response ({pendingContactsCount})
            </span>
            <p className="text-teal-300/80">
              A researcher requested clarification or follow-up details on your observation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            className="text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white px-3.5 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Review Inquiries</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Submission Success Banner */}
      {submittedCaseId && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 flex items-center justify-between">
          <div className="text-xs space-y-0.5">
            <span className="font-bold text-emerald-100 block">
              🎉 Mission Completed & Evidence Submitted!
            </span>
            <span>
              Your evidence was handed off into SignalCase{" "}
              <code className="text-emerald-300 font-mono font-bold">
                {submittedCaseId}
              </code>{" "}
              and is now active in the Research Workspace.
            </span>
          </div>
          <button
            onClick={() => setSubmittedCaseId(null)}
            className="text-xs text-emerald-300 hover:text-white px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-bold text-rose-200 block">Evidence could not be loaded.</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadMissions}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Missions Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
          Loading evidence...
        </div>
      ) : missions.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-2xl text-slate-400">
            🌊
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-200">
              No targeted missions are currently available.
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
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
              className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-lg flex flex-col justify-between transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    {m.mission_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {m.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-100">{m.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {m.purpose}
                  </p>
                </div>

                {/* Why this mission? */}
                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1.5 text-[11px]">
                  <span className="font-semibold text-cyan-300 block">Why this mission?</span>
                  <ul className="text-slate-300 space-y-1">
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
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-slate-400 border-t border-slate-700/60 pt-1.5 leading-relaxed">
                    🛡 <em>Recommendation indicates evidence collection need only — not pollution or health risk.</em>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {m.required_evidence.map((req) => (
                    <span
                      key={req}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                    >
                      {req}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">⏱ ~2–3 minutes</span>
                <button
                  onClick={() => handleStartMission(m)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white shadow-md transition-all"
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
