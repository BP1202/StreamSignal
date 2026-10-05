import React, { useState, useEffect, useCallback, useRef } from "react";
import { Header, CitizenTab, ResearchTab } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { JourneyProgress } from "./components/journey/JourneyProgress";
import { HeroLanding } from "./components/journey/HeroLanding";
import { PhotoCaptureStep } from "./components/journey/PhotoCaptureStep";
import { ObservationSignalsStep } from "./components/journey/ObservationSignalsStep";
import { LocationTimeStep } from "./components/journey/LocationTimeStep";
import { InterviewModal } from "./components/interview/InterviewModal";
import { EvidenceCaseView } from "./components/evidence/EvidenceCaseView";
import { WaterSignalHome } from "./components/citizen/WaterSignalHome";
import { CitizenImpactView } from "./components/citizen/CitizenImpactView";
import {
  createReport,
  uploadReportMedia,
  getEvidenceInterview,
  submitEvidenceInterviewAnswers,
  getEvidenceCase,
  getEvidenceTriage,
} from "./api/reports";
import { ReportCreate, ReportResponse } from "./types/report";
import {
  EvidenceInterviewQuestion,
  InterviewAnswerSubmission,
} from "./types/interview";
import { EvidenceCaseResponse, TriageResponse } from "./types/evidence_case";
import { JourneyStep } from "./types/journey";
import { EvidenceInboxView } from "./components/research/EvidenceInboxView";
import { SignalCaseInvestigationView } from "./components/research/SignalCaseInvestigationView";
import { CitizenMissionPortal } from "./components/missions/CitizenMissionPortal";
import { ResearchAllMediaGallery } from "./components/research/ResearchAllMediaGallery";
import { LandingAuthModal } from "./components/auth/LandingAuthModal";
import { ApiError } from "./api/client";
import { AlertCircle, RotateCcw, Droplets } from "lucide-react";
import { getRouteState, navigateTo } from "./utils/routing";
import { useAppAuth } from "./auth/AuthProvider";

