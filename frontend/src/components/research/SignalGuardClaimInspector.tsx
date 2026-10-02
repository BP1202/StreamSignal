import React, { useState } from "react";
import { EvidenceClaimItem } from "../../types/research";
import {
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
} from "lucide-react";

interface SignalGuardClaimInspectorProps {
  claims: EvidenceClaimItem[];
}

export const SignalGuardClaimInspector: React.FC<SignalGuardClaimInspectorProps> = ({
  claims,
}) => {
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(
    claims.length > 0 ? claims[0].claim_id : null
  );

  const toggleClaim = (claimId: string) => {
    setExpandedClaimId((prev) => (prev === claimId ? null : claimId));
  };

  const getEvidenceClassBadge = (evClass: string) => {
    const classMap: Record<string, { label: string; desc: string; bg: string; text: string; border: string }> = {
      E1_REPORTED: {
        label: "E1 — REPORTED",
        desc: "Citizen primary report; uncorroborated by sensor/expert.",
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
      },
      E2_OBSERVED: {
        label: "E2 — OBSERVED",
        desc: "Direct observable visual signal extracted from media.",
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
      },
      E3_INFERRED: {
        label: "E3 — INFERRED",
        desc: "Deterministic algorithmic inference; not confirmed fact.",
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
      },
      E4_CORROBORATED: {
        label: "E4 — CORROBORATED",
        desc: "Supported by contextual historical patterns (Pattern Echo).",
        bg: "bg-purple-50",
        text: "text-purple-700",
        border: "border-purple-200",
      },
      E5_VERIFIED: {
        label: "E5 — VERIFIED",
        desc: "Confirmed by authorized human expert workflow.",
        bg: "bg-teal-50",
        text: "text-teal-700",
        border: "border-teal-200",
      },
    };

    const cfg = classMap[evClass] || {
      label: evClass,
      desc: "Provenance classification tier.",
      bg: "bg-gray-50",
      text: "text-gray-700",
      border: "border-gray-200",
    };

    return (
      <div className="flex flex-col">
        <span
          className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border}`}
        >
          {cfg.label}
        </span>
        <span className="text-[10px] text-brand-secondary mt-0.5">
          {cfg.desc}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-brand-surface rounded-xl border border-brand-border p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-brand-border pb-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-brand-text flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-brand-teal" />
            SignalGuard™ Claim Inspector
          </h3>
          <p className="text-xs text-brand-secondary mt-0.5">
            Transparent evidentiary trust boundaries. E1–E5 indicate provenance class, not a quality ranking.
          </p>
        </div>
        <span className="text-xs font-medium text-brand-secondary bg-gray-100 px-2 py-0.5 rounded-full">
          {claims.length} Claim{claims.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-3">
        {claims.map((claim) => {
          const isExpanded = expandedClaimId === claim.claim_id;
          return (
            <div
              key={claim.claim_id}
              className={`rounded-lg border transition-all ${
                isExpanded
                  ? "border-brand-teal/40 bg-gray-50/50 shadow-xs"
                  : "border-brand-border hover:border-gray-300 bg-white"
              }`}
            >
              {/* Header / Trigger */}
              <button
                type="button"
                onClick={() => toggleClaim(claim.claim_id)}
                className="w-full text-left p-3.5 flex items-start justify-between gap-3 focus:outline-hidden"
              >
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-gray-100 text-gray-700">
                      CLAIM
                    </span>
                    <span className="text-sm font-medium text-brand-text">
                      {claim.claim}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-brand-secondary">
                    <span>Source: <code className="text-gray-700 bg-gray-100 px-1 rounded-sm">{claim.source}</code></span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-right">
                    <span className="text-xs font-medium text-gray-600 block">
                      {claim.evidence_class}
                    </span>
                  </div>
                  <div className="text-gray-400">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-brand-teal" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded Claim Details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3.5 text-xs text-brand-secondary">
                  {/* Provenance Class Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                        Evidence Class (Provenance)
                      </span>
                      {getEvidenceClassBadge(claim.evidence_class)}
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                        Supporting Evidence
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {claim.support.map((sup, idx) => (
                          <span
                            key={idx}
                            className="bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-sm flex items-center gap-1 font-mono text-[11px]"
                          >
                            <FileText className="w-3 h-3 text-gray-400" />
                            {sup}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Uncertainty Boundary */}
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-md p-3 text-amber-900">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block text-[11px] text-amber-800 uppercase tracking-wide mb-0.5">
                          Uncertainty & Observation Boundary
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-xs">
                          {claim.uncertainty.map((u, i) => (
                            <li key={i}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Allowed vs Prohibited Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* Allowed Actions */}
                    <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-md p-3 text-emerald-900">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-800 mb-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Permitted Follow-up Actions</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {claim.allowed_actions.map((act, i) => (
                          <span
                            key={i}
                            className="bg-white border border-emerald-300 text-emerald-800 text-[11px] font-medium px-2 py-0.5 rounded-sm"
                          >
                            {act.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Prohibited Interpretations */}
                    <div className="bg-red-50/60 border border-red-200/80 rounded-md p-3 text-red-900">
                      <div className="flex items-center gap-1.5 font-semibold text-red-800 mb-1.5">
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                        <span>Not Established (Prohibited Interpretations)</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {claim.prohibited_interpretations.map((prob, i) => (
                          <span
                            key={i}
                            className="bg-white border border-red-300 text-red-700 text-[11px] font-medium px-2 py-0.5 rounded-sm"
                          >
                            ✕ {prob.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
