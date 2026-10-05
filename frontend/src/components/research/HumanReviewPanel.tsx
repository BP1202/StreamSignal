import React, { useState } from "react";
import {
  HumanReviewOutcome,
  HumanReviewItem,
  ResearchCaseDetailResponse,
} from "../../types/research";
import { submitHumanReview } from "../../api/research";
import { ApiError } from "../../api/client";
import {
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Send,
  X,
  Link as LinkIcon,
  HelpCircle,
  Eye,
  Info,
} from "lucide-react";

interface HumanReviewPanelProps {
  caseDetail: ResearchCaseDetailResponse;
  onReviewRecorded: (review: HumanReviewItem) => void;
  onCancel: () => void;
}

const OUTCOME_OPTIONS: {
  value: HumanReviewOutcome;
  label: string;
  description: string;
  requiresLink: boolean;
}[] = [
  {
    value: "SUPPORTS_REPORTED_OBSERVATION",
    label: "Supports reported observation",
    description: "Available evidence is consistent with citizen report; no immediate field escalation required.",
    requiresLink: false,
  },
  {
    value: "REQUEST_CLARIFICATION",
    label: "Request clarification",
    description: "Observation has ambiguities requiring follow-up communication with citizen reporter.",
    requiresLink: false,
  },
  {
    value: "REQUEST_MORE_EVIDENCE",
    label: "Request more evidence",
    description: "Additional documentation (photos, daytime observations, upstream context) is needed.",
    requiresLink: false,
  },
  {
    value: "REQUEST_FIELD_VERIFICATION",
    label: "Request field verification",
    description: "Significant indicators justify an on-site physical check by authorized field personnel.",
    requiresLink: false,
  },
  {
    value: "MARK_RELATED_CASE",
    label: "Mark related case",
    description: "Connect this observation to another related SignalCase within the spatial/temporal cluster.",
    requiresLink: true,
  },
  {
    value: "MARK_POTENTIAL_DUPLICATE",
    label: "Mark potential duplicate",
    description: "Observation appears to report the same physical event as an existing SignalCase.",
    requiresLink: true,
  },
  {
    value: "INSUFFICIENT_EVIDENCE",
    label: "Insufficient evidence",
    description: "Available evidence is inadequate to corroborate or substantiate the observation.",
    requiresLink: false,
  },
  {
    value: "RESOLVED_NO_ACTION",
    label: "Resolved — no action",
    description: "Review completed; transient or benign organic phenomenon documented with no further action.",
    requiresLink: false,
  },
];

