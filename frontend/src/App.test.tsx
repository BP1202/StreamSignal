import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import { HeroLanding } from "./components/journey/HeroLanding";
import { PhotoCaptureStep } from "./components/journey/PhotoCaptureStep";
import { ObservationSignalsStep } from "./components/journey/ObservationSignalsStep";
import { LocationTimeStep } from "./components/journey/LocationTimeStep";
import { InterviewModal } from "./components/interview/InterviewModal";
import { EvidenceCaseView } from "./components/evidence/EvidenceCaseView";
import * as api from "./api/reports";
import { EvidenceCaseResponse, TriageResponse } from "./types/evidence_case";

describe("HeroLanding Component", () => {
  it("renders human-centric entry heading and action buttons", () => {
    const handlePhoto = vi.fn();
    const handleNoPhoto = vi.fn();

    render(
      <HeroLanding
        onStartWithPhoto={handlePhoto}
        onStartWithoutPhoto={handleNoPhoto}
      />
    );

    expect(
      screen.getByText("Notice something unusual in a stream?")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Capture what you see")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Or start without a photo/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Capture what you see"));
    expect(handlePhoto).toHaveBeenCalled();

    fireEvent.click(screen.getByText(/Or start without a photo/i));
    expect(handleNoPhoto).toHaveBeenCalled();
  });
});

