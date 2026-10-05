import React, { useState, useEffect } from "react";
import { ResearchCaseDetailResponse, HumanReviewItem } from "../../types/research";
import { fetchResearchCaseDetail } from "../../api/research";
import { HumanReviewPanel } from "./HumanReviewPanel";
import { ResearchMediaGallery } from "./ResearchMediaGallery";
import { InteroperabilitySection } from "./InteroperabilitySection";
import { ResearcherMissionTracker } from "./ResearcherMissionTracker";
import { ContactContributorModal } from "./ContactContributorModal";
import { ApiError } from "../../api/client";
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Clock,
  MapPin,
  CheckCircle2,
  FileText,
  History,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Info,
  UserCheck,
  Send,
  FileCheck2,
  MessageSquare,
} from "lucide-react";

interface SignalCaseInvestigationViewProps {
  caseId: string;
  onBackToInbox: () => void;
}

export const SignalCaseInvestigationView: React.FC<
  SignalCaseInvestigationViewProps
> = ({ caseId, onBackToInbox }) => {
  const [caseDetail, setCaseDetail] =
    useState<ResearchCaseDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState<boolean>(false);
  const [lineageRefreshTrigger, setLineageRefreshTrigger] = useState<number>(0);

  const loadCase = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchResearchCaseDetail(caseId);
      setCaseDetail(data);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : `Failed to load SignalCase '${caseId}'.`;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const handleReviewRecorded = (review: HumanReviewItem) => {
    setLineageRefreshTrigger((prev) => prev + 1);
    // Reload full case detail to ensure all server-derived fields and why-surfaced update
    loadCase();
  };

  if (isLoading) {
    return (
      <div className="research-workspace w-full max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white rounded-xl border border-brand-border p-12 text-center shadow-xs space-y-3">
          <RefreshCw className="w-8 h-8 text-brand-teal animate-spin mx-auto" />
          <h3 className="text-base font-semibold text-brand-text">
            Loading evidence...
          </h3>
          <p className="text-xs text-brand-secondary max-w-md mx-auto">
            Loading reported observations, evidence completeness, historical context, and human review status.
          </p>
        </div>
      </div>
    );
  }

  if (error || !caseDetail) {
    return (
      <div className="research-workspace w-full max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
          <h3 className="text-lg font-bold text-red-900">
            Evidence could not be loaded.
          </h3>
          <p className="text-xs text-red-700 max-w-md mx-auto">
            {error || `Case with id '${caseId}' could not be retrieved.`}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={onBackToInbox}
              className="text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
            >
              Back to Inbox
            </button>
            <button
              onClick={loadCase}
              className="text-xs font-semibold text-white bg-red-700 hover:bg-red-800 px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const shortId = `SS-${caseDetail.case_id.slice(0, 8).toUpperCase()}`;
  const pct = Math.round(caseDetail.evidence_quality.score * 100);
  const currentWorkflowStatus = caseDetail.workflow_status || caseDetail.human_decision_status;
  const currentEvidenceState = caseDetail.evidence_state || "E1_REPORTED";

  return (
    <div className="research-workspace w-full max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6">
      {/* Top Nav & Context Breadcrumb */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 sm:gap-4">
        <button
          onClick={onBackToInbox}
          className="text-xs font-semibold text-brand-secondary hover:text-brand-dark flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Evidence Inbox
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-xs font-mono bg-gray-100 text-brand-text px-2.5 py-1 rounded-md font-semibold">
            {shortId}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-light text-brand-teal border border-brand-border">
            Triage: {caseDetail.triage.recommended_action.replace(/_/g, " ")}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            {currentEvidenceState.replace(/_/g, " ")}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-mono">
            {currentWorkflowStatus}
          </span>
        </div>
      </div>

      {/* Case Overview Card */}
      <div className="bg-brand-surface rounded-xl border border-brand-border p-3.5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-brand-text tracking-tight">
              SignalCase Investigation
            </h1>
            <div className="flex items-center gap-2.5 sm:gap-4 text-xs text-brand-secondary mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 font-mono break-all text-[11px] sm:text-xs">
                UUID: {caseDetail.case_id}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                Observed: {new Date(caseDetail.observed_at).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                Location: {caseDetail.location.latitude.toFixed(4)}, {caseDetail.location.longitude.toFixed(4)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
            <div className="text-left sm:text-right">
              <span className="text-[10px] uppercase font-semibold text-gray-400 block">
                Evidence Completeness
              </span>
              <span className="text-base sm:text-lg font-bold text-brand-text">
                {pct}% ({caseDetail.evidence_quality.quality})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className="text-xs font-semibold text-brand-teal bg-white border border-brand-teal/40 hover:bg-brand-light px-3.5 py-2 sm:py-2.5 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Contact Contributor</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReviewOpen((prev) => !prev)}
              className="text-xs font-semibold text-white bg-brand-dark hover:bg-brand-dark/90 px-4 py-2 sm:py-2.5 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
            >
              <UserCheck className="w-4 h-4" />
              <span>{isReviewOpen ? "Close Review Panel" : "Start Review"}</span>
            </button>
          </div>
        </div>

        {/* Signature Feature: WHY THIS CASE SURFACED BANNER */}
        <div className="bg-brand-light/40 border border-brand-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dark flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-teal" />
              Why This Case Surfaced for Investigation
            </h3>
            <span className="text-[10px] text-brand-secondary font-mono">
              auditable-rationale
            </span>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-brand-text pt-1">
            {caseDetail.why_surfaced.map((reason, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 bg-white/70 border border-brand-border/60 p-2.5 rounded-lg"
              >
                <span className="text-brand-teal font-bold shrink-0">✓</span>
                <div>
                  <span className="font-semibold block">{reason.summary}</span>
                  {reason.details && (
                    <span className="text-[11px] text-brand-secondary mt-0.5 block">
                      {reason.details}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ResearchMediaGallery caseId={caseDetail.case_id} media={caseDetail.media || []} />

      {/* Interactive Human Review Panel (Opens when researcher initiates review) */}
      {isReviewOpen && (
        <HumanReviewPanel
          caseDetail={caseDetail}
          onReviewRecorded={handleReviewRecorded}
          onCancel={() => setIsReviewOpen(false)}
        />
      )}

      {/* LATEST HUMAN DECISION CARD (Prominently displayed once reviewed) */}
      {caseDetail.latest_human_review && (
        <div className="bg-white rounded-xl border border-teal-300 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-teal-100 pb-2.5">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-brand-teal" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text">
                LATEST HUMAN DECISION
              </h3>
            </div>
            <span className="text-[10px] font-mono bg-teal-50 text-brand-teal px-2 py-0.5 rounded-sm border border-teal-200">
              Recorded by {caseDetail.latest_human_review.reviewer_id}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="font-bold text-brand-text text-sm">
                {caseDetail.latest_human_review.outcome.replace(/_/g, " ")}
              </div>
              <div className="text-[11px] text-gray-500">
                Recorded: {new Date(caseDetail.latest_human_review.created_at).toLocaleString()}
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-md">
              <span className="text-[10px] font-semibold text-gray-500 uppercase block">
                Researcher Rationale
              </span>
              <p className="text-brand-text mt-1 italic whitespace-pre-wrap">
                "{caseDetail.latest_human_review.rationale}"
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
              <span>
                Workflow: <strong className="text-brand-dark">{caseDetail.latest_human_review.workflow_status}</strong>
              </span>
              <span>
                Evidence State: <strong className="text-purple-700">{caseDetail.latest_human_review.evidence_state_after}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4 Multi-Layered Evidence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
        {/* Layer 1: What Was Reported (Citizen Evidence) */}
        <div className="bg-white rounded-xl border border-brand-border p-5 shadow-xs space-y-4">
          <div className="border-b border-brand-border pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-text flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-teal" />
              1. Reported observation
            </h3>
            <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-sm border border-blue-200">
              E1 — REPORTED
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-gray-500 font-semibold block text-[10px] uppercase">
                Citizen Narrative
              </span>
              <p className="text-brand-text bg-gray-50 p-2.5 rounded-md mt-1 italic">
                "{caseDetail.description || "No text description supplied."}"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 p-2.5 rounded-md">
                <span className="text-gray-500 text-[10px] uppercase block font-semibold">
                  Water Appearance
                </span>
                <span className="font-medium text-brand-text">
                  {caseDetail.water_appearance
                    ? caseDetail.water_appearance.replace(/_/g, " ")
                    : "Not documented"}
                </span>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-md">
                <span className="text-gray-500 text-[10px] uppercase block font-semibold">
                  Flow Condition
                </span>
                <span className="font-medium text-brand-text">
                  {caseDetail.flow_condition
                    ? caseDetail.flow_condition.replace(/_/g, " ")
                    : "Not documented"}
                </span>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-md">
                <span className="text-gray-500 text-[10px] uppercase block font-semibold">
                  Odor
                </span>
                <span className="font-medium text-brand-text">
                  {caseDetail.odor
                    ? caseDetail.odor.replace(/_/g, " ")
                    : "Not documented"}
                </span>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-md">
                <span className="text-gray-500 text-[10px] uppercase block font-semibold">
                  Surface Indicators
                </span>
                <span className="font-medium text-brand-text">
                  {[
                    caseDetail.foam_observed ? "Foam" : null,
                    caseDetail.litter_observed ? "Litter" : null,
                    caseDetail.dead_wildlife_observed ? "Wildlife" : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || "None observed"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Layer 2: Evidence Quality Assessment */}
        <div className="bg-white rounded-xl border border-brand-border p-5 shadow-xs space-y-4">
          <div className="border-b border-brand-border pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-text flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-teal" />
              2. Evidence completeness
            </h3>
            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-sm border border-emerald-200">
              {caseDetail.evidence_quality.quality}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between items-center text-[11px] mb-1 font-semibold text-gray-500">
                <span>Completeness Score: {pct}%</span>
                <span className="text-brand-text font-bold">{pct}%</span>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-brand-teal h-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div>
              <span className="text-gray-500 font-semibold block text-[10px] uppercase mb-1">
                Documented Attributes ({caseDetail.evidence_quality.present.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {caseDetail.evidence_quality.present.map((f, i) => (
                  <span
                    key={i}
                    className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-sm font-mono"
                  >
                    ✓ {f}
                  </span>
                ))}
              </div>
            </div>

            {caseDetail.evidence_quality.missing.length > 0 && (
              <div>
                <span className="text-gray-500 font-semibold block text-[10px] uppercase mb-1">
                  Missing Attributes ({caseDetail.evidence_quality.missing.length})
                </span>
                <div className="flex flex-wrap gap-1">
                  {caseDetail.evidence_quality.missing.map((f, i) => (
                    <span
                      key={i}
                      className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] px-2 py-0.5 rounded-sm font-mono"
                    >
                      ! {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Layer 4: Contextual Evidence: Pattern Echo */}
        <div className="bg-white rounded-xl border border-brand-border p-5 shadow-xs space-y-4">
          <div className="border-b border-brand-border pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-text flex items-center gap-2">
              <History className="w-4 h-4 text-brand-teal" />
              3. Historical context: Pattern Echo
            </h3>
            <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-sm border border-purple-200">
              E4 — CORROBORATED
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-[11px] text-gray-500 bg-gray-50 p-2 rounded-md">
              <span>Radius: {caseDetail.contextual_evidence.search_radius_meters}m</span>
              <span>Window: {caseDetail.contextual_evidence.historical_window_days} days</span>
              <span>Status: <strong className="text-brand-text">{caseDetail.contextual_evidence.status}</strong></span>
            </div>

            <p className="text-brand-text font-medium">
              {caseDetail.contextual_evidence.summary}
            </p>

            {caseDetail.contextual_evidence.matches.length > 0 ? (
              <div className="space-y-2">
                {caseDetail.contextual_evidence.matches.map((m) => (
                  <div
                    key={m.report_id}
                    className="bg-gray-50 border border-gray-200 p-2.5 rounded-md space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-brand-text font-semibold">
                        Case SS-{m.report_id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-gray-500">
                        {m.distance_meters}m away · {m.days_difference}d earlier
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {m.matched_signals.map((sig, sIdx) => (
                        <span
                          key={sIdx}
                          className="bg-white border border-purple-200 text-purple-800 text-[10px] px-1.5 py-0.5 rounded-sm font-mono"
                        >
                          {sig}
                        </span>
                      ))}
                    </div>

                    <ul className="text-[11px] text-brand-secondary list-disc list-inside pt-1 space-y-0.5">
                      {m.similarity_explanation.map((exp, eIdx) => (
                        <li key={eIdx}>{exp}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic bg-gray-50 p-3 rounded-md">
                No similar historical observations were reported in spatial/temporal proximity.
              </p>
            )}

            {/* Scientific Boundary Notice */}
            <div className="bg-amber-50/70 border border-amber-200 p-2.5 rounded-md text-[11px] text-amber-900 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Scientific Boundary:</strong> {caseDetail.contextual_evidence.interpretation_limit}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* One Health Evidence Passport & FHIR R4 Provenance Gateway */}
      <InteroperabilitySection
        caseId={caseDetail.case_id}
        refreshTrigger={lineageRefreshTrigger}
      />

      {/* Citizen Evidence Missions & Collaboration */}
      <ResearcherMissionTracker caseId={caseDetail.case_id} />

      {/* Bottom Review Action Bar */}
      <div className="bg-white rounded-xl border border-brand-border p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-teal bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-sm">
            Human Decision & Trust Loop
          </span>
          <h3 className="text-base font-bold text-brand-text mt-1.5">
            Status: {currentWorkflowStatus}
          </h3>
          <p className="text-xs text-brand-secondary mt-0.5">
            Evidence analysis is complete. Researchers control consequential review decisions with immutable lineage audit tracking.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => {
              setIsReviewOpen(true);
              window.scrollTo({ top: 300, behavior: "smooth" });
            }}
            className="text-xs font-semibold bg-brand-dark text-white hover:bg-brand-dark/90 px-4 py-2.5 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>{caseDetail.latest_human_review ? "Record New Decision" : "Start Review"}</span>
          </button>
        </div>
      </div>

      {/* Researcher-Contributor Contact Modal */}
      <ContactContributorModal
        caseId={caseId}
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onContactUpdated={() => {
          setLineageRefreshTrigger((prev) => prev + 1);
          loadCase();
        }}
      />
    </div>
  );
};
