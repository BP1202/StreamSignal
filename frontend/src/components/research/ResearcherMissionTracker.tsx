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

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
            <span>🎯</span> Evidence Missions & Citizen Collaboration
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Targeted evidence-gathering tasks assigned to citizen observers.
          </p>
        </div>

        {caseId && (
          <button
            onClick={handlePlanFromGap}
            disabled={planning}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 transition-colors disabled:opacity-50"
          >
            {planning ? "Agent Planning..." : "+ Plan Mission from Evidence Gap"}
          </button>
        )}
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-6 text-center text-xs text-slate-400 animate-pulse">
          Loading missions...
        </div>
      ) : missions.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400 bg-slate-800/40 rounded-xl border border-dashed border-slate-800">
          No missions currently linked {caseId ? "to this case" : "in the system"}.
        </div>
      ) : (
        <div className="space-y-3">
          {missions.map((m) => (
            <div
              key={m.id}
              className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    {m.mission_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs font-semibold text-slate-200">
                    {m.title}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  <strong className="text-slate-300">Status:</strong> {m.status} •{" "}
                  <strong className="text-slate-300">Missing:</strong>{" "}
                  {m.missing_evidence?.length ? m.missing_evidence.join(", ") : "None"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {m.signal_case_id && onCaseSelected && (
                  <button
                    onClick={() => onCaseSelected(m.signal_case_id!)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-mono"
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
