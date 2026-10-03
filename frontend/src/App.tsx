import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { JourneyProgress } from "./components/journey/JourneyProgress";
import { HeroLanding } from "./components/journey/HeroLanding";
import { PhotoCaptureStep } from "./components/journey/PhotoCaptureStep";
import { ObservationSignalsStep } from "./components/journey/ObservationSignalsStep";
import { LocationTimeStep } from "./components/journey/LocationTimeStep";
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
import { JourneyStep } from "./types/journey";
import { EvidenceInboxView } from "./components/research/EvidenceInboxView";
import { SignalCaseInvestigationView } from "./components/research/SignalCaseInvestigationView";
import { CitizenMissionPortal } from "./components/missions/CitizenMissionPortal";
import { ApiError } from "./api/client";
import { AlertCircle, RotateCcw } from "lucide-react";
import { getRouteState, navigateTo } from "./utils/routing";

export const App: React.FC = () => {
  // Top-level workspace mode: "citizen" (reporting journey) vs "missions" (Mission Agent) vs "research" (Research Workspace)
  const initialRoute = getRouteState();
  const [workspaceMode, setWorkspaceMode] = useState<"citizen" | "missions" | "research">(initialRoute.mode);
  const [researchCaseId, setResearchCaseId] = useState<string | null>(initialRoute.caseId);

  const [currentStep, setCurrentStep] = useState<JourneyStep>("landing");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittingMessage, setSubmittingMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Citizen observation journey state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [description, setDescription] = useState<string>("");
  const [waterAppearance, setWaterAppearance] = useState<string>("");
  const [flowCondition, setFlowCondition] = useState<string>("");
  const [odor, setOdor] = useState<string>("");
  const [foamObserved, setFoamObserved] = useState<boolean>(false);
  const [litterObserved, setLitterObserved] = useState<boolean>(false);
  const [deadWildlifeObserved, setDeadWildlifeObserved] = useState<boolean>(false);

  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [observedAt, setObservedAt] = useState<string>(() => {
    return new Date().toISOString().slice(0, 16);
  });

  // Backend state
  const [activeReport, setActiveReport] = useState<ReportResponse | null>(null);
  const [activeMedia, setActiveMedia] = useState<ReportMediaResponse | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<EvidenceInterviewQuestion[]>([]);
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState<boolean>(false);
  const [evidenceCase, setEvidenceCase] = useState<EvidenceCaseResponse | null>(null);
  const [triage, setTriage] = useState<TriageResponse | null>(null);

  const loadCaseAndTriage = useCallback(async (reportId: string, updateUrl: boolean = true) => {
    setIsSubmitting(true);
    setSubmittingMessage("Assembling transparent Evidence Case...");
    try {
      const [caseData, triageData] = await Promise.all([
        getEvidenceCase(reportId),
        getEvidenceTriage(reportId).catch(() => null),
      ]);
      setEvidenceCase(caseData);
      setTriage(triageData);
      setCurrentStep("case");
      if (updateUrl) {
        navigateTo("citizen", reportId);
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Failed to load evidence case.";
      setErrorMessage(msg);
      setCurrentStep("error");
    } finally {
      setIsSubmitting(false);
      setIsSubmittingAnswers(false);
    }
  }, []);

  // Listen to popstate for browser back/forward and URL navigation
  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteState();
      setWorkspaceMode(route.mode);
      if (route.mode === "research") {
        setResearchCaseId(route.caseId);
      } else {
        setResearchCaseId(null);
        if (route.caseId) {
          loadCaseAndTriage(route.caseId, false);
        } else {
          setCurrentStep("landing");
        }
      }
    };

    window.addEventListener("popstate", handlePopState);

    // Initial load: if URL is /citizen?caseId=..., fetch case immediately
    const route = getRouteState();
    if (route.mode === "citizen" && route.caseId) {
      loadCaseAndTriage(route.caseId, false);
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [loadCaseAndTriage]);

  const resetJourney = () => {
    navigateTo("citizen", null);
    setCurrentStep("landing");
    setIsSubmitting(false);
    setSubmittingMessage("");
    setErrorMessage(null);
    setMediaFile(null);
    setDescription("");
    setWaterAppearance("");
    setFlowCondition("");
    setOdor("");
    setFoamObserved(false);
    setLitterObserved(false);
    setDeadWildlifeObserved(false);
    setLatitude("");
    setLongitude("");
    setObservedAt(new Date().toISOString().slice(0, 16));
    setActiveReport(null);
    setActiveMedia(null);
    setInterviewQuestions([]);
    setIsSubmittingAnswers(false);
    setEvidenceCase(null);
    setTriage(null);
  };


  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);

    const reportData: ReportCreate = {
      observed_at: new Date(observedAt).toISOString(),
      latitude: latNum,
      longitude: lonNum,
      description: description.trim(),
      water_appearance: waterAppearance || null,
      flow_condition: flowCondition || null,
      odor: odor || null,
      foam_observed: foamObserved,
      litter_observed: litterObserved,
      dead_wildlife_observed: deadWildlifeObserved,
    };

    let createdReport: ReportResponse;
    try {
      setSubmittingMessage("Recording citizen observation report...");
      createdReport = await createReport(reportData);
      setActiveReport(createdReport);
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof ApiError ? err.message : "Failed to submit observation.";
      setErrorMessage(msg);
      return;
    }

    // Media upload if attached
    if (mediaFile) {
      try {
        setSubmittingMessage("Uploading original photo evidence...");
        const mediaRecord = await uploadReportMedia(createdReport.id, mediaFile);
        setActiveMedia(mediaRecord);
      } catch (err: unknown) {
        setIsSubmitting(false);
        const msg = err instanceof ApiError ? err.message : "Media upload failed.";
        setErrorMessage(`Observation was saved, but photo upload failed: ${msg}`);
        return;
      }
    }

    // Evidence interview
    try {
      setSubmittingMessage("Evaluating evidence completeness...");
      const interviewData = await getEvidenceInterview(createdReport.id);

      if (interviewData.questions && interviewData.questions.length > 0) {
        setInterviewQuestions(interviewData.questions);
        setCurrentStep("interview");
        setIsSubmitting(false);
      } else {
        await loadCaseAndTriage(createdReport.id);
      }
    } catch (err: unknown) {
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
        onNewObservation={resetJourney}
        showNewButton={workspaceMode === "citizen" && currentStep !== "landing"}
        mode={workspaceMode}
        onSwitchMode={(mode) => {
          setWorkspaceMode(mode);
          if (mode === "research") {
            setResearchCaseId(null);
            navigateTo("research", null);
          } else if (mode === "missions") {
            setResearchCaseId(null);
            navigateTo("missions", null);
          } else {
            navigateTo("citizen", null);
          }
        }}
      />

      <main className="flex-1 w-full mx-auto">
        {workspaceMode === "missions" ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <CitizenMissionPortal
              onCaseCreated={(caseId) => {
                setWorkspaceMode("research");
                setResearchCaseId(caseId);
                navigateTo("research", caseId);
              }}
            />
          </div>
        ) : workspaceMode === "research" ? (
          researchCaseId ? (
            <SignalCaseInvestigationView
              caseId={researchCaseId}
              onBackToInbox={() => {
                setResearchCaseId(null);
                navigateTo("research", null);
              }}
            />
          ) : (
            <EvidenceInboxView
              onSelectCase={(caseId) => {
                setResearchCaseId(caseId);
                navigateTo("research", caseId);
              }}
            />
          )
        ) : (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <JourneyProgress currentStep={currentStep} />

            {currentStep === "landing" && (
              <HeroLanding
                onStartWithPhoto={() => setCurrentStep("capture")}
                onStartWithoutPhoto={() => setCurrentStep("signals")}
              />
            )}

        {currentStep === "capture" && (
          <PhotoCaptureStep
            mediaFile={mediaFile}
            onSelectMedia={(file) => setMediaFile(file)}
            onNext={() => setCurrentStep("signals")}
            onBack={() => setCurrentStep("landing")}
          />
        )}

        {currentStep === "signals" && (
          <ObservationSignalsStep
            description={description}
            onChangeDescription={setDescription}
            waterAppearance={waterAppearance}
            onChangeWaterAppearance={setWaterAppearance}
            flowCondition={flowCondition}
            onChangeFlowCondition={setFlowCondition}
            odor={odor}
            onChangeOdor={setOdor}
            foamObserved={foamObserved}
            onToggleFoam={setFoamObserved}
            litterObserved={litterObserved}
            onToggleLitter={setLitterObserved}
            deadWildlifeObserved={deadWildlifeObserved}
            onToggleWildlife={setDeadWildlifeObserved}
            onNext={() => setCurrentStep("location")}
            onBack={() => (mediaFile ? setCurrentStep("capture") : setCurrentStep("landing"))}
          />
        )}

        {currentStep === "location" && (
          <LocationTimeStep
            latitude={latitude}
            onChangeLatitude={setLatitude}
            longitude={longitude}
            onChangeLongitude={setLongitude}
            observedAt={observedAt}
            onChangeObservedAt={setObservedAt}
            hasMedia={Boolean(mediaFile)}
            hasDescription={Boolean(description.trim())}
            hasCharacteristics={Boolean(waterAppearance || flowCondition || odor || foamObserved || litterObserved || deadWildlifeObserved)}
            isSubmitting={isSubmitting}
            submittingMessage={submittingMessage}
            errorMessage={errorMessage}
            onSubmit={handleFinalSubmit}
            onBack={() => setCurrentStep("signals")}
          />
        )}

        {currentStep === "interview" && (
          <InterviewModal
            questions={interviewQuestions}
            onSubmitAnswers={handleInterviewSubmit}
            onSkip={handleInterviewSkip}
            isSubmitting={isSubmittingAnswers}
          />
        )}

        {currentStep === "case" && evidenceCase && (
          <EvidenceCaseView
            evidenceCase={evidenceCase}
            triage={triage}
            onNewObservation={resetJourney}
          />
        )}

        {currentStep === "error" && (
          <div className="bg-brand-surface rounded-2xl border border-brand-border p-8 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-red-100 text-brand-error flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-brand-text">Workflow Interrupted</h2>
            <p className="text-sm text-brand-secondary max-w-md mx-auto">
              {errorMessage || "An unexpected error occurred while processing your observation."}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={resetJourney}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-brand-teal hover:bg-brand-dark transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Start Anew</span>
              </button>
            </div>
          </div>
        )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default App;
