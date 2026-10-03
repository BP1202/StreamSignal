import React, { useState } from "react";
import {
  ContributorProfile,
  MissionEvidenceSubmission,
  MissionItem,
} from "../../types/mission";
import {
  provideMissionEvidence,
  submitMission,
  validateMission,
} from "../../api/missions";

interface Props {
  mission: MissionItem;
  contributor: ContributorProfile;
  onMissionUpdated: (mission: MissionItem) => void;
  onMissionSubmitted: (caseId: string) => void;
  onBack: () => void;
}

export const AgentGuidedMissionFlow: React.FC<Props> = ({
  mission,
  contributor,
  onMissionUpdated,
  onMissionSubmitted,
  onBack,
}) => {
  const [description, setDescription] = useState(
    mission.collected_evidence?.description || ""
  );
  const [waterAppearance, setWaterAppearance] = useState(
    mission.collected_evidence?.water_appearance || ""
  );
  const [flowCondition, setFlowCondition] = useState(
    mission.collected_evidence?.flow_condition || ""
  );
  const [foamObserved, setFoamObserved] = useState<boolean>(
    mission.collected_evidence?.foam_observed ?? false
  );
  const [additionalNotes, setAdditionalNotes] = useState(
    mission.collected_evidence?.additional_notes || ""
  );
  const [photoUploaded, setPhotoUploaded] = useState<boolean>(
    Boolean(mission.collected_evidence?.photo)
  );
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextAction = mission.next_action;
  const isReadyForSubmission =
    mission.status === "READY_FOR_SUBMISSION" ||
    (nextAction && nextAction.action_type === "READY_FOR_SUBMISSION");

  const buildSubmission = (): MissionEvidenceSubmission => ({
    description: description.trim() || undefined,
    water_appearance: waterAppearance.trim() || undefined,
    flow_condition: flowCondition.trim() || undefined,
    foam_observed: foamObserved,
    additional_notes: additionalNotes.trim() || undefined,
    media_id: photoUploaded ? "mock-mission-media-uuid" : undefined,
    latitude: mission.target_latitude || 41.1579,
    longitude: mission.target_longitude || -8.6291,
  });

  const handleValidate = async () => {
    try {
      setValidating(true);
      setError(null);
      const sub = buildSubmission();
      const updated = await validateMission(
        mission.id,
        sub,
        contributor.contributor_id
      );
      onMissionUpdated(updated);
    } catch (err: any) {
      setError(err?.message || "Validation failed.");
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      // Ensure latest state validated
      const sub = buildSubmission();
      await provideMissionEvidence(
        mission.id,
        sub,
        contributor.contributor_id
      );
      const res = await submitMission(mission.id, contributor.contributor_id);
      onMissionSubmitted(res.case_id);
    } catch (err: any) {
      setError(err?.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoSimulated = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhotoUploaded(true);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 text-left">
      {/* Top Header & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-xs text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1 font-medium"
        >
          ← Back to Available Missions
        </button>
        <div className="text-xs text-slate-400 font-mono">
          Status: <strong className="text-cyan-400">{mission.status}</strong>
        </div>
      </div>

      {/* Mission Title Card */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-500 to-indigo-500 w-full" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] tracking-wider font-bold uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Active Evidence Mission
            </span>
            <h2 className="text-lg font-bold text-slate-100 mt-1">
              {mission.title}
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {mission.purpose}
            </p>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Research Objective
            </span>
            <span className="text-xs text-slate-300 font-medium max-w-xs">
              {mission.research_need}
            </span>
          </div>
        </div>
      </div>

      {/* AGENT GUIDANCE CARD */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 shadow-lg">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white text-lg shadow-md shrink-0">
            🤖
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                Evidence Mission Agent Guidance
              </h3>
              {nextAction && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
                  {nextAction.action_type}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-100">
              {nextAction?.user_message ||
                "Please review the required evidence dimensions below and attach observations."}
            </p>
            {nextAction?.micro_learning && (
              <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-200/90 leading-relaxed mt-2">
                💡 <strong className="text-indigo-100">Why this matters:</strong>{" "}
                {nextAction.micro_learning}
              </div>
            )}
          </div>
        </div>

        {/* Evidence Completion Status Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Required Dimensions:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {mission.required_evidence.map((dim) => {
                const isCollected =
                  !mission.missing_evidence?.includes(dim);
                return (
                  <span
                    key={dim}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${
                      isCollected
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                    }`}
                  >
                    {isCollected ? "✓" : "○"} {dim}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="text-slate-400 font-mono text-[11px]">
            Missing:{" "}
            <strong className="text-amber-400">
              {mission.missing_evidence?.length ?? 0}
            </strong>
          </div>
        </div>
      </div>

      {/* EVIDENCE COLLECTION FORM */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
          Observation & Physical Documentation
        </h3>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Water Appearance */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Apparent Water Clarity / Visual Cue
            </label>
            <select
              value={waterAppearance}
              onChange={(e) => setWaterAppearance(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="">Select visual cue...</option>
              <option value="clear">Clear (High Transparency)</option>
              <option value="turbid / cloudy">Turbid / Cloudy</option>
              <option value="green surface material">Green Surface Material / Algae</option>
              <option value="brownish discoloration">Brownish Discoloration</option>
              <option value="milky / gray discharge">Milky / Gray Discharge</option>
            </select>
          </div>

          {/* Flow Condition */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Stream Flow Condition
            </label>
            <div className="grid grid-cols-4 gap-2">
              {["Fast", "Moderate", "Slow", "Stagnant"].map((flow) => (
                <button
                  key={flow}
                  type="button"
                  onClick={() => setFlowCondition(flow.toLowerCase())}
                  className={`px-2 py-2 rounded-lg text-xs font-medium border text-center transition-all ${
                    flowCondition.toLowerCase() === flow.toLowerCase()
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-sm"
                      : "bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800"
                  }`}
                >
                  {flow}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Foam Observation Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
          <div>
            <span className="text-xs font-semibold text-slate-200 block">
              Noticeable Foam or Surface Scum?
            </span>
            <span className="text-[11px] text-slate-400">
              Distinguishes persistent organic or chemical surfactant from natural turbulence.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFoamObserved(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                foamObserved
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setFoamObserved(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                !foamObserved
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {/* Photo Upload Card */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200">
              Stream Photographic Evidence
            </label>
            {photoUploaded ? (
              <span className="text-xs text-emerald-400 font-medium">✓ Photo Attached</span>
            ) : (
              <span className="text-xs text-amber-400 font-medium">Photo Required</span>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoSimulated}
            className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cyan-600/20 file:text-cyan-300 hover:file:bg-cyan-600/30 cursor-pointer"
          />
        </div>

        {/* Description / Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Contextual Field Notes
          </label>
          <textarea
            rows={2}
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Document any odor, weather conditions, or nearby drainage outfalls..."
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleValidate}
            disabled={validating || submitting}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors disabled:opacity-50"
          >
            {validating ? "Validating..." : "🔍 Validate with Agent"}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-lg ${
              isReadyForSubmission
                ? "bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white animate-pulse"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            {submitting
              ? "Submitting to Research Workspace..."
              : isReadyForSubmission
              ? "🚀 Submit to Research Workspace"
              : "Save & Submit Evidence"}
          </button>
        </div>
      </div>
    </div>
  );
};
