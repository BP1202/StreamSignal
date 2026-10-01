import React, { useState } from "react";
import { HelpCircle, ArrowRight, SkipForward } from "lucide-react";
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
      setValidationError("Please select or write an answer, or click 'Skip for now'.");
      return;
    }

    await onSubmitAnswers(submissions);
  };

  return (
    <div className="bg-brand-surface rounded-xl border border-brand-border p-6 shadow-xs space-y-6">
      <div className="flex items-start space-x-3 border-b border-brand-border pb-4">
        <div className="w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center text-brand-teal shrink-0">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-brand-text">
            Evidence Interview — Targeted Follow-Up
          </h2>
          <p className="text-xs text-brand-secondary mt-0.5">
            Your observation was recorded. Answering these targeted questions helps researchers complete the baseline evidence profile without speculative guesswork.
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
            className="p-4 rounded-xl border border-brand-border bg-gray-50/50 space-y-3"
          >
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-brand-dark bg-brand-light px-2 py-0.5 rounded-full">
                Question {idx + 1} of {questions.length}
              </span>
              <span className="text-xs text-brand-secondary uppercase tracking-wider font-semibold">
                Field: {q.field}
              </span>
            </div>

            <p className="text-sm font-semibold text-brand-text">{q.question}</p>

            {q.answer_type === "single_choice" && q.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {q.options.map((opt) => {
                  const isSelected = answers[q.question_id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectOption(q.question_id, opt.value)}
                      disabled={isSubmitting}
                      className={`text-left p-3 rounded-lg border text-xs font-medium transition-all ${
                        isSelected
                          ? "border-brand-teal bg-brand-light/40 text-brand-dark font-semibold ring-1 ring-brand-teal"
                          : "border-brand-border bg-white text-brand-text hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
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
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-medium text-brand-secondary hover:text-brand-text transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            <span>Skip for now</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-lg text-xs font-semibold text-white bg-brand-teal hover:bg-brand-dark disabled:opacity-50 transition-colors shadow-xs"
          >
            {isSubmitting ? (
              <span>Saving Answers...</span>
            ) : (
              <>
                <span>Save Answers & Generate Evidence Case</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