describe("PhotoCaptureStep Component", () => {
  it("renders photo capture options, preview, and educational rationale", () => {
    window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/fake-preview");
    window.URL.revokeObjectURL = vi.fn();

    const handleSelect = vi.fn();
    const handleNext = vi.fn();
    const handleBack = vi.fn();

    render(
      <PhotoCaptureStep
        mediaFile={null}
        onSelectMedia={handleSelect}
        onNext={handleNext}
        onBack={handleBack}
      />
    );

    expect(screen.getByText("Show us what you saw")).toBeInTheDocument();
    expect(screen.getByText(/Why photo matters\?/i)).toBeInTheDocument();

    // Toggle why photo matters
    fireEvent.click(screen.getByText(/Why photo matters\?/i));
    expect(
      screen.getByText(/Your original image becomes part of the permanent evidence record/i)
    ).toBeInTheDocument();

    // Select file
    const file = new File(["dummy content"], "river_foam.jpg", { type: "image/jpeg" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(handleSelect).toHaveBeenCalledWith(file);
  });
});

describe("ObservationSignalsStep Component", () => {
  it("renders visual signal cards and validates description", () => {
    const handleNext = vi.fn();
    const handleBack = vi.fn();
    const handleChangeDesc = vi.fn();

    render(
      <ObservationSignalsStep
        description=""
        onChangeDescription={handleChangeDesc}
        waterAppearance=""
        onChangeWaterAppearance={vi.fn()}
        flowCondition=""
        onChangeFlowCondition={vi.fn()}
        odor=""
        onChangeOdor={vi.fn()}
        foamObserved={false}
        onToggleFoam={vi.fn()}
        litterObserved={false}
        onToggleLitter={vi.fn()}
        deadWildlifeObserved={false}
        onToggleWildlife={vi.fn()}
        onNext={handleNext}
        onBack={handleBack}
      />
    );

    expect(screen.getByText("What caught your attention?")).toBeInTheDocument();
    expect(screen.getByText("Unusual Color")).toBeInTheDocument();
    expect(screen.getByText("Foam or Suds")).toBeInTheDocument();
    expect(screen.getByText("Surface Sheen")).toBeInTheDocument();
    expect(screen.getByText("Visible Litter")).toBeInTheDocument();

    // Attempt continue with empty description
    fireEvent.click(screen.getByRole("button", { name: /Continue to location/i }));
    expect(
      screen.getByText(/Please describe what you observed \(at least 3 characters\)/i)
    ).toBeInTheDocument();
    expect(handleNext).not.toHaveBeenCalled();
  });
});

describe("LocationTimeStep Component", () => {
  it("renders GPS button, manual coordinate inputs, and validates ranges", async () => {
    const handleSubmit = vi.fn();

    render(
      <LocationTimeStep
        latitude="95.0"
        onChangeLatitude={vi.fn()}
        longitude="190.0"
        onChangeLongitude={vi.fn()}
        observedAt="2026-10-02T12:00"
        onChangeObservedAt={vi.fn()}
        hasMedia={true}
        hasDescription={true}
        hasCharacteristics={true}
        isSubmitting={false}
        onSubmit={handleSubmit}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText("Where & when did you see it?")).toBeInTheDocument();
    expect(screen.getByText(/Use Current Browser Location/i)).toBeInTheDocument();
    expect(screen.getByText(/Evidence Completeness/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create my Evidence Case/i }));

    expect(
      await screen.findByText(/Latitude must be a valid number between -90 and 90/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Longitude must be a valid number between -180 and 180/i)
    ).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});

describe("InterviewModal Component", () => {
  it("renders dynamic questions with why-we-ask explanations and submits answers", () => {
    const handleSubmit = vi.fn();
    const handleSkip = vi.fn();

    const mockQuestions = [
      {
        question_id: "flow_condition",
        field: "flow_condition",
        question: "How was the water moving?",
        answer_type: "single_choice",
        options: [
          { label: "Flowing normally", value: "flowing" },
          { label: "Stagnant", value: "stagnant" },
        ],
      },
    ];

    render(
      <InterviewModal
        questions={mockQuestions}
        onSubmitAnswers={handleSubmit}
        onSkip={handleSkip}
        isSubmitting={false}
      />
    );

    expect(screen.getByText("A couple of quick questions")).toBeInTheDocument();
    expect(screen.getByText("How was the water moving?")).toBeInTheDocument();
    expect(screen.getByText("Why this question?")).toBeInTheDocument();

    // Toggle why
    fireEvent.click(screen.getByText("Why this question?"));
    expect(
      screen.getByText(/Knowing whether water was flowing or stagnant helps researchers/i)
    ).toBeInTheDocument();

    // Select stagnant
    fireEvent.click(screen.getByText("Stagnant"));
    fireEvent.click(screen.getByRole("button", { name: /Save Answers/i }));

    expect(handleSubmit).toHaveBeenCalledWith([
      { question_id: "flow_condition", value: "stagnant" },
    ]);
  });
});

const mockCase: EvidenceCaseResponse = {
  case_id: "123e4567-e89b-12d3-a456-426614174000",
  report_id: "123e4567-e89b-12d3-a456-426614174000",
  status: "pending_review",
  created_at: new Date().toISOString(),
  citizen_evidence: {
    observation_time: new Date().toISOString(),
    location: { latitude: 24.5854, longitude: 73.7125 },
    description: "Observed thick green layer on stream surface.",
    water_appearance: "green_surface_material",
    flow_condition: "stagnant",
    odor: "musty_earthy",
    foam_observed: true,
    litter_observed: false,
    dead_wildlife_observed: false,
    media: [
      {
        id: "8c94dc45-f718-4dbb-958e-d94a57e63c04",
        report_id: "123e4567-e89b-12d3-a456-426614174000",
        original_filename: "sample_water.jpg",
        content_type: "image/jpeg",
        size_bytes: 1048576,
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        created_at: new Date().toISOString(),
      },
    ],
  },
  evidence_quality: {
    report_id: "123e4567-e89b-12d3-a456-426614174000",
    quality: "COMPLETE",
    score: 1.0,
    present: ["description", "location", "observed_at", "water_appearance", "flow_condition", "odor"],
    missing: [],
    recommendations: [],
  },
  machine_assistance: {
    status: "not_available",
    items: [],
  },
  contextual_evidence: {
    status: "not_available",
    items: [],
  },
  human_decision: {
    status: "pending_review",
    decision: null,
    reviewer: null,
    notes: null,
  },
  provenance: {
    source: "streamsignal",
    generated_at: new Date().toISOString(),
    components: ["citizen_report", "report_media", "evidence_quality", "evidence_interview"],
  },
};

const mockTriage: TriageResponse = {
  report_id: "123e4567-e89b-12d3-a456-426614174000",
  recommended_action: "EXPERT_REVIEW",
  reason_codes: ["VISUAL_EVIDENCE_REQUIRES_REVIEW", "HUMAN_VERIFICATION_REQUIRED"],
  evidence_summary: {
    quality: "COMPLETE",
    quality_score: 1.0,
    media_count: 1,
    visual_observation_count: 1,
    historical_match_count: 0,
    human_review_status: "PENDING",
  },
  explanation: [
    "Current media evidence contains structured visual observations.",
    "Visual features warrant human expert evaluation to interpret visible surface characteristics.",
  ],
  limitations: [
    "This recommendation concerns evidence handling only.",
    "Historical similarity does not establish environmental cause.",
    "Visual observations do not establish pollution, toxicity, health risk, or contamination.",
  ],
};

describe("EvidenceCaseView Component (SignalCase)", () => {
  it("renders reward framing, distinct evidence layers, and provenance", () => {
    render(
      <EvidenceCaseView
        evidenceCase={mockCase}
        triage={mockTriage}
        onNewObservation={vi.fn()}
      />
    );

    expect(screen.getByText(/Your observation is recorded/i)).toBeInTheDocument();
    expect(screen.getByText("#123E4567")).toBeInTheDocument();
    expect(screen.getByText(/Observed thick green layer on stream surface/i)).toBeInTheDocument();
    expect(screen.getByText("sample_water.jpg")).toBeInTheDocument();
    expect(screen.getByText(/Evidence Quality: COMPLETE/i)).toBeInTheDocument();
    expect(screen.getAllByText("Awaiting human review").length).toBeGreaterThanOrEqual(1);
  });

  it("strictly preserves scientific boundaries and non-diagnostic conclusions", () => {
    render(
      <EvidenceCaseView
        evidenceCase={mockCase}
        triage={mockTriage}
        onNewObservation={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Visual observations do not establish pollution, toxicity, health risk, or contamination/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Historical similarity does not establish environmental cause/i)
    ).toBeInTheDocument();

    expect(screen.queryByText(/Pollution confirmed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Water is toxic/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Algae bloom confirmed/i)).not.toBeInTheDocument();
  });
});

describe("Complete Guided Journey Integration", () => {
  it("orchestrates user from landing through capture, signals, location, interview, to SignalCase", async () => {
    window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/fake-preview");
    window.URL.revokeObjectURL = vi.fn();

    vi.spyOn(api, "createReport").mockResolvedValue({
      id: "test-report-uuid",
      status: "SUBMITTED",
      latitude: 24.5854,
      longitude: 73.7125,
      description: "I noticed green material along the canal bank",
      observed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    vi.spyOn(api, "getEvidenceInterview").mockResolvedValue({
      report_id: "test-report-uuid",
      questions: [
        {
          question_id: "flow_condition",
          field: "flow_condition",
          question: "How was the water moving?",
          answer_type: "single_choice",
          options: [{ label: "Stagnant", value: "stagnant" }],
        },
      ],
    });

    vi.spyOn(api, "submitEvidenceInterviewAnswers").mockResolvedValue({
      report_id: "test-report-uuid",
      updated_fields: ["flow_condition"],
      message: "Answers recorded",
      evidence_quality: {
        report_id: "test-report-uuid",
        quality: "COMPLETE",
        score: 1.0,
        present: ["description", "flow_condition"],
        missing: [],
        recommendations: [],
      },
    });

    vi.spyOn(api, "getEvidenceCase").mockResolvedValue(mockCase);
    vi.spyOn(api, "getEvidenceTriage").mockResolvedValue(mockTriage);

    render(<App />);

    // 1. Landing: click "Capture what you see"
    expect(screen.getByText("Notice something unusual in a stream?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Capture what you see"));

    // 2. Photo Capture Step: Click "Continue to observation"
    expect(await screen.findByText("Show us what you saw")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continue to observation/i }));

    // 3. Observation Signals Step: Select "Unusual Color" card & enter description
    expect(await screen.findByText("What caught your attention?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Unusual Color"));
    fireEvent.change(screen.getByLabelText(/Tell us what you noticed/i), {
      target: { value: "I noticed green material along the canal bank" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continue to location/i }));

    // 4. Location & Time Step: Enter coordinates and submit
    expect(await screen.findByText("Where & when did you see it?")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Latitude/i), { target: { value: "24.5854" } });
    fireEvent.change(screen.getByLabelText(/Longitude/i), { target: { value: "73.7125" } });
    fireEvent.click(screen.getByRole("button", { name: /Create my Evidence Case/i }));

    // 5. Adaptive Interview Step: Answer question
    expect(await screen.findByText("A couple of quick questions")).toBeInTheDocument();
    expect(screen.getByText("How was the water moving?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Stagnant"));
    fireEvent.click(screen.getByRole("button", { name: /Save Answers & View Evidence Case/i }));

    // 6. SignalCase View
    expect(await screen.findByText(/Your observation is recorded/i)).toBeInTheDocument();
    expect(screen.getByText("#123E4567")).toBeInTheDocument();
  });
});
