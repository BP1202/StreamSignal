import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import { ObservationForm } from "./components/observation/ObservationForm";
import { InterviewModal } from "./components/interview/InterviewModal";
import { EvidenceCaseView } from "./components/evidence/EvidenceCaseView";
import * as api from "./api/reports";
import { EvidenceCaseResponse, TriageResponse } from "./types/evidence_case";

describe("ObservationForm Component", () => {
  it("renders all form elements, guidance, and controlled options", () => {
    render(
      <ObservationForm
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(screen.getByText("Submit Freshwater Observation")).toBeInTheDocument();
    expect(screen.getByLabelText(/Observation Time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Latitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Longitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Observation Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Water Appearance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Flow Condition/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Odor \/ Smell/i)).toBeInTheDocument();
    expect(screen.getByText(/Unnatural Foam Observed/i)).toBeInTheDocument();
    expect(screen.getByText(/Visible Litter \/ Debris/i)).toBeInTheDocument();
    expect(screen.getByText(/Dead Wildlife Observed/i)).toBeInTheDocument();
    expect(screen.getByText(/Click to select photo evidence/i)).toBeInTheDocument();
  });

  it("validates required description min length", async () => {
    const handleSubmit = vi.fn();
    render(<ObservationForm onSubmit={handleSubmit} isSubmitting={false} />);

    // Enter coordinates but short description
    fireEvent.change(screen.getByLabelText(/Latitude/i), { target: { value: "24.5" } });
    fireEvent.change(screen.getByLabelText(/Longitude/i), { target: { value: "73.5" } });
    fireEvent.change(screen.getByLabelText(/Observation Description/i), { target: { value: "ab" } });

    fireEvent.click(screen.getByRole("button", { name: /Submit Citizen Observation/i }));

    expect(await screen.findByText(/Description must be at least 3 characters long/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("validates latitude and longitude ranges", async () => {
    const handleSubmit = vi.fn();
    render(<ObservationForm onSubmit={handleSubmit} isSubmitting={false} />);

    fireEvent.change(screen.getByLabelText(/Latitude/i), { target: { value: "95.0" } });
    fireEvent.change(screen.getByLabelText(/Longitude/i), { target: { value: "-190.0" } });
    fireEvent.change(screen.getByLabelText(/Observation Description/i), { target: { value: "Valid description here" } });

    fireEvent.click(screen.getByRole("button", { name: /Submit Citizen Observation/i }));

    expect(await screen.findByText(/Latitude must be a valid number between -90 and 90/i)).toBeInTheDocument();
    expect(await screen.findByText(/Longitude must be a valid number between -180 and 180/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("allows selecting a photo and shows preview thumbnail and file details", () => {
    window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/fake-image-preview");
    window.URL.revokeObjectURL = vi.fn();

    render(<ObservationForm onSubmit={vi.fn()} isSubmitting={false} />);

    const file = new File(["dummy content"], "evidence_photo.jpg", { type: "image/jpeg" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText("evidence_photo.jpg")).toBeInTheDocument();
    expect(screen.getByText(/Remove photo/i)).toBeInTheDocument();
  });

  it("disables submit button and shows loading text while submitting", () => {
    render(
      <ObservationForm
        onSubmit={vi.fn()}
        isSubmitting={true}
        submittingMessage="Uploading photographic evidence..."
      />
    );

    const submitBtn = screen.getByRole("button", { name: /Uploading photographic evidence.../i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText("Uploading photographic evidence...")).toBeInTheDocument();
  });

  it("displays submission error banner when errorMessage is provided", () => {
    render(
      <ObservationForm
        onSubmit={vi.fn()}
        isSubmitting={false}
        errorMessage="Database connection failed"
      />
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Database connection failed")).toBeInTheDocument();
  });
});

describe("InterviewModal Component", () => {
  it("renders backend questions dynamically and submits answers", async () => {
    const handleSubmit = vi.fn();
    const handleSkip = vi.fn();

    const mockQuestions = [
      {
        question_id: "water_appearance",
        field: "water_appearance",
        question: "What did the water look like?",
        answer_type: "single_choice",
        options: [
          { label: "Clear", value: "clear" },
          { label: "Green material", value: "green_surface_material" },
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

    expect(screen.getByText("Evidence Interview — Targeted Follow-Up")).toBeInTheDocument();
    expect(screen.getByText("What did the water look like?")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
    expect(screen.getByText("Green material")).toBeInTheDocument();

    // Select Green material
    fireEvent.click(screen.getByText("Green material"));
    fireEvent.click(screen.getByRole("button", { name: /Save Answers/i }));

    expect(handleSubmit).toHaveBeenCalledWith([
      { question_id: "water_appearance", value: "green_surface_material" },
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

describe("EvidenceCaseView Component", () => {
  it("renders distinct citizen evidence, quality assessment, and provenance", () => {
    render(
      <EvidenceCaseView
        evidenceCase={mockCase}
        triage={mockTriage}
        onNewObservation={vi.fn()}
      />
    );

    expect(screen.getByText("Urban Freshwater Evidence Case")).toBeInTheDocument();
    expect(screen.getByText("Observed thick green layer on stream surface.")).toBeInTheDocument();
    expect(screen.getByText("sample_water.jpg")).toBeInTheDocument();
    expect(screen.getByText(/Quality: COMPLETE/i)).toBeInTheDocument();
    expect(screen.getByText(/100% Complete/i)).toBeInTheDocument();
    expect(screen.getByText("Awaiting human review")).toBeInTheDocument();
    expect(screen.getByText("No machine assistance has been generated yet.")).toBeInTheDocument();
  });

  it("strictly enforces non-diagnostic boundaries and limitations", () => {
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

describe("App State Machine Integration", () => {
  it("transitions from form submission through interview to evidence case view", async () => {
    window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/fake-image-preview");
    window.URL.revokeObjectURL = vi.fn();

    vi.spyOn(api, "createReport").mockResolvedValue({
      id: "test-report-uuid",
      status: "SUBMITTED",
      latitude: 24.5,
      longitude: 73.5,
      description: "Observed green water near canal",
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

    // Fill form
    fireEvent.change(screen.getByLabelText(/Latitude/i), { target: { value: "24.5" } });
    fireEvent.change(screen.getByLabelText(/Longitude/i), { target: { value: "73.5" } });
    fireEvent.change(screen.getByLabelText(/Observation Description/i), {
      target: { value: "Observed green water near canal" },
    });

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: /Submit Citizen Observation/i }));

    // Interview step should appear
    expect(await screen.findByText("Evidence Interview — Targeted Follow-Up")).toBeInTheDocument();
    expect(screen.getByText("How was the water moving?")).toBeInTheDocument();

    // Select answer and submit interview
    fireEvent.click(screen.getByText("Stagnant"));
    fireEvent.click(screen.getByRole("button", { name: /Save Answers/i }));

    // Case view should appear
    expect(await screen.findByText("Urban Freshwater Evidence Case")).toBeInTheDocument();
    expect(screen.getByText(/Quality: COMPLETE/i)).toBeInTheDocument();
  });
});
