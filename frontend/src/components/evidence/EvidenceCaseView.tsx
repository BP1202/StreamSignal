import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle,
  Clock,
  MapPin,
  FileText,
  Camera,
  Activity,
  UserCheck,
  Layers,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Radio,
} from "lucide-react";
import {
  EvidenceCaseResponse,
  TriageResponse,
  EvidenceQualityLevel,
} from "../../types/evidence_case";
import {
  useCitizenRealtime,
  CitizenImpactUpdatedPayload,
} from "../../api/websocket";
import { getReportImpactStatus } from "../../api/reports";

interface EvidenceCaseViewProps {
  evidenceCase: EvidenceCaseResponse;
  triage?: TriageResponse | null;
  onNewObservation: () => void;
}

export const EvidenceCaseView: React.FC<EvidenceCaseViewProps> = ({
  evidenceCase,
  triage,
  onNewObservation,
}) => {
  const [liveCitizenImpact, setLiveCitizenImpact] = useState<CitizenImpactUpdatedPayload | null>(null);

  const reportId = evidenceCase.report_id || evidenceCase.case_id;

  // Initial load of authoritative impact status from database
  useEffect(() => {
    if (!reportId) return;
    let isMounted = true;
    getReportImpactStatus(reportId)
      .then((res) => {
        if (isMounted && res) {
          setLiveCitizenImpact({
            workflow_status: res.status,
            citizen_label: res.status_label,
            safe_description: res.description,
          });
        }
      })
      .catch(() => {
        // Fall back gracefully to human_decision in evidenceCase
      });

    return () => {
      isMounted = false;
    };
  }, [reportId]);

  // Scoped Citizen WebSocket connection
  const { connectionStatus: citizenWsStatus } = useCitizenRealtime(
    reportId,
    {
      onCitizenImpactUpdated: (event) => {
        setLiveCitizenImpact(event.payload);
      },
    }
  );


  const { citizen_evidence, evidence_quality, machine_assistance, contextual_evidence, human_decision, provenance } = evidenceCase;

  const getQualityBadgeColor = (level: EvidenceQualityLevel) => {
    switch (level) {
      case "COMPLETE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "PARTIAL":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "INSUFFICIENT":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getTriageActionColor = (action?: string) => {
    switch (action) {
      case "EXPERT_REVIEW":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "REQUEST_MORE_EVIDENCE":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "FIELD_VERIFICATION":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "MONITOR":
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  const shortCaseId = evidenceCase.case_id.slice(0, 8).toUpperCase();

  return (
    <div className="space-y-6">
      {/* SignalCase Reward Header */}
      <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-teal">
                SignalCase Record
              </span>
              <span className="text-xs font-mono font-bold bg-brand-light text-brand-dark px-2.5 py-0.5 rounded">
                #{shortCaseId}
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-brand-text mt-1">
              Your observation is recorded.
            </h2>
            <p className="text-xs sm:text-sm text-brand-secondary mt-0.5">
              Your report is now an immutable, provenance-rich evidence case ready for researcher and community review.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${getQualityBadgeColor(
                evidence_quality.quality
              )}`}
            >
              Evidence Quality: {evidence_quality.quality} ({(evidence_quality.score * 100).toFixed(0)}%)
            </span>
            {liveCitizenImpact ? (
              <span
                data-testid="citizen-live-status-badge"
                className="text-xs font-bold px-3 py-1 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200 flex items-center space-x-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{liveCitizenImpact.citizen_label}</span>
              </span>
            ) : (
              <span className="text-xs font-bold px-3 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Awaiting human review</span>
              </span>
            )}
          </div>
        </div>

        {/* SignalGuard Trust Banner */}
        <div className="p-4 bg-brand-light/40 border border-brand-teal/20 rounded-xl flex items-start space-x-3 text-xs text-brand-dark">
          <ShieldCheck className="w-5 h-5 text-brand-teal shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-brand-text">SignalGuard Evidence Trust Active</p>
            <p className="text-[11px] text-brand-secondary leading-relaxed">
              StreamSignal strictly separates citizen observations, automated media observations, contextual data, and human decisions. Automated visual cues and historical similarity provide context and do not assert environmental causation, toxicity, or disease diagnosis.
            </p>
          </div>
        </div>

        {/* Realtime Citizen Status Card */}
        {liveCitizenImpact && (
          <div
            data-testid="citizen-live-impact-card"
            className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-2 animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-700 text-white px-2 py-0.5 rounded">
                  Live Research Update
                </span>
                <span className="text-xs font-bold text-emerald-950">
                  {liveCitizenImpact.citizen_label}
                </span>
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live update received
              </span>
            </div>
            <p className="text-xs text-brand-text font-medium leading-relaxed">
              {liveCitizenImpact.safe_description}
            </p>
            <p className="text-[11px] text-brand-secondary border-t border-emerald-100 pt-1.5">
              One Health Notice: Your observation contributed to a research workflow for deciding whether professional field verification is warranted. This does not establish pollution, toxicity, health risk, or environmental cause.
            </p>
          </div>
        )}
      </div>

      {/* Grid of Evidence Layers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Layer 1: Citizen Evidence (What You Reported) */}
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-brand-border pb-3">
            <FileText className="w-5 h-5 text-brand-teal" />
            <h3 className="font-bold text-brand-text text-sm">1. What You Reported (Citizen Evidence)</h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <span className="font-bold text-brand-secondary block mb-1">Your Observation:</span>
              <p className="text-brand-text text-sm bg-gray-50 p-3 rounded-xl border border-brand-border leading-relaxed font-medium">
                "{citizen_evidence.description}"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded-lg bg-gray-50 border border-brand-border">
                <span className="font-semibold text-brand-secondary flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Observation Time</span>
                </span>
                <span className="text-brand-text font-bold block mt-0.5">
                  {new Date(citizen_evidence.observation_time).toLocaleString()}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-gray-50 border border-brand-border">
                <span className="font-semibold text-brand-secondary flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span>Site Coordinates</span>
                </span>
                <span className="text-brand-text font-mono font-bold block mt-0.5">
                  {citizen_evidence.location.latitude.toFixed(5)}, {citizen_evidence.location.longitude.toFixed(5)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-brand-border">
              <div>
                <span className="font-semibold text-brand-secondary block">Appearance</span>
                <span className="text-brand-text capitalize font-medium">
                  {citizen_evidence.water_appearance?.replace(/_/g, " ") || "Not specified"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-brand-secondary block">Flow Condition</span>
                <span className="text-brand-text capitalize font-medium">
                  {citizen_evidence.flow_condition?.replace(/_/g, " ") || "Not specified"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-brand-secondary block">Odor</span>
                <span className="text-brand-text capitalize font-medium">
                  {citizen_evidence.odor?.replace(/_/g, " ") || "Not specified"}
                </span>
              </div>
            </div>

            <div className="pt-1 border-t border-brand-border flex flex-wrap gap-2">
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                citizen_evidence.foam_observed
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                Foam: {citizen_evidence.foam_observed ? "Observed" : "Not observed"}
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                citizen_evidence.litter_observed
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                Litter: {citizen_evidence.litter_observed ? "Observed" : "Not observed"}
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                citizen_evidence.dead_wildlife_observed
                  ? "bg-red-50 text-red-800 border-red-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                Dead Wildlife: {citizen_evidence.dead_wildlife_observed ? "Observed" : "Not observed"}
              </span>
            </div>

            {/* Attached Photo Evidence */}
            <div className="pt-2 border-t border-brand-border">
              <span className="font-bold text-brand-secondary flex items-center space-x-1 mb-2">
                <Camera className="w-3.5 h-3.5 text-brand-teal" />
                <span>Original Photographic Evidence ({(citizen_evidence.media?.length || 0)})</span>
              </span>
              {(citizen_evidence.media?.length || 0) > 0 ? (
                <div className="space-y-2">
                  {citizen_evidence.media.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl bg-gray-50 border border-brand-border space-y-1 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-brand-text truncate">{m.original_filename}</span>
                        <span className="text-brand-secondary font-medium">{(m.size_bytes / 1024).toFixed(1)} KB</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-400 font-mono text-[10px]">
                        <span>Integrity SHA-256:</span>
                        <span className="truncate">{m.sha256}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No media attached to this observation.</p>
              )}
            </div>
          </div>
        </div>

        {/* Layer 2: Evidence Quality (Completeness Profile) */}
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-brand-border pb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-brand-teal" />
              <h3 className="font-bold text-brand-text text-sm">2. Evidence Completeness Profile</h3>
            </div>
            <span className="text-xs font-bold text-brand-teal">
              {(evidence_quality.score * 100).toFixed(0)}% Documented
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-brand-teal h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, evidence_quality.score * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-brand-secondary mt-1.5 leading-relaxed">
                <strong>What this score means:</strong> Evidence completeness reflects the ratio of documented physical dimensions (e.g. coordinates, time, appearance, flow). It does <em>not</em> indicate pollution severity, toxic certainty, or environmental risk.
              </p>
            </div>

            <div>
              <span className="font-bold text-emerald-800 block mb-1.5">
                Documented Dimensions ({(evidence_quality.present?.length || 0)})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(evidence_quality.present || []).map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-semibold border border-emerald-200"
                  >
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    <span>{item.replace(/_/g, " ")}</span>
                  </span>
                ))}
              </div>
            </div>

            {(evidence_quality.missing?.length || 0) > 0 && (
              <div>
                <span className="font-bold text-amber-800 block mb-1.5">
                  Missing Dimensions ({(evidence_quality.missing?.length || 0)})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(evidence_quality.missing || []).map((item) => (
                    <span
                      key={item}
                      className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md text-[11px] font-semibold border border-amber-200"
                    >
                      {item.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(evidence_quality.recommendations?.length || 0) > 0 && (
              <div className="pt-2 border-t border-brand-border">
                <span className="font-bold text-brand-secondary block mb-1">Researcher Value Recommendations:</span>
                <ul className="list-disc pl-4 space-y-1 text-brand-secondary text-[11px]">
                  {(evidence_quality.recommendations || []).map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Layer 3: Machine Assistance & Contextual Evidence */}
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-brand-border pb-3">
            <Layers className="w-5 h-5 text-brand-teal" />
            <h3 className="font-bold text-brand-text text-sm">3. Machine & Contextual Evidence (Pattern Echo)</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="font-bold text-brand-secondary block mb-1">Automated Media Visual Signals:</span>
              {(machine_assistance.items?.length || 0) > 0 ? (
                <div className="space-y-1">
                  {(machine_assistance.items || []).map((item, idx) => (
                    <p key={idx} className="text-brand-text bg-gray-50 p-2.5 rounded-lg border border-brand-border font-medium">
                      {JSON.stringify(item)}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-brand-secondary italic bg-gray-50 p-3 rounded-xl border border-brand-border">
                  No automated visual machine assistance has been generated yet.
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-brand-border">
              <span className="font-bold text-brand-secondary block mb-1">
                Contextual Intelligence (Historical Matches):
              </span>
              {(contextual_evidence.items?.length || 0) > 0 ? (
                <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-brand-border">
                  <p className="text-brand-text font-bold text-xs">
                    Similar historical observations were found nearby.
                  </p>
                  <p className="text-[11px] text-brand-secondary leading-relaxed">
                    Historical similarity indicates recurring spatial and seasonal conditions. It does not establish that observations have the same environmental cause.
                  </p>
                </div>
              ) : (
                <p className="text-brand-secondary italic bg-gray-50 p-3 rounded-xl border border-brand-border">
                  No recurring historical clusters or nearby contextual matches identified.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Layer 4: Human Review & Provenance */}
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-brand-border pb-3">
            <UserCheck className="w-5 h-5 text-brand-teal" />
            <h3 className="font-bold text-brand-text text-sm">4. Human Decision & Case Provenance</h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <span className="font-bold text-brand-secondary block mb-1">Authorized Review State:</span>
              <div className="p-3 bg-gray-50 rounded-xl border border-brand-border space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                  {liveCitizenImpact
                    ? liveCitizenImpact.citizen_label
                    : human_decision.status === "pending" || human_decision.status === "pending_review"
                    ? "Awaiting human review"
                    : human_decision.status}
                </span>
                <p className="text-[11px] text-brand-secondary mt-1">
                  {liveCitizenImpact
                    ? liveCitizenImpact.safe_description
                    : human_decision.notes ||
                      "No human expert verification has been recorded yet. The observation is queued for workflow triage."}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-brand-border text-[11px] text-brand-secondary space-y-1.5">
              <p>
                <strong className="text-brand-text">Data System Source:</strong> {provenance.source}
              </p>
              <p>
                <strong className="text-brand-text">Case Generated:</strong>{" "}
                {new Date(provenance.generated_at).toLocaleString()}
              </p>
              <p>
                <strong className="text-brand-text">Integrated Lineage:</strong>{" "}
                {provenance.components.join(", ")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Triage / Workflow Next-Action Guidance */}
      {triage && (
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-brand-border pb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-brand-warning" />
              <h3 className="font-bold text-brand-text text-sm">
                What happens next? (Workflow Guidance)
              </h3>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getTriageActionColor(triage.recommended_action)}`}>
              Action: {triage.recommended_action.replace(/_/g, " ")}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-bold text-brand-secondary block mb-1">Decision Explanations:</span>
              <ul className="list-disc pl-4 space-y-1 text-brand-text">
                {triage.explanation.map((exp, idx) => (
                  <li key={idx}>{exp}</li>
                ))}
              </ul>
            </div>

            <div>
              <span className="font-bold text-brand-secondary block mb-1">Scientific Boundaries:</span>
              <ul className="list-disc pl-4 space-y-1 text-brand-secondary text-[11px]">
                {triage.limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Reset / Submit New Observation */}
      <div className="flex justify-center pt-4">
        <button
          type="button"
          onClick={onNewObservation}
          className="inline-flex items-center space-x-2 px-8 py-3.5 rounded-xl text-sm font-bold text-white bg-brand-teal hover:bg-brand-dark transition-all shadow-xs hover:shadow"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Start Another Observation</span>
        </button>
      </div>
    </div>
  );
};
