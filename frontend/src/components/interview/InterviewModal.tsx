import React, { useState } from "react";
import { HelpCircle, ArrowRight, SkipForward, Sparkles, Check } from "lucide-react";
import {
  EvidenceInterviewQuestion,
  InterviewAnswerSubmission,
} from "../../types/interview";

interface InterviewModalProps {
  questions: EvidenceInterviewQuestion[];
  onSubmitAnswers: (answers: InterviewAnswerSubmission[]) => Promise<void>;
  onSkip: () => Promise<void>;
  isSubmitting: boolean;
}

export const InterviewModal: React.FC<InterviewModalProps> = ({
  questions,
  onSubmitAnswers,
  onSkip,
  isSubmitting,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [expandedWhy, setExpandedWhy] = useState<Record<string, boolean>>({});

  const handleSelectOption = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    setValidationError(null);
  };

  const handleTextChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    setValidationError(null);
  };

  const toggleWhy = (qid: string) => {
    setExpandedWhy((prev) => ({
      ...prev,
      [qid]: !prev[qid],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const submissions: InterviewAnswerSubmission[] = [];
    for (const q of questions) {
      const val = answers[q.question_id]?.trim();
      if (val) {
        submissions.push({
          question_id: q.question_id,
          value: val,
        });
      }
    }

    if (submissions.length === 0) {
      setValidationError("Please select an answer or click 'Skip for now'.");
      return;
    }

    await onSubmitAnswers(submissions);
  };

  const getWhyExplanation = (field: string) => {
    switch (field) {
      case "flow_condition":
        return "Knowing whether water was flowing or stagnant helps researchers distinguish temporary pooling from persistent flow conditions.";
      case "water_appearance":
        return "Specific surface descriptions allow correlation with visual observations and historical seasonal blooms.";
      case "odor":
        return "Documenting odors helps characterize potential organic decay or runoff without requiring citizens to identify the specific compound.";
      default:
        return "Targeted details complete baseline evidence dimensions without speculative guesswork.";
    }
  };

  return (
    <div className="bg-brand-surface rounded-2xl border border-brand-border p-3.5 sm:p-8 shadow-xs space-y-6">
      <div className="flex items-start space-x-3 border-b border-brand-border pb-4">
        <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center text-brand-teal shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-teal">
            Adaptive Follow-Up
          </span>
          <h2 className="text-xl font-bold text-brand-text mt-0.5">
            A couple of quick questions
          </h2>
          <p className="text-xs text-brand-secondary mt-1">
            Your observation was recorded. Answering these targeted questions helps researchers complete the baseline evidence profile without guesswork.
          </p>
        </div>
      </div>

      {validationError && (
        <div className="p-3 bg-amber-50 border border-brand-warning/30 rounded-lg text-xs text-amber-800">
          {validationError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map((q, idx) => (
          <div
            key={q.question_id}
            className="p-5 rounded-xl border border-brand-border bg-gray-50/50 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-dark bg-brand-light px-2.5 py-0.5 rounded-full">
                Question {idx + 1} of {questions.length}
              </span>
              <button
                type="button"
                onClick={() => toggleWhy(q.question_id)}
                className="text-xs text-brand-teal hover:underline flex items-center space-x-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Why this question?</span>
              </button>
            </div>

            {expandedWhy[q.question_id] && (
              <div className="p-2.5 rounded-lg bg-brand-light/30 border border-brand-teal/20 text-[11px] text-brand-dark leading-relaxed">
                {getWhyExplanation(q.field)}
              </div>
            )}

            <p className="text-sm font-bold text-brand-text pt-1">{q.question}</p>

            {q.answer_type === "single_choice" && q.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {q.options.map((opt) => {
                  const isSelected = answers[q.question_id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectOption(q.question_id, opt.value)}
                      disabled={isSubmitting}
                      className={`text-left p-3.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-brand-teal bg-brand-light/40 text-brand-dark font-bold ring-1 ring-brand-teal shadow-xs"
                          : "border-brand-border bg-white text-brand-text hover:bg-gray-50"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-brand-teal text-white flex items-center justify-center shrink-0 ml-2">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {q.answer_type === "free_text" && (
              <textarea
                rows={3}
                value={answers[q.question_id] || ""}
                onChange={(e) => handleTextChange(q.question_id, e.target.value)}
                disabled={isSubmitting}
                placeholder="Provide additional details regarding what you saw..."
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-xs bg-white focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
              />
            )}
          </div>
        ))}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-brand-border">
          <button
            type="button"
            onClick={onSkip}
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-semibold text-brand-secondary hover:text-brand-text transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            <span>Skip for now</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-brand-teal hover:bg-brand-dark disabled:opacity-50 transition-colors shadow-xs"
          >
            {isSubmitting ? (
              <span>Saving Answers...</span>
            ) : (
              <>
                <span>Save Answers & View Evidence Case</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
