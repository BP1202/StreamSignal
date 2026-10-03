import React, { useEffect, useState } from "react";
import { ContributorProfile, MissionItem } from "../../types/mission";
import {
  fetchCitizenMissions,
  fetchContributorProfile,
  startMission,
} from "../../api/missions";
import { ContributorIdentityBadge } from "./ContributorIdentityBadge";
import { AgentGuidedMissionFlow } from "./AgentGuidedMissionFlow";

interface Props {
  onCaseCreated?: (caseId: string) => void;
}

export const CitizenMissionPortal: React.FC<Props> = ({ onCaseCreated }) => {
  const [profile, setProfile] = useState<ContributorProfile | null>(null);
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [activeMission, setActiveMission] = useState<MissionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedCaseId, setSubmittedCaseId] = useState<string | null>(null);

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
        <ContributorIdentityBadge
          profile={profile}
          onProfileUpdated={(updated) => {
            setProfile(updated);
            localStorage.setItem("streamsignal_contributor_id", updated.contributor_id);
          }}
        />
      </div>

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
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Missions Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
          Loading available evidence collection missions...
        </div>
      ) : missions.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-2xl text-slate-400">
            🌊
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-200">
              No Active Evidence Missions
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              There are currently no open evidence missions in this watershed. Missions are
              automatically planned after rain events or when researchers identify specific
              evidence gaps in existing cases.
            </p>
          </div>
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

                <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-300">
                  <strong className="text-slate-200">Research Need:</strong> {m.research_need}
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
                <span className="text-[11px] text-slate-500">⏱ ~3 minutes</span>
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
    </div>
  );
};
