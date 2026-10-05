import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import { EvidenceInboxView } from "./components/research/EvidenceInboxView";
import { SignalCaseInvestigationView } from "./components/research/SignalCaseInvestigationView";
import { HumanReviewPanel } from "./components/research/HumanReviewPanel";
import * as researchApi from "./api/research";
import {
  ResearchInboxResponse,
  ResearchCaseDetailResponse,
  HumanReviewItem,
} from "./types/research";
import { ApiError } from "./api/client";
import { navigateTo } from "./utils/routing";

const mockInboxResponse: ResearchInboxResponse = {
  items: [
    {
      case_id: "11111111-1111-1111-1111-111111111111",
      observed_at: "2026-10-01T12:00:00Z",
      location: {
        latitude: 23.0225,
        longitude: 72.5714,
      },
      description: "Dense green film covering water surface near bridge.",
      water_appearance: "green_surface_material",
      flow_condition: "stagnant",
      odor: "musty_earthy",
      quality_rating: "PARTIAL",
      completeness_score: 0.67,
      media_count: 2,
      pattern_echo_count: 3,
      triage_action: "EXPERT_REVIEW",
      triage_reasons: [
        "VISUAL_EVIDENCE_REQUIRES_REVIEW",
        "REPEATED_HISTORICAL_CONTEXT",
      ],
      human_decision_status: "PENDING",
      workflow_status: "AWAITING_REVIEW",
      evidence_state: "E4_CORROBORATED",
      why_surfaced: [
        {
          category: "TRIAGE_ACTION",
          summary: "High-priority expert review recommended",
          details: "Triggered by triage rules: VISUAL_EVIDENCE_REQUIRES_REVIEW",
        },
        {
          category: "VISUAL_EVIDENCE",
          summary: "Visual characteristics detected in uploaded media warrant review",
          details: "1 visual observation cue(s) extracted from citizen media.",
        },
        {
          category: "HISTORICAL_CONTEXT",
          summary: "3 nearby historical observations share relevant signals",
          details: "Historical recurrence identified within spatial and temporal proximity.",
        },
        {
          category: "EVIDENCE_COMPLETENESS",
          summary: "Evidence completeness is 67% (PARTIAL)",
          details: "4 fields documented, 2 fields missing.",
        },
        {
          category: "HUMAN_REVIEW_STATE",
          summary: "Human review status: PENDING",
          details: "No human decision has been recorded yet. Investigation pending.",
        },
      ],
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const mockCaseDetailResponse: ResearchCaseDetailResponse = {
  case_id: "11111111-1111-1111-1111-111111111111",
  observed_at: "2026-10-01T12:00:00Z",
  location: {
    latitude: 23.0225,
    longitude: 72.5714,
  },
  description: "Dense green film covering water surface near bridge.",
  water_appearance: "green_surface_material",
  flow_condition: "stagnant",
  odor: "musty_earthy",
  foam_observed: true,
  litter_observed: false,
  dead_wildlife_observed: false,
  human_decision_status: "PENDING",
  workflow_status: "AWAITING_REVIEW",
  evidence_state: "E4_CORROBORATED",
  latest_human_review: null,
  review_count: 0,
  lineage_count: 0,
  why_surfaced: [
    {
      category: "TRIAGE_ACTION",
      summary: "High-priority expert review recommended",
      details: "Triggered by triage rules: VISUAL_EVIDENCE_REQUIRES_REVIEW",
    },
    {
      category: "VISUAL_EVIDENCE",
      summary: "Visual characteristics detected in uploaded media warrant review",
    },
    {
      category: "HISTORICAL_CONTEXT",
      summary: "3 nearby historical observations share relevant signals",
    },
  ],
  evidence_quality: {
    report_id: "11111111-1111-1111-1111-111111111111",
    quality: "PARTIAL",
    score: 0.67,
    present: ["water_appearance", "odor", "flow_condition", "foam_observed"],
    missing: ["stream_name", "surrounding_conditions"],
    recommendations: ["Document stream segment"],
  },
  media: [],
  media_observations: [
    {
      media_id: "22222222-2222-2222-2222-222222222222",
      observations: [
        {
          observation_id: "obs-1",
          media_id: "22222222-2222-2222-2222-222222222222",
          observation_type: "GREEN VISUAL REGION",
          evidence_class: "E2_OBSERVED",
          description: "Dominant green coloration detected on water surface.",
          uncertainty: "Color metrics alone cannot confirm biological taxonomy.",
          support: {
            media_id: "22222222-2222-2222-2222-222222222222",
            sha256: "abc",
            content_type: "image/jpeg",
          },
        },
      ],
    },
  ],
  contextual_evidence: {
    report_id: "11111111-1111-1111-1111-111111111111",
    status: "AVAILABLE",
    search_radius_meters: 1000,
    historical_window_days: 30,
    matches: [
      {
        report_id: "33333333-3333-3333-3333-333333333333",
        observed_at: "2026-09-25T10:00:00Z",
        distance_meters: 250,
        days_difference: 6,
        matched_signals: ["green_surface_material"],
        similarity_explanation: ["Similar green film documented 250m upstream"],
      },
    ],
    summary: "3 similar historical observations were found nearby.",
    interpretation_limit: "Historical similarity indicates recurrence, not environmental causation.",
  },
  triage: {
    report_id: "11111111-1111-1111-1111-111111111111",
    recommended_action: "EXPERT_REVIEW",
    reason_codes: ["VISUAL_EVIDENCE_REQUIRES_REVIEW"],
    summary: "Expert evaluation recommended based on visual cue.",
    evidence_summary: {
      evidence_quality_tier: "PARTIAL",
      media_count: 1,
      visual_observation_count: 1,
      historical_match_count: 1,
      human_decision_status: "PENDING",
    },
  },
  evidence_contract: {
    report_id: "11111111-1111-1111-1111-111111111111",
    contract_version: "1.0",
    created_at: "2026-10-01T12:00:00Z",
    claims: [
      {
        claim_id: "claim-1",
        claim: "Green surface film observed",
        evidence_class: "E1_REPORTED",
        source: "report.water_appearance",
        support: ["citizen_observation"],
        uncertainty: ["Visual perception only"],
        allowed_actions: ["MONITOR", "REQUEST_MORE_EVIDENCE", "EXPERT_REVIEW"],
        prohibited_interpretations: ["POLLUTION_CONFIRMED", "TOXICITY_CONFIRMED"],
      },
    ],
    provenance: {
      system: "streamsignal",
      governance_standard: "IEEE_1OH",
      evaluated_at: "2026-10-01T12:00:00Z",
    },
  },
};

const mockRecordedReview: HumanReviewItem = {
  id: "review-1",
  case_id: "11111111-1111-1111-1111-111111111111",
  report_id: "11111111-1111-1111-1111-111111111111",
  reviewer_id: "R-042",
  outcome: "REQUEST_FIELD_VERIFICATION",
  rationale: "Recurring visual characteristics and 3 nearby corroborating reports warrant physical on-site check.",
  linked_case_id: null,
  evidence_state_before: "E4_CORROBORATED",
  evidence_state_after: "E4_CORROBORATED",
  workflow_status: "FIELD_VERIFICATION_REQUESTED",
  created_at: "2026-10-02T16:30:00Z",
};

describe("EvidenceInboxView Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads and displays evidence cases with Why-This-Case rationales", async () => {
    vi.spyOn(researchApi, "fetchResearchInbox").mockResolvedValue(mockInboxResponse);
    const handleSelect = vi.fn();

    render(<EvidenceInboxView onSelectCase={handleSelect} />);

    expect(screen.getByText(/Loading evidence/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Research Evidence Workspace")).toBeInTheDocument();
    });

    expect(screen.getByText("SS-11111111")).toBeInTheDocument();
    expect(screen.getByText("High-priority expert review recommended")).toBeInTheDocument();
    expect(screen.getByText(/3 nearby historical observations/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Investigate Evidence Case"));
    expect(handleSelect).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
  });

  it("displays empty state when no cases match", async () => {
    vi.spyOn(researchApi, "fetchResearchInbox").mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    render(<EvidenceInboxView onSelectCase={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/No evidence cases match the selected filters/i)).toBeInTheDocument();
    });
  });

  it("displays error state on API failure and allows retry", async () => {
    vi.spyOn(researchApi, "fetchResearchInbox").mockRejectedValue(new ApiError(500, "Server Error"));

    render(<EvidenceInboxView onSelectCase={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Server Error")).toBeInTheDocument();
    });

    vi.spyOn(researchApi, "fetchResearchInbox").mockResolvedValue(mockInboxResponse);
    fireEvent.click(screen.getByRole("button", { name: /Retry|Try Again/i }));

    await waitFor(() => {
      expect(screen.getByText("SS-11111111")).toBeInTheDocument();
    });
  });
});

describe("SignalCaseInvestigationView Component (Issue 13)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders citizen evidence, evidence quality, contextual evidence, and review without unreliable cue/provenance panels", async () => {
    vi.spyOn(researchApi, "fetchResearchCaseDetail").mockResolvedValue(mockCaseDetailResponse);
    const handleBack = vi.fn();

    render(
      <SignalCaseInvestigationView
        caseId="11111111-1111-1111-1111-111111111111"
        onBackToInbox={handleBack}
      />
    );

    expect(screen.getByText(/Loading evidence/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("SignalCase Investigation")).toBeInTheDocument();
    });

    // Header & Why this case
    expect(screen.getByText(/Why This Case Surfaced for Investigation/i)).toBeInTheDocument();
    expect(screen.getByText("High-priority expert review recommended")).toBeInTheDocument();

    // Layer 1: Citizen Evidence
    expect(screen.getByText("1. Reported observation")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Dense green film covering water surface near bridge/i).length
    ).toBeGreaterThanOrEqual(1);

    // Layer 2: Evidence Quality
    expect(screen.getByText("2. Evidence completeness")).toBeInTheDocument();
    expect(screen.getByText(/Completeness Score: 67%/i)).toBeInTheDocument();

    expect(screen.queryByText(/Visual Evidence & Machine Observations/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SignalGuard.*Claim Inspector/i)).not.toBeInTheDocument();

    // Layer 4: Contextual Evidence Pattern Echo
    expect(screen.getByText("3. Historical context: Pattern Echo")).toBeInTheDocument();
    expect(screen.getByText(/3 similar historical observations were found/i)).toBeInTheDocument();
    expect(screen.getByText(/Historical similarity indicates recurrence, not environmental causation/i)).toBeInTheDocument();

    expect(screen.queryByText(/EVIDENCE LINEAGE AUDIT TRAIL/i)).not.toBeInTheDocument();

    // Start Review action button exists
    const startReviewBtns = screen.getAllByRole("button", { name: /Start Review/i });
    expect(startReviewBtns.length).toBeGreaterThanOrEqual(1);

    // Clicking Start Review toggles HumanReviewPanel open
    fireEvent.click(startReviewBtns[0]);
    expect(screen.getByText("RESEARCHER REVIEW")).toBeInTheDocument();
    expect(screen.getByText("Request field verification")).toBeInTheDocument();

    // Back to inbox button
    fireEvent.click(screen.getByText("Back to Evidence Inbox"));
    expect(handleBack).toHaveBeenCalled();
  });

  it("renders Latest Human Decision card when case has already been reviewed", async () => {
    const reviewedCase: ResearchCaseDetailResponse = {
      ...mockCaseDetailResponse,
      human_decision_status: "FIELD_VERIFICATION_REQUESTED",
      workflow_status: "FIELD_VERIFICATION_REQUESTED",
      latest_human_review: mockRecordedReview,
      review_count: 1,
      lineage_count: 1,
    };

    vi.spyOn(researchApi, "fetchResearchCaseDetail").mockResolvedValue(reviewedCase);

    render(
      <SignalCaseInvestigationView
        caseId="11111111-1111-1111-1111-111111111111"
        onBackToInbox={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("LATEST HUMAN DECISION")).toBeInTheDocument();
      expect(screen.getByText("REQUEST FIELD VERIFICATION")).toBeInTheDocument();
      expect(screen.getByText(/Recurring visual characteristics and 3 nearby corroborating reports/i)).toBeInTheDocument();
      expect(screen.getByText("Recorded by R-042")).toBeInTheDocument();
    });
  });

  it("renders the real citizen image and video from protected binary endpoints", async () => {
    const caseWithMedia: ResearchCaseDetailResponse = {
      ...mockCaseDetailResponse,
      media: [
        {
          media_id: "photo-media-id",
          original_filename: "water_stream.jpg",
          content_type: "image/jpeg",
          size_bytes: 1234,
          created_at: "2026-10-01T12:05:00Z",
        },
        {
          media_id: "video-media-id",
          original_filename: "outfall.mp4",
          content_type: "video/mp4",
          size_bytes: 2048,
          created_at: "2026-10-01T12:06:00Z",
        },
      ],
    };
    vi.spyOn(researchApi, "fetchResearchCaseDetail").mockResolvedValue(caseWithMedia);
    vi.spyOn(researchApi, "fetchResearchCaseMedia").mockResolvedValue(new Blob(["real-media"]));
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:real-citizen-media"),
      revokeObjectURL: vi.fn(),
    });

    render(
      <SignalCaseInvestigationView
        caseId={caseWithMedia.case_id}
        onBackToInbox={vi.fn()}
      />
    );

    expect(await screen.findByRole("img", { name: "Citizen-submitted image: water_stream.jpg" })).toHaveAttribute("src", "blob:real-citizen-media");
    expect(screen.getByLabelText("Citizen-submitted video: outfall.mp4")).toHaveAttribute("src", "blob:real-citizen-media");
    expect(screen.getAllByText("Source: Citizen observation").length).toBeGreaterThanOrEqual(1);
  });

  it("shows an explicit retryable error for broken media", async () => {
    vi.spyOn(researchApi, "fetchResearchCaseDetail").mockResolvedValue({
      ...mockCaseDetailResponse,
      media: [{
        media_id: "broken-media-id",
        original_filename: "missing.jpg",
        content_type: "image/jpeg",
        size_bytes: 120,
        created_at: "2026-10-01T12:05:00Z",
      }],
    });
    vi.spyOn(researchApi, "fetchResearchCaseMedia").mockRejectedValue(new ApiError(404, "This media file is no longer available."));

    render(
      <SignalCaseInvestigationView
        caseId={mockCaseDetailResponse.case_id}
        onBackToInbox={vi.fn()}
      />
    );

    expect(await screen.findByText("This media file is no longer available.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });
});

describe("HumanReviewPanel Component (Issue 13)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("validates rationale length, enables submission at >= 15 chars, and handles submission", async () => {
    const submitSpy = vi.spyOn(researchApi, "submitHumanReview").mockResolvedValue(mockRecordedReview);
    const onRecorded = vi.fn();
    const onCancel = vi.fn();

    render(
      <HumanReviewPanel
        caseDetail={mockCaseDetailResponse}
        onReviewRecorded={onRecorded}
        onCancel={onCancel}
      />
    );

    // Initial state: submit button should be disabled
    const recordBtn = screen.getByRole("button", { name: /Record Decision/i });
    expect(recordBtn).toBeDisabled();

    // Select outcome
    fireEvent.click(screen.getByText("Request field verification"));
    expect(recordBtn).toBeDisabled(); // still disabled, no rationale

    // Type short rationale (< 15 chars)
    const textarea = screen.getByPlaceholderText(/Document the empirical reasoning/i);
    fireEvent.change(textarea, { target: { value: "Too short note" } });
    expect(recordBtn).toBeDisabled();
    expect(screen.getByText(/Rationale must contain at least 15 non-whitespace characters/i)).toBeInTheDocument();

    // Type valid rationale (>= 15 chars)
    fireEvent.change(textarea, {
      target: { value: "Sufficient empirical reasoning based on photographic evidence cross-check." },
    });
    expect(recordBtn).not.toBeDisabled();

    // Submit
    fireEvent.click(recordBtn);

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111", {
        outcome: "REQUEST_FIELD_VERIFICATION",
        rationale: "Sufficient empirical reasoning based on photographic evidence cross-check.",
        linked_case_id: null,
      });
      expect(onRecorded).toHaveBeenCalledWith(mockRecordedReview);
      expect(screen.getByText("REVIEW RECORDED")).toBeInTheDocument();
      expect(screen.getByText(/This decision does not establish environmental cause/i)).toBeInTheDocument();
    });
  });

  it("requires linked_case_id for MARK_RELATED_CASE and rejects self-linking", async () => {
    render(
      <HumanReviewPanel
        caseDetail={mockCaseDetailResponse}
        onReviewRecorded={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Select Mark related case
    fireEvent.click(screen.getByText("Mark related case"));

    // Linked case input should appear
    expect(screen.getByLabelText(/Linked SignalCase UUID/i)).toBeInTheDocument();

    const recordBtn = screen.getByRole("button", { name: /Record Decision/i });
    expect(recordBtn).toBeDisabled();

    // Provide rationale
    const textarea = screen.getByPlaceholderText(/Document the empirical reasoning/i);
    fireEvent.change(textarea, {
      target: { value: "Legitimate cross-case cluster correlation and spatial match." },
    });

    // Provide self UUID (should prevent submit or show error)
    const linkedInput = screen.getByLabelText(/Linked SignalCase UUID/i);
    fireEvent.change(linkedInput, {
      target: { value: mockCaseDetailResponse.case_id },
    });

    expect(recordBtn).toBeDisabled();

    // Provide distinct valid UUID
    fireEvent.change(linkedInput, {
      target: { value: "22222222-2222-2222-2222-222222222222" },
    });
    expect(recordBtn).not.toBeDisabled();
  });
});

describe("Research Workspace Route", () => {
  it("opens the researcher workspace at its direct development route without a demo role switch", async () => {
    vi.spyOn(researchApi, "fetchResearchInbox").mockResolvedValue(mockInboxResponse);

    render(<App />);

    expect(screen.getByText("Sign in to StreamSignal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Researcher$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Sign In as Researcher/i }));

    await waitFor(() => {
      expect(screen.getByText("Research Evidence Workspace")).toBeInTheDocument();
    });
  });
});