export const HumanReviewPanel: React.FC<HumanReviewPanelProps> = ({
  caseDetail,
  onReviewRecorded,
  onCancel,
}) => {
  const [selectedOutcome, setSelectedOutcome] =
    useState<HumanReviewOutcome | null>(null);
  const [rationale, setRationale] = useState<string>("");
  const [linkedCaseId, setLinkedCaseId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recordedReview, setRecordedReview] =
    useState<HumanReviewItem | null>(null);

  const [reviewerId, setReviewerId] = useState<string>(() => {
    return (
      (typeof window !== "undefined"
        ? localStorage.getItem("streamsignal_reviewer_id") ||
          localStorage.getItem("streamsignal_researcher_email")
        : null) || "REV-RESEARCHER-001"
    );
  });

  const selectedOption = OUTCOME_OPTIONS.find(
    (o) => o.value === selectedOutcome
  );
  const trimmedRationale = rationale.trim();
  const isRationaleValid = trimmedRationale.length >= 15 && trimmedRationale.length <= 2000;
  const isLinkedCaseValid =
    !selectedOption?.requiresLink || (linkedCaseId.trim().length > 0 && linkedCaseId.trim() !== caseDetail.case_id);

  const canSubmit =
    selectedOutcome !== null &&
    isRationaleValid &&
    isLinkedCaseValid &&
    reviewerId.trim().length > 0 &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedOutcome) return;

    if (selectedOption?.requiresLink && linkedCaseId.trim() === caseDetail.case_id) {
      setError("Cannot link a case to itself. Please provide a distinct case UUID.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      localStorage.setItem("streamsignal_reviewer_id", reviewerId.trim());
      const review = await submitHumanReview(caseDetail.case_id, {
        outcome: selectedOutcome,
        rationale: trimmedRationale,
        linked_case_id: selectedOption?.requiresLink ? linkedCaseId.trim() : null,
      });
      setRecordedReview(review);
      onReviewRecorded(review);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to record human review. Please verify your inputs.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmation View
  if (recordedReview) {
    const formattedDate = new Date(recordedReview.created_at).toLocaleString();
    const outcomeLabel =
      OUTCOME_OPTIONS.find((o) => o.value === recordedReview.outcome)?.label ||
      recordedReview.outcome;

    return (
      <div className="bg-white rounded-xl border border-emerald-300 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>REVIEW RECORDED</span>
          </div>
          <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-sm border border-emerald-200">
            Audit Event Saved
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-500 font-semibold block text-[10px] uppercase">
              Decision
            </span>
            <span className="text-brand-text font-bold text-sm block mt-0.5">
              {outcomeLabel}
            </span>
          </div>

          <div>
            <span className="text-gray-500 font-semibold block text-[10px] uppercase">
              Researcher
            </span>
            <span className="text-brand-text font-mono font-semibold block mt-0.5">
              {recordedReview.reviewer_id}
            </span>
          </div>

          <div>
            <span className="text-gray-500 font-semibold block text-[10px] uppercase">
              Recorded Timestamp
            </span>
            <span className="text-brand-text block mt-0.5">{formattedDate}</span>
          </div>

          <div>
            <span className="text-gray-500 font-semibold block text-[10px] uppercase">
              Evidence State
            </span>
            <span className="text-purple-800 font-semibold block mt-0.5">
              {recordedReview.evidence_state_after.replace(/_/g, " ")}
            </span>
          </div>

          <div className="sm:col-span-2">
            <span className="text-gray-500 font-semibold block text-[10px] uppercase">
              Workflow Status
            </span>
            <span className="text-brand-dark font-mono font-bold block mt-0.5">
              {recordedReview.workflow_status}
            </span>
          </div>

          <div className="sm:col-span-2 bg-gray-50 p-3 rounded-md">
            <span className="text-gray-500 font-semibold block text-[10px] uppercase">
              Rationale
            </span>
            <p className="text-brand-text text-xs italic mt-1 whitespace-pre-wrap">
              "{recordedReview.rationale}"
            </p>
          </div>
        </div>

        {/* Scientific Safety Notice */}
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-semibold">Important Scientific Boundary:</strong>
            <span>
              This decision does not establish environmental cause, toxicity, pollution, or health risk.
              All evidence states remain provenance-grounded.
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
          >
            Close Panel
          </button>
        </div>
      </div>
    );
  }

  // Active Review Form
  return (
    <div className="bg-white rounded-xl border border-brand-border p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-brand-border pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-teal">
            Researcher Trust Loop
          </span>
          <h2 className="text-base font-bold text-brand-text">
            RESEARCHER REVIEW
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors"
          title="Cancel review"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Case Context Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg text-xs">
        <div>
          <span className="text-gray-500 font-semibold block text-[10px] uppercase">
            Current Status
          </span>
          <span className="font-semibold text-brand-text">
            {caseDetail.workflow_status || caseDetail.human_decision_status}
          </span>
        </div>
        <div>
          <span className="text-gray-500 font-semibold block text-[10px] uppercase">
            Evidence State
          </span>
          <span className="font-semibold text-purple-700">
            {caseDetail.evidence_state}
          </span>
        </div>
      </div>

      {/* Why This Case Surfaced Brief */}
      <div className="space-y-1.5">
        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
          Why This Case Surfaced
        </span>
        <ul className="space-y-1 text-xs text-brand-text">
          {caseDetail.why_surfaced.slice(0, 3).map((r, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className="text-brand-teal font-bold shrink-0">✓</span>
              <span>{r.summary}</span>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Reviewer ID Audit Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs">
          <label htmlFor="reviewer-id-input" className="text-gray-600 font-semibold">
            Reviewer ID (Audit Header):
          </label>
          <input
            id="reviewer-id-input"
            type="text"
            value={reviewerId}
            onChange={(e) => {
              const val = e.target.value;
              setReviewerId(val);
              localStorage.setItem("streamsignal_reviewer_id", val);
            }}
            placeholder="e.g. REV-RESEARCHER-001"
            className="font-mono text-xs px-2.5 py-1 bg-white border border-gray-300 rounded text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-teal w-full sm:w-60"
          />
        </div>

        {/* Outcome Selector */}
        <div>
          <label className="block text-xs font-bold text-brand-text mb-2">
            Decision Outcome <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {OUTCOME_OPTIONS.map((opt) => {
              const isSelected = selectedOutcome === opt.value;
              return (
                <div
                  key={opt.value}
                  onClick={() => setSelectedOutcome(opt.value)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                    isSelected
                      ? "border-brand-teal bg-teal-50/50 ring-1 ring-brand-teal"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="review_outcome"
                      value={opt.value}
                      checked={isSelected}
                      onChange={() => setSelectedOutcome(opt.value)}
                      className="text-brand-teal focus:ring-brand-teal"
                    />
                    <span className="text-xs font-semibold text-brand-text">
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 pl-5 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Linked Case Input (Conditional for related/duplicate) */}
        {selectedOption?.requiresLink && (
          <div className="bg-amber-50/50 border border-amber-200 p-3.5 rounded-lg space-y-2">
            <label
              htmlFor="linkedCaseInput"
              className="flex items-center gap-1.5 text-xs font-bold text-amber-900"
            >
              <LinkIcon className="w-3.5 h-3.5 text-amber-700" />
              Linked SignalCase UUID <span className="text-red-500">*</span>
            </label>
            <p className="text-[11px] text-amber-800">
              Mandatory: Provide the UUID of the related or duplicate SignalCase. Self-linking is prohibited.
            </p>
            <input
              id="linkedCaseInput"
              type="text"
              value={linkedCaseId}
              onChange={(e) => setLinkedCaseId(e.target.value)}
              placeholder="e.g. 11111111-1111-1111-1111-111111111111"
              className="w-full text-xs font-mono border border-gray-300 rounded-md p-2 focus:ring-1 focus:ring-brand-teal focus:border-brand-teal bg-white"
              required
            />
          </div>
        )}

        {/* Researcher Rationale */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="rationaleInput"
              className="text-xs font-bold text-brand-text"
            >
              Researcher Rationale <span className="text-red-500">*</span>
            </label>
            <span
              className={`text-[10px] font-mono ${
                trimmedRationale.length < 15
                  ? "text-red-600 font-semibold"
                  : "text-gray-400"
              }`}
            >
              {trimmedRationale.length}/2000 chars (min 15 required)
            </span>
          </div>
          <textarea
            id="rationaleInput"
            rows={4}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Document the empirical reasoning, evidence cross-checks, and field-readiness justifications behind this decision..."
            className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-brand-teal focus:border-brand-teal"
            required
          />
          {trimmedRationale.length > 0 && trimmedRationale.length < 15 && (
            <p className="text-[11px] text-red-600 mt-1">
              Rationale must contain at least 15 non-whitespace characters (currently {trimmedRationale.length}).
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-4 py-2.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={`text-xs font-semibold text-white px-5 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              canSubmit
                ? "bg-brand-dark hover:bg-brand-dark/90 cursor-pointer shadow-xs"
                : "bg-gray-300 cursor-not-allowed text-gray-500"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            {isSubmitting ? "Recording Decision..." : "Record Decision"}
          </button>
        </div>
      </form>
    </div>
  );
};
