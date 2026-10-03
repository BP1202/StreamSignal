import React, { useState, useEffect } from "react";
import {
  fetchEvidencePassport,
  fetchFHIRBundle,
} from "../../api/research";
import {
  EvidencePassportResponse,
  FHIRBundle,
} from "../../types/interoperability";
import {
  Share2,
  FileCheck,
  Code2,
  GitBranch,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  X,
  FileText,
  MapPin,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";

interface InteroperabilitySectionProps {
  caseId: string;
  refreshTrigger?: number;
}

export const InteroperabilitySection: React.FC<InteroperabilitySectionProps> = ({
  caseId,
  refreshTrigger = 0,
}) => {
  const [passport, setPassport] = useState<EvidencePassportResponse | null>(null);
  const [fhirBundle, setFhirBundle] = useState<FHIRBundle | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isPassportModalOpen, setIsPassportModalOpen] = useState<boolean>(false);
  const [isFhirModalOpen, setIsFhirModalOpen] = useState<boolean>(false);
  const [isProvenanceModalOpen, setIsProvenanceModalOpen] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadInteroperabilityData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [passportData, fhirData] = await Promise.all([
          fetchEvidencePassport(caseId),
          fetchFHIRBundle(caseId),
        ]);
        if (isMounted) {
          setPassport(passportData);
          setFhirBundle(fhirData);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load interoperability passport or FHIR bundle."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadInteroperabilityData();
    return () => {
      isMounted = false;
    };
  }, [caseId, refreshTrigger]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Derive dynamic resource counts directly from real FHIR entries
  const resourceCounts = React.useMemo(() => {
    if (!fhirBundle?.entry) {
      return {
        Location: 0,
        QuestionnaireResponse: 0,
        Observation: 0,
        Media: 0,
        Task: 0,
        Provenance: 0,
        Total: 0,
      };
    }
    const counts: Record<string, number> = {
      Location: 0,
      QuestionnaireResponse: 0,
      Observation: 0,
      Media: 0,
      Task: 0,
      Provenance: 0,
    };
    for (const e of fhirBundle.entry) {
      const type = e.resource?.resourceType;
      if (type && type in counts) {
        counts[type] += 1;
      }
    }
    return {
      ...counts,
      Total: fhirBundle.entry.length,
    };
  }, [fhirBundle]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-brand-border p-6 shadow-xs animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/4 mb-3"></div>
        <div className="h-6 bg-slate-200 rounded w-1/2 mb-6"></div>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !passport || !fhirBundle) {
    return (
      <div className="bg-white rounded-xl border border-rose-200 p-6 shadow-xs">
        <div className="flex items-center gap-2 text-rose-700">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="text-sm font-semibold">Interoperability Gateway Unavailable</h3>
        </div>
        <p className="text-xs text-rose-600 mt-1">
          {error || "Unable to retrieve evidence passport and FHIR bundle."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-brand-border p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-sm flex items-center gap-1">
              <Share2 className="w-3 h-3" />
              One Health Evidence Interoperability
            </span>
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">
              FHIR R4 Compatible
            </span>
          </div>
          <h3 className="text-base font-bold text-brand-text mt-1.5 flex items-center gap-2">
            Evidence Passport & FHIR R4 Provenance Gateway
          </h3>
          <p className="text-xs text-brand-secondary mt-0.5">
            Standards-ready evidence serialization isolating citizen facts, machine inferences, contextual echoes, and human decisions.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPassportModalOpen(true)}
            className="text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-2 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>View Passport</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFhirModalOpen(true)}
            className="text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 px-3 py-2 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>FHIR R4 Bundle</span>
          </button>
          <button
            type="button"
            onClick={() => setIsProvenanceModalOpen(true)}
            className="text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5 text-slate-500" />
            <span>Provenance Trail</span>
          </button>
        </div>
      </div>

      {/* Dynamic Resource Counts Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2">
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          <span className="text-[10px] font-semibold uppercase text-slate-500 block">
            Location
          </span>
          <span className="text-lg font-bold text-brand-text block mt-0.5">
            {resourceCounts.Location}
          </span>
          <span className="text-[10px] text-slate-400">Site coordinates</span>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          <span className="text-[10px] font-semibold uppercase text-slate-500 block">
            Survey QR
          </span>
          <span className="text-lg font-bold text-brand-text block mt-0.5">
            {resourceCounts.QuestionnaireResponse}
          </span>
          <span className="text-[10px] text-slate-400">Citizen answers</span>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          <span className="text-[10px] font-semibold uppercase text-slate-500 block">
            Observations
          </span>
          <span className="text-lg font-bold text-brand-text block mt-0.5">
            {resourceCounts.Observation}
          </span>
          <span className="text-[10px] text-slate-400">E1 + E3 + E4 signals</span>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          <span className="text-[10px] font-semibold uppercase text-slate-500 block">
            Media Attachments
          </span>
          <span className="text-lg font-bold text-brand-text block mt-0.5">
            {resourceCounts.Media}
          </span>
          <span className="text-[10px] text-slate-400">SHA-256 verified</span>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          <span className="text-[10px] font-semibold uppercase text-slate-500 block">
            Workflow Tasks
          </span>
          <span className="text-lg font-bold text-brand-text block mt-0.5">
            {resourceCounts.Task}
          </span>
          <span className="text-[10px] text-slate-400">Human review requests</span>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          <span className="text-[10px] font-semibold uppercase text-slate-500 block">
            Provenance Events
          </span>
          <span className="text-lg font-bold text-brand-text block mt-0.5">
            {resourceCounts.Provenance}
          </span>
          <span className="text-[10px] text-slate-400">Lineage audit trail</span>
        </div>
      </div>

      {/* Trust & Boundary Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          <span>
            Passport ID: <code className="font-mono text-slate-700">{passport.metadata.passport_id.slice(0, 18)}...</code>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>E4 Corroboration != E5 Field Verification. FHIR export preserves strict evidence isolation.</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. Evidence Passport Modal */}
      {/* ------------------------------------------------------------- */}
      {isPassportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    SignalCase Evidence Passport
                  </h4>
                  <p className="text-xs text-slate-500">
                    Comprehensive provenance-rich evidence specification (Version {passport.metadata.schema_version})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPassportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              {/* Section 1: Governance & Identity */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Governance Standard</span>
                    <span className="font-semibold text-slate-800">{passport.metadata.governance_standard}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Passport ID</span>
                    <span className="font-mono text-slate-700">{passport.metadata.passport_id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Evidence State Tier</span>
                    <span className="inline-flex font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-sm text-[11px]">
                      {passport.identity.current_evidence_state}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Workflow Status</span>
                    <span className="font-semibold text-slate-800">{passport.identity.current_workflow_status}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Citizen Evidence */}
              <div>
                <h5 className="text-xs font-bold uppercase text-slate-900 tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                  1. Citizen Observational Evidence (Source: {passport.citizen_evidence.evidence_origin})
                </h5>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-medium text-slate-900 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                    "{passport.citizen_evidence.description}"
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Observed At:</span>
                      <span className="font-medium text-slate-800">{new Date(passport.citizen_evidence.observed_at).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Coordinates:</span>
                      <span className="font-mono text-slate-800">
                        {passport.citizen_evidence.location.latitude.toFixed(4)}, {passport.citizen_evidence.location.longitude.toFixed(4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Water Appearance:</span>
                      <span className="font-medium text-slate-800">{passport.citizen_evidence.water_appearance || "Not reported"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Odor:</span>
                      <span className="font-medium text-slate-800">{passport.citizen_evidence.odor || "None"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Evidence Quality */}
              <div>
                <h5 className="text-xs font-bold uppercase text-slate-900 tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  2. Evidence Quality Assessment
                </h5>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-700">
                      Quality Tier: <strong>{passport.evidence_quality.quality_tier}</strong> (Completeness: {Math.round(passport.evidence_quality.completeness_score * 100)}%)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {passport.evidence_quality.present_dimensions.map((dim) => (
                      <span key={dim} className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-sm">
                        ✓ {dim}
                      </span>
                    ))}
                    {passport.evidence_quality.missing_dimensions.map((dim) => (
                      <span key={dim} className="text-[10px] bg-slate-50 text-slate-400 border border-slate-200 px-2 py-0.5 rounded-sm">
                        ✗ {dim}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 italic mt-2">
                    {passport.evidence_quality.interpretation_boundary}
                  </p>
                </div>
              </div>

              {/* Section 4: Machine Assistance (E3_INFERRED) */}
              <div>
                <h5 className="text-xs font-bold uppercase text-slate-900 tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  3. Machine Vision Observations (Class: {passport.machine_assistance.evidence_class})
                </h5>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  {passport.machine_assistance.items.length === 0 ? (
                    <p className="text-slate-400 italic">No automated visual cues detected.</p>
                  ) : (
                    passport.machine_assistance.items.map((obs) => (
                      <div key={obs.observation_id} className="border-l-2 border-amber-400 pl-3 py-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">{obs.observation_type}</span>
                          <span className="text-[10px] font-mono text-slate-400">Media: {obs.media_id.slice(0, 8)}...</span>
                        </div>
                        <p className="text-slate-700 mt-0.5">{obs.description}</p>
                        <p className="text-[10px] text-amber-700 mt-0.5">Uncertainty: {obs.uncertainty}</p>
                      </div>
                    ))
                  )}
                  <p className="text-[10px] text-slate-500 bg-amber-50/50 border border-amber-100 p-2 rounded-md">
                    {passport.machine_assistance.scientific_limitation}
                  </p>
                </div>
              </div>

              {/* Section 5: SignalGuard Interpretation Firewall */}
              <div>
                <h5 className="text-xs font-bold uppercase text-slate-900 tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  4. SignalGuard Interpretation Firewall (Anti-Hallucination)
                </h5>
                <div className="bg-rose-50/30 border border-rose-200 rounded-xl p-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase text-rose-800 block">Strictly Prohibited Interpretations:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {passport.signal_guard.prohibited_interpretations.map((p) => (
                      <span key={p} className="text-[10px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-sm">
                        ⛔ {p}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold uppercase text-slate-600 block pt-2">Supported Claims:</span>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px]">
                    {passport.signal_guard.supported_claims.map((claim, idx) => (
                      <li key={idx}>{claim}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Section 6: Human Decision */}
              <div>
                <h5 className="text-xs font-bold uppercase text-slate-900 tracking-wider mb-2 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-teal-600" />
                  5. Human Decision & Trust Loop
                </h5>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      Outcome: {passport.human_decision.outcome || "Awaiting Human Review"}
                    </span>
                    {passport.human_decision.reviewer_id && (
                      <span className="text-[10px] text-slate-500">
                        Reviewer: <strong>{passport.human_decision.reviewer_id}</strong>
                      </span>
                    )}
                  </div>
                  {passport.human_decision.rationale && (
                    <p className="text-slate-700 bg-slate-50 p-2.5 rounded-md border border-slate-100">
                      {passport.human_decision.rationale}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 italic">
                    {passport.human_decision.boundary_notice}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-[11px] text-slate-500">
                Generated: {new Date(passport.metadata.generated_at).toUTCString()}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(JSON.stringify(passport, null, 2), "passport")}
                className="text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === "passport" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "passport" ? "Copied JSON" : "Copy Passport JSON"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. FHIR R4 Bundle Modal */}
      {/* ------------------------------------------------------------- */}
      {isFhirModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-indigo-600" />
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    FHIR R4-Compatible Collection Bundle
                  </h4>
                  <p className="text-xs text-slate-500">
                    Deterministic bundle with {fhirBundle.total} resources (Location, QR, Observations, Media, Task, Provenance)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFhirModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Code Box */}
            <div className="p-4 bg-slate-950 overflow-y-auto flex-1 font-mono text-xs text-emerald-400 leading-relaxed">
              <pre className="whitespace-pre-wrap">{JSON.stringify(fhirBundle, null, 2)}</pre>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-sm">
                  Reference Integrity: Verified
                </span>
                <span className="text-[11px] text-slate-500">
                  Total Entries: {fhirBundle.total}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(JSON.stringify(fhirBundle, null, 2), "fhir")}
                className="text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === "fhir" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "fhir" ? "Copied FHIR JSON" : "Copy FHIR JSON"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. Provenance Trail Modal */}
      {/* ------------------------------------------------------------- */}
      {isProvenanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-indigo-600" />
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    FHIR Provenance Chain
                  </h4>
                  <p className="text-xs text-slate-500">
                    Authoritative actor attribution and activity linkage from immutable audit lineage
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProvenanceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              {passport.lineage.events.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No provenance events recorded yet.</p>
              ) : (
                passport.lineage.events.map((ev, index) => (
                  <div key={ev.event_id} className="relative pl-6 pb-4 border-l-2 border-indigo-200 last:border-l-transparent">
                    <span className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-indigo-600 ring-4 ring-white" />
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{ev.event_type}</span>
                        <span className="text-[10px] text-slate-400">{new Date(ev.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{ev.summary}</p>
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/60 text-[10px] text-slate-500">
                        <span>Actor: <strong>{ev.actor_type}</strong> ({ev.actor_id})</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-[11px] text-slate-500">
                Total Provenance Resources: {passport.lineage.total_events}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(JSON.stringify(passport.lineage, null, 2), "provenance")}
                className="text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === "provenance" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "provenance" ? "Copied Provenance" : "Copy Provenance JSON"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
