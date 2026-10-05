import React, { useEffect, useState } from "react";
import { MissionItem } from "../../types/mission";
import {
  fetchResearcherMissions,
  planMissionFromGap,
} from "../../api/missions";

interface Props {
  caseId?: string;
  onCaseSelected?: (caseId: string) => void;
}

export const ResearcherMissionTracker: React.FC<Props> = ({
  caseId,
  onCaseSelected,
}) => {
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchResearcherMissions(caseId);
      setMissions(res.missions);
    } catch (err: any) {
      setError(err?.message || "Failed to load missions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMissions();
  }, [caseId]);

  const handlePlanFromGap = async () => {
    if (!caseId) return;
    try {
      setPlanning(true);
      setError(null);
      await planMissionFromGap(caseId);
      await loadMissions();
    } catch (err: any) {
      setError(err?.message || "Failed to plan mission from case gap.");
    } finally {
      setPlanning(false);
    }
  };

  const hasActiveMission = missions.some(
    (m) => m.status !== "RESEARCH_REVIEW" && m.status !== "SUBMITTED"
  );

  return (
    <div className="p-5 rounded-2xl bg-brand-surface border border-brand-border shadow-xs space-y-4 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-brand-border">
        <div>
          <h3 className="text-sm font-bold text-brand-text flex items-center gap-1.5">
            <span>🎯</span> Evidence Missions & Citizen Collaboration
          </h3>
          <p className="text-xs text-brand-secondary mt-0.5">
            Targeted evidence-gathering tasks assigned to citizen observers.
          </p>
        </div>

        {caseId && (
          <button
            onClick={handlePlanFromGap}
            disabled={planning || hasActiveMission}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              hasActiveMission
                ? "bg-gray-100 text-brand-secondary border-brand-border cursor-not-allowed"
                : "bg-brand-light hover:bg-brand-light/80 text-brand-dark border border-brand-border"
            }`}
          >
            {planning
              ? "Agent Planning..."
              : hasActiveMission
              ? "✓ Active Mission Open"
              : "+ Plan Mission from Evidence Gap"}
          </button>
        )}
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-brand-error text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-6 text-center text-xs text-brand-secondary animate-pulse">
          Loading missions...
        </div>
      ) : missions.length === 0 ? (
        <div className="p-6 text-center text-xs text-brand-secondary bg-brand-bg rounded-xl border border-dashed border-brand-border">
          No missions currently linked {caseId ? "to this case" : "in the system"}.
        </div>
      ) : (
        <div className="space-y-3">
          {missions.map((m) => (
            <div
              key={m.id}
              className="p-3.5 rounded-xl bg-brand-bg border border-brand-border hover:border-brand-teal transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-dark bg-brand-light px-2 py-0.5 rounded border border-brand-border">
                    {m.mission_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs font-semibold text-brand-text">
                    {m.title}
                  </span>
                </div>
                <div className="text-[11px] text-brand-secondary">
                  <strong className="text-brand-text">Status:</strong> {m.status} •{" "}
                  <strong className="text-brand-text">Missing:</strong>{" "}
                  {m.missing_evidence?.length ? m.missing_evidence.join(", ") : "None"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {m.signal_case_id && onCaseSelected && (
                  <button
                    onClick={() => onCaseSelected(m.signal_case_id!)}
                    className="text-xs text-brand-teal hover:text-brand-dark font-mono"
                  >
                    View Case →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
