import React, { useState } from "react";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { ObservationForm } from "./components/observation/ObservationForm";
import { InterviewModal } from "./components/interview/InterviewModal";
import { EvidenceCaseView } from "./components/evidence/EvidenceCaseView";
import {
  createReport,
  uploadReportMedia,
  getEvidenceInterview,
  submitEvidenceInterviewAnswers,
  getEvidenceCase,
  getEvidenceTriage,
} from "./api/reports";
import { ReportCreate, ReportResponse } from "./types/report";
import { ReportMediaResponse } from "./types/media";
import {
  EvidenceInterviewQuestion,
  InterviewAnswerSubmission,
} from "./types/interview";
import { EvidenceCaseResponse, TriageResponse } from "./types/evidence_case";
import { ApiError } from "./api/client";
import { AlertCircle, RotateCcw } from "lucide-react";

type Stage = "form" | "interview" | "case" | "error";

export const App: React.FC = () => {
  const [stage, setStage] = useState<Stage>("form");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittingMessage, setSubmittingMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active workflow data
  const [activeReport, setActiveReport] = useState<ReportResponse | null>(null);
  const [activeMedia, setActiveMedia] = useState<ReportMediaResponse | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<EvidenceInterviewQuestion[]>([]);
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState<boolean>(false);

  // Final Results
  const [evidenceCase, setEvidenceCase] = useState<EvidenceCaseResponse | null>(null);
  const [triage, setTriage] = useState<TriageResponse | null>(null);

  const resetToForm = () => {
    setStage("form");
    setIsSubmitting(false);
    setSubmittingMessage("");
    setErrorMessage(null);
    setActiveReport(null);
    setActiveMedia(null);
    setInterviewQuestions([]);
    setIsSubmittingAnswers(false);
    setEvidenceCase(null);
    setTriage(null);
  };

  const loadCaseAndTriage = async (reportId: string) => {
    setSubmittingMessage("Assembling transparent Evidence Case...");
    try {
      const [caseData, triageData] = await Promise.all([
        getEvidenceCase(reportId),
        getEvidenceTriage(reportId).catch(() => null),
      ]);
      setEvidenceCase(caseData);
      setTriage(triageData);
      setStage("case");
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Failed to load evidence case.";
      setErrorMessage(msg);
      setStage("error");
    } finally {
      setIsSubmitting(false);
      setIsSubmittingAnswers(false);
    }
  };

  const handleFormSubmit = async (reportData: ReportCreate, mediaFile: File | null) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    let createdReport: ReportResponse;
    try {
      setSubmittingMessage("Creating citizen observation report...");
      createdReport = await createReport(reportData);
      setActiveReport(createdReport);
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof ApiError ? err.message : "Failed to submit observation.";
      setErrorMessage(msg);
      return;
    }

    // Media upload if selected
    if (mediaFile) {
      try {
        setSubmittingMessage("Uploading photographic evidence...");
        const mediaRecord = await uploadReportMedia(createdReport.id, mediaFile);
        setActiveMedia(mediaRecord);
      } catch (err: unknown) {
        setIsSubmitting(false);
        const msg = err instanceof ApiError ? err.message : "Media upload failed.";
        setErrorMessage(`Observation was saved, but photo upload failed: ${msg}`);
        return;
      }
    }

    // Evidence Interview step
    try {
      setSubmittingMessage("Assessing evidence completeness & interview...");
      const interviewData = await getEvidenceInterview(createdReport.id);

      if (interviewData.questions && interviewData.questions.length > 0) {
        setInterviewQuestions(interviewData.questions);
        setStage("interview");
        setIsSubmitting(false);
      } else {
        // No questions needed, proceed straight to evidence case
        await loadCaseAndTriage(createdReport.id);
      }
    } catch (err: unknown) {
      // Fallback: If interview fails, still load evidence case
      await loadCaseAndTriage(createdReport.id);
    }
  };

  const handleInterviewSubmit = async (answers: InterviewAnswerSubmission[]) => {
    if (!activeReport) return;
    setIsSubmittingAnswers(true);
    setErrorMessage(null);

    try {
      await submitEvidenceInterviewAnswers(activeReport.id, answers);
    } catch (err: unknown) {
      console.warn("Interview submission error:", err);
      // Even if saving some answers fails, still attempt to view case
    }

    await loadCaseAndTriage(activeReport.id);
  };

  const handleInterviewSkip = async () => {
    if (!activeReport) return;
    setIsSubmittingAnswers(true);
    await loadCaseAndTriage(activeReport.id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <Header
        onNewObservation={resetToForm}
        showNewButton={stage === "case" || stage === "error"}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {stage === "form" && (
          <ObservationForm
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
            submittingMessage={submittingMessage}
            errorMessage={errorMessage}
          />
        )}

        {stage === "interview" && (
          <InterviewModal
            questions={interviewQuestions}
            onSubmitAnswers={handleInterviewSubmit}
            onSkip={handleInterviewSkip}
            isSubmitting={isSubmittingAnswers}
          />
        )}

        {stage === "case" && evidenceCase && (
          <EvidenceCaseView
            evidenceCase={evidenceCase}
            triage={triage}
            onNewObservation={resetToForm}
          />
        )}

        {stage === "error" && (
          <div className="bg-brand-surface rounded-xl border border-brand-border p-8 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-red-100 text-brand-error flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-brand-text">Workflow Interrupted</h2>
            <p className="text-sm text-brand-secondary max-w-md mx-auto">
              {errorMessage || "An unexpected error occurred while processing your request."}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={resetToForm}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-brand-teal hover:bg-brand-dark transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Return to Observation Form</span>
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default App;
