import React from "react";
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
} from "lucide-react";
import {
  EvidenceCaseResponse,
  TriageResponse,
  EvidenceQualityLevel,
} from "../../types/evidence_case";

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

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                Evidence Case Record
              </span>
              <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                {evidenceCase.case_id.slice(0, 8)}...
              </span>
            </div>
            <h2 className="text-xl font-bold text-brand-text mt-1">
              Urban Freshwater Evidence Case
            </h2>
            <p className="text-xs text-brand-secondary mt-0.5">
              Aggregated from citizen observation, attached media integrity, and deterministic completeness metrics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${getQualityBadgeColor(
                evidence_quality.quality
              )}`}
            >
              Quality: {evidence_quality.quality} ({(evidence_quality.score * 100).toFixed(0)}%)
            </span>
            {triage && (
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border ${getTriageActionColor(
                  triage.recommended_action
                )}`}
              >
                Action: {triage.recommended_action.replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>

        {/* Safety Boundary Banner */}
        <div className="mt-4 p-3.5 bg-brand-light/40 border border-brand-teal/20 rounded-lg flex items-start space-x-3 text-xs text-brand-dark">
          <ShieldCheck className="w-5 h-5 text-brand-teal shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-brand-text">SignalGuard Evidence Trust Contract Active</p>
            <p className="text-[11px] text-brand-secondary leading-relaxed">
              This case preserves strict separation between observed facts, machine assistance, and expert decisions. Machine suggestions and similarity indicators do not assert environmental causation, toxicity, or disease diagnosis.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Citizen Evidence */}
        <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-brand-border pb-3">
            <FileText className="w-5 h-5 text-brand-teal" />
            <h3 className="font-semibold text-brand-text">1. Citizen Evidence (Primary)</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="font-semibold text-brand-secondary block">Description:</span>
              <p className="text-brand-text mt-0.5 text-sm bg-gray-50 p-2.5 rounded-lg border border-brand-border">
                {citizen_evidence.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="font-semibold text-brand-secondary flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Observation Time</span>
                </span>
                <span className="text-brand-text font-medium">
                  {new Date(citizen_evidence.observation_time).toLocaleString()}
                </span>
              </div>

              <div>
                <span className="font-semibold text-brand-secondary flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span>Coordinates</span>
                </span>
                <span className="text-brand-text font-mono">
                  {citizen_evidence.location.latitude.toFixed(5)}, {citizen_evidence.location.longitude.toFixed(5)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brand-border">
              <div>
                <span className="font-semibold text-brand-secondary block">Appearance</span>
                <span className="text-brand-text capitalize">
                  {citizen_evidence.water_appearance?.replace(/_/g, " ") || "Not specified"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-brand-secondary block">Flow Condition</span>
                <span className="text-brand-text capitalize">
                  {citizen_evidence.flow_condition?.replace(/_/g, " ") || "Not specified"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-brand-secondary block">Odor</span>
                <span className="text-brand-text capitalize">
                  {citizen_evidence.odor?.replace(/_/g, " ") || "Not specified"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-brand-border flex flex-wrap gap-2">
              <span className={`px-2 py-0.5 rounded text-[11px] border ${
                citizen_evidence.foam_observed
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                Foam: {citizen_evidence.foam_observed ? "Observed" : "Not observed"}
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] border ${
                citizen_evidence.litter_observed
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                Litter: {citizen_evidence.litter_observed ? "Observed" : "Not observed"}
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] border ${
                citizen_evidence.dead_wildlife_observed
                  ? "bg-red-50 text-red-800 border-red-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                Dead Wildlife: {citizen_evidence.dead_wildlife_observed ? "Observed" : "Not observed"}
              </span>
            </div>

            {/* Media Evidence */}
            <div className="pt-2 border-t border-brand-border">
              <span className="font-semibold text-brand-secondary flex items-center space-x-1 mb-1.5">
                <Camera className="w-3.5 h-3.5 text-gray-400" />
                <span>Media Evidence ({citizen_evidence.media.length})</span>
              </span>
              {citizen_evidence.media.length > 0 ? (
                <div className="space-y-2">
                  {citizen_evidence.media.map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-lg bg-gray-50 border border-brand-border space-y-1 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-brand-text truncate">{m.original_filename}</span>
                        <span className="text-gray-500">{(m.size_bytes / 1024).toFixed(1)} KB</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-400 font-mono text-[10px]">
                        <span>SHA-256:</span>
                        <span className="truncate">{m.sha256}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No media uploaded with this report.</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Evidence Quality */}
        <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-brand-border pb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-brand-teal" />
              <h3 className="font-semibold text-brand-text">2. Evidence Quality Assessment</h3>
            </div>
            <span className="text-xs font-semibold text-brand-teal">
              {(evidence_quality.score * 100).toFixed(0)}% Complete
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Progress Bar */}
            <div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-brand-teal h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, evidence_quality.score * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Completeness metric across core observational dimensions.
              </p>
            </div>

            {/* Documented Dimensions */}
            <div>
              <span className="font-semibold text-emerald-800 block mb-1">
                Documented Dimensions ({evidence_quality.present.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {evidence_quality.present.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[11px] border border-emerald-200"
                  >
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    <span>{item.replace(/_/g, " ")}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Missing Dimensions */}
            {evidence_quality.missing.length > 0 && (
              <div>
                <span className="font-semibold text-amber-800 block mb-1">
                  Missing Dimensions ({evidence_quality.missing.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {evidence_quality.missing.map((item) => (
                    <span
                      key={item}
                      className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[11px] border border-amber-200"
                    >
                      {item.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {evidence_quality.recommendations.length > 0 && (
              <div className="pt-2 border-t border-brand-border">
                <span className="font-semibold text-brand-secondary block mb-1">Recommendations:</span>
                <ul className="list-disc pl-4 space-y-1 text-gray-600 text-[11px]">
                  {evidence_quality.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Machine Assistance & Contextual Evidence */}
        <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-brand-border pb-3">
            <Layers className="w-5 h-5 text-brand-teal" />
            <h3 className="font-semibold text-brand-text">3. Machine & Contextual Evidence</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="font-semibold text-brand-secondary block mb-1">Machine Assistance:</span>
              {machine_assistance.items.length > 0 ? (
                <div className="space-y-1">
                  {machine_assistance.items.map((item, idx) => (
                    <p key={idx} className="text-brand-text bg-gray-50 p-2 rounded border border-brand-border">
                      {JSON.stringify(item)}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic bg-gray-50 p-2.5 rounded-lg border border-brand-border">
                  No machine assistance has been generated yet.
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-brand-border">
              <span className="font-semibold text-brand-secondary block mb-1">
                Contextual Evidence (Pattern Echo):
              </span>
              {contextual_evidence.items.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-brand-text font-medium text-[11px]">
                    Similar historical observations were found.
                  </p>
                  <p className="text-[10px] text-brand-secondary italic">
                    Historical similarity indicates recurring spatial/temporal conditions and does not confirm environmental causation.
                  </p>
                </div>
              ) : (
                <p className="text-gray-400 italic bg-gray-50 p-2.5 rounded-lg border border-brand-border">
                  No historical clusters or contextual matches identified.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Human Decision & Provenance */}
        <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-brand-border pb-3">
            <UserCheck className="w-5 h-5 text-brand-teal" />
            <h3 className="font-semibold text-brand-text">4. Human Decision & Provenance</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="font-semibold text-brand-secondary block mb-1">Expert Review Status:</span>
              <div className="p-3 bg-gray-50 rounded-lg border border-brand-border space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold bg-gray-200 text-gray-700">
                  {human_decision.status === "pending" || human_decision.status === "pending_review"
                    ? "Awaiting human review"
                    : human_decision.status}
                </span>
                <p className="text-[11px] text-gray-500 mt-1">
                  {human_decision.notes || "No human expert verification has been recorded yet."}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-brand-border text-[11px] text-gray-500 space-y-1">
              <p>
                <strong className="text-brand-secondary">Data System Source:</strong> {provenance.source}
              </p>
              <p>
                <strong className="text-brand-secondary">Case Generated:</strong>{" "}
                {new Date(provenance.generated_at).toLocaleString()}
              </p>
              <p>
                <strong className="text-brand-secondary">Integrated Components:</strong>{" "}
                {provenance.components.join(", ")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Triage Explanations & Limitations Card */}
      {triage && (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-brand-border pb-3">
            <AlertTriangle className="w-5 h-5 text-brand-warning" />
            <h3 className="font-semibold text-brand-text">
              Evidence Triage & Workflow Next-Action Guidance
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-semibold text-brand-secondary block mb-1">Decision Explanations:</span>
              <ul className="list-disc pl-4 space-y-1 text-gray-700">
                {triage.explanation.map((exp, idx) => (
                  <li key={idx}>{exp}</li>
                ))}
              </ul>
            </div>

            <div>
              <span className="font-semibold text-brand-secondary block mb-1">Scientific Boundaries:</span>
              <ul className="list-disc pl-4 space-y-1 text-gray-500 text-[11px]">
                {triage.limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Reset / Submit New Button */}
      <div className="flex justify-center pt-4">
        <button
          type="button"
          onClick={onNewObservation}
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-lg text-sm font-semibold text-white bg-brand-teal hover:bg-brand-dark transition-colors shadow-xs"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Submit Another Observation</span>
        </button>
      </div>
    </div>
  );
};