export const App: React.FC = () => {
  const auth = useAppAuth();
  // Top-level workspace mode: "citizen" (reporting journey) vs "missions" (Mission Agent) vs "research" (Research Workspace)
  const initialRoute = getRouteState();
  const [workspaceMode, setWorkspaceMode] = useState<"citizen" | "missions" | "research">(initialRoute.mode);
  const [citizenTab, setCitizenTab] = useState<CitizenTab>(initialRoute.citizenTab || "home");
  const [researchTab, setResearchTab] = useState<ResearchTab>("inbox");
  const [researchCaseId, setResearchCaseId] = useState<string | null>(initialRoute.caseId);

  // Authentication & session state
  const [userRole, setUserRole] = useState<"citizen" | "researcher" | null>(() => {
    if (auth.isAuthenticated) return "researcher";
    const saved = localStorage.getItem("streamsignal_auth_role");
    if (saved === "citizen" || saved === "researcher") return saved;
    if (localStorage.getItem("streamsignal_citizen_username")) return "citizen";
    if (localStorage.getItem("streamsignal_researcher_authenticated") === "true") return "researcher";
    return null;
  });

  const [citizenUsername, setCitizenUsername] = useState<string | null>(() => {
    return localStorage.getItem("streamsignal_citizen_username") || null;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(() => {
    const role = localStorage.getItem("streamsignal_auth_role");
    const hasCitizen = localStorage.getItem("streamsignal_citizen_username");
    return !role && !hasCitizen && !auth.isAuthenticated;
  });

  const handleCitizenEnter = (username: string, contributorId?: string) => {
    setUserRole("citizen");
    setCitizenUsername(username);
    localStorage.setItem("streamsignal_auth_role", "citizen");
    localStorage.setItem("streamsignal_citizen_username", username);
    if (contributorId) {
      localStorage.setItem("streamsignal_contributor_id", contributorId);
    }
    setIsLoginModalOpen(false);
  };

  const handleResearcherEnter = (reviewerId?: string) => {
    const activeReviewer =
      reviewerId ||
      localStorage.getItem("streamsignal_reviewer_id") ||
      "REV-RESEARCHER-001";
    setUserRole("researcher");
    localStorage.setItem("streamsignal_auth_role", "researcher");
    localStorage.setItem("streamsignal_researcher_authenticated", "true");
    localStorage.setItem("streamsignal_reviewer_id", activeReviewer);
    setWorkspaceMode("research");
    setResearchTab("inbox");
    setResearchCaseId(null);
    navigateTo("research", null);
    setIsLoginModalOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("streamsignal_auth_role");
    localStorage.removeItem("streamsignal_citizen_username");
    localStorage.removeItem("streamsignal_researcher_authenticated");
    localStorage.removeItem("streamsignal_contributor_id");
    localStorage.removeItem("streamsignal_reviewer_id");
    setUserRole(null);
    setCitizenUsername(null);
    setIsLoginModalOpen(true);
    setWorkspaceMode("citizen");
    setCitizenTab("home");
    navigateTo("citizen", null, "home");
    if (auth.isAuthenticated) {
      auth.signOut();
    }
  };


  const [currentStep, setCurrentStep] = useState<JourneyStep>("landing");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittingMessage, setSubmittingMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Citizen observation journey state
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const uploadedFilesRef = useRef<Set<File>>(new Set());
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
      setCitizenTab(route.citizenTab || "home");
      if (route.mode === "research") {
        setResearchCaseId(route.caseId);
      } else {
        setResearchCaseId(null);
        if (route.caseId) {
          loadCaseAndTriage(route.caseId, false);
        } else if (route.citizenTab !== "observe") {
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
    navigateTo("citizen", null, "home");
    setCitizenTab("home");
    setCurrentStep("landing");

    setIsSubmitting(false);
    setSubmittingMessage("");
    setErrorMessage(null);
    setMediaFiles([]);
    uploadedFilesRef.current.clear();
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

    let createdReport = activeReport;
    if (!createdReport) {
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
    }

    // Upload any attached files not already persisted by an earlier partial attempt.
    if (mediaFiles.length > 0) {
      try {
        for (const [index, mediaFile] of mediaFiles.entries()) {
          if (uploadedFilesRef.current.has(mediaFile)) continue;
          setSubmittingMessage(`Uploading media ${index + 1} of ${mediaFiles.length}...`);
          try {
            await uploadReportMedia(createdReport.id, mediaFile);
            uploadedFilesRef.current.add(mediaFile);
          } catch (uploadErr: unknown) {
            // If the report was deleted, reset, or not found on the backend (404),
            // self-heal: re-create the report and upload with the newly created report ID
            if (uploadErr instanceof ApiError && uploadErr.status === 404) {
              setSubmittingMessage("Recording fresh citizen observation report...");
              uploadedFilesRef.current.clear();
              createdReport = await createReport(reportData);
              setActiveReport(createdReport);
              await uploadReportMedia(createdReport.id, mediaFile);
              uploadedFilesRef.current.add(mediaFile);
            } else {
              throw uploadErr;
            }
          }
        }
      } catch (err: unknown) {
        setIsSubmitting(false);
        const msg = err instanceof ApiError ? err.message : "Media upload failed.";
        setErrorMessage(`Observation was saved, but a media upload failed: ${msg}`);
        return;
      }
    }

    // Evidence interview
    try {
      setSubmittingMessage("Evaluating evidence completeness...");
      let interviewData;
      try {
        interviewData = await getEvidenceInterview(createdReport.id);
      } catch (interviewErr: unknown) {
        if (interviewErr instanceof ApiError && interviewErr.status === 404) {
          createdReport = await createReport(reportData);
          setActiveReport(createdReport);
          interviewData = await getEvidenceInterview(createdReport.id);
        } else {
          throw interviewErr;
        }
      }

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

  if (workspaceMode === "research" && auth.isConfigured && auth.isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg p-6 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-8 text-center shadow-xs">
          <p className="text-sm font-semibold text-brand-text">Checking researcher access…</p>
        </div>
      </div>
    );
  }

  if (workspaceMode === "research" && auth.isConfigured && !auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-brand-bg p-6 flex items-center justify-center">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-8 text-center shadow-xs">
          <h1 className="text-xl font-bold text-brand-text">Researcher sign-in</h1>
          <p className="text-sm text-brand-secondary">Sign in with your authorized researcher account to review cases and original citizen media.</p>
          <button type="button" onClick={() => void auth.signIn()} className="rounded-lg bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (workspaceMode === "research" && auth.isConfigured && auth.isAuthenticated && !auth.hasResearcherRole) {
    return (
      <div className="min-h-screen bg-brand-bg p-6 flex items-center justify-center">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-8 text-center shadow-xs">
          <h1 className="text-xl font-bold text-brand-text">Researcher access required</h1>
          <p className="text-sm text-brand-secondary">This account does not have the configured researcher role.</p>
          <button type="button" onClick={auth.signOut} className="rounded-lg border border-brand-border bg-white px-5 py-2.5 text-sm font-semibold text-brand-text hover:bg-brand-bg">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <LandingAuthModal
        isOpen={isLoginModalOpen || !userRole}
        onCitizenEnter={handleCitizenEnter}
        onResearcherEnter={handleResearcherEnter}
        isAuth0Configured={auth.isConfigured}
        onAuth0SignIn={auth.signIn}
        onClose={userRole ? () => setIsLoginModalOpen(false) : undefined}
      />

      <Header
        mode={workspaceMode}
        citizenTab={citizenTab}
        researchTab={researchTab}
        userRole={userRole}
        citizenUsername={citizenUsername}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onSwitchCitizenTab={(tab) => {
          setCitizenTab(tab);
          if (tab === "missions") {
            setWorkspaceMode("missions");
            navigateTo("missions", null);
          } else {
            setWorkspaceMode("citizen");
            if (tab === "observe") {
              setActiveReport(null);
              uploadedFilesRef.current.clear();
              setCurrentStep("landing");
              navigateTo("citizen", null, "observe");
            } else if (tab === "impact") {
              navigateTo("citizen", null, "impact");
            } else {
              navigateTo("citizen", null, "home");
            }
          }
        }}
        onSwitchResearchTab={(tab) => {
          setResearchTab(tab);
          setWorkspaceMode("research");
          if (tab === "inbox" || tab === "gaps" || tab === "media") {
            setResearchCaseId(null);
            navigateTo("research", null);
          }
        }}
        onSwitchMode={(mode) => {
          setWorkspaceMode(mode);
          if (mode === "research") {
            if (!userRole) {
              setIsLoginModalOpen(true);
            }
            setResearchCaseId(null);
            navigateTo("research", null);
          } else if (mode === "missions") {
            setCitizenTab("missions");
            setResearchCaseId(null);
            navigateTo("missions", null);
          } else {
            setActiveReport(null);
            uploadedFilesRef.current.clear();
            setCitizenTab("observe");
            setCurrentStep("landing");
            navigateTo("citizen", null, "observe");
          }
        }}
      />

      <main className="flex-1 w-full mx-auto">
        {!userRole ? (
          <div className="max-w-screen-2xl mx-auto px-4 py-16 text-center space-y-4">
            <div className="max-w-lg mx-auto p-8 rounded-3xl bg-brand-surface border border-brand-border shadow-xs space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-brand-teal mx-auto">
                <Droplets className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-brand-text">Please sign in to access StreamSignal</h2>
              <p className="text-xs text-brand-secondary">
                Citizen observations, watershed missions, and research evidence cases require entering as a citizen contributor or authorized researcher.
              </p>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-brand-teal text-white text-xs font-bold hover:bg-cyan-600 transition-colors shadow-sm"
              >
                Sign In / Get Started
              </button>
            </div>
          </div>
        ) : workspaceMode === "missions" || (workspaceMode === "citizen" && citizenTab === "missions") ? (
          <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
            <CitizenMissionPortal
              onCaseCreated={(caseId) => {
                setWorkspaceMode("research");
                setResearchCaseId(caseId);
                navigateTo("research", caseId);
              }}
              onGoToObserve={() => {
                setActiveReport(null);
                uploadedFilesRef.current.clear();
                setWorkspaceMode("citizen");
                setCitizenTab("observe");
                setCurrentStep("landing");
                navigateTo("citizen", null, "observe");
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
          ) : researchTab === "media" ? (
            <ResearchAllMediaGallery
              onSelectCase={(caseId) => {
                setResearchCaseId(caseId);
                navigateTo("research", caseId);
              }}
            />
          ) : (
            <EvidenceInboxView
              initialWorkspaceTab={researchTab === "gaps" ? "gaps_and_needs" : "inbox"}
              onSelectCase={(caseId) => {
                setResearchCaseId(caseId);
                navigateTo("research", caseId);
              }}
            />
          )
        ) : (
          <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
            {currentStep === "case" && evidenceCase ? (
              <EvidenceCaseView
                evidenceCase={evidenceCase}
                triage={triage}
                onNewObservation={resetJourney}
              />
            ) : currentStep === "error" ? (
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
            ) : citizenTab === "impact" ? (
              <CitizenImpactView
                onGoToMissions={() => {
                  setCitizenTab("missions");
                  setWorkspaceMode("missions");
                  navigateTo("missions", null);
                }}
                onGoToObserve={() => {
                  setActiveReport(null);
                  uploadedFilesRef.current.clear();
                  setCitizenTab("observe");
                  setCurrentStep("landing");
                  navigateTo("citizen", null, "observe");
                }}
                onSelectCase={(caseId) => {
                  setWorkspaceMode("research");
                  setResearchCaseId(caseId);
                  navigateTo("research", caseId);
                }}
              />
            ) : citizenTab === "home" && currentStep === "landing" ? (
              <WaterSignalHome
                onStartWithPhoto={() => {
                  setActiveReport(null);
                  uploadedFilesRef.current.clear();
                  setCitizenTab("observe");
                  setCurrentStep("capture");
                  navigateTo("citizen", null, "observe");
                }}
                onStartWithoutPhoto={() => {
                  setActiveReport(null);
                  uploadedFilesRef.current.clear();
                  setCitizenTab("observe");
                  setCurrentStep("signals");
                  navigateTo("citizen", null, "observe");
                }}
                onGoToMissions={() => {
                  setCitizenTab("missions");
                  setWorkspaceMode("missions");
                  navigateTo("missions", null);
                }}
                onGoToImpact={() => {
                  setCitizenTab("impact");
                  navigateTo("citizen", null, "impact");
                }}
              />
            ) : (
              <>
                <JourneyProgress currentStep={currentStep} />

                {currentStep === "landing" && (
                  <HeroLanding
                    onStartWithPhoto={() => {
                      setActiveReport(null);
                      uploadedFilesRef.current.clear();
                      setCurrentStep("capture");
                    }}
                    onStartWithoutPhoto={() => {
                      setActiveReport(null);
                      uploadedFilesRef.current.clear();
                      setCurrentStep("signals");
                    }}
                  />
                )}

                {currentStep === "capture" && (
                  <PhotoCaptureStep
                    mediaFiles={mediaFiles}
                    onSelectMedia={setMediaFiles}
                    onNext={() => setCurrentStep("signals")}
                    onBack={() => {
                      setCitizenTab("home");
                      setCurrentStep("landing");
                      navigateTo("citizen", null, "home");
                    }}
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
                    onBack={() => (mediaFiles.length > 0 ? setCurrentStep("capture") : setCurrentStep("landing"))}
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
                    hasMedia={mediaFiles.length > 0}
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
              </>
            )}
          </div>
        )}
      </main>


      <Footer />
    </div>
  );
};

export default App;
