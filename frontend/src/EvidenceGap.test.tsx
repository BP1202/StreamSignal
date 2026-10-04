import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { EvidenceGapIntelligencePanel } from "./components/research/EvidenceGapIntelligencePanel";
import { MissionNeedsTracker } from "./components/research/MissionNeedsTracker";
import * as gapApi from "./api/evidence_gap";
import {
  EvidenceGapListResponse,
  EvidenceGapDetail,
  MissionNeedListResponse,
  MissionNeed,
} from "./types/evidence_gap";

describe("Issue 17 — Evidence Gap Intelligence & Mission Needs Components", () => {
  const mockGapResponse: EvidenceGapListResponse = {
    total_cases_analyzed: 10,
    gaps: [
      {
        dimension: "flow_condition",
        dimension_label: "Flow Condition",
        total_cases_analyzed: 10,
        cases_with_evidence: 4,
        cases_missing_evidence: 6,
        availability_ratio: 0.4,
        affected_segment_ids: [],
        first_observed_at: new Date().toISOString(),
        last_observed_at: new Date().toISOString(),
      },
      {
        dimension: "photo",
        dimension_label: "Photo / Media",
        total_cases_analyzed: 10,
        cases_with_evidence: 8,
        cases_missing_evidence: 2,
        availability_ratio: 0.8,
        affected_segment_ids: [],
        first_observed_at: new Date().toISOString(),
        last_observed_at: new Date().toISOString(),
      },
    ],
    analysis_timestamp: new Date().toISOString(),
    epistemic_notice:
      "Evidence availability statistics describe the completeness of collected data only.",
  };

  const mockDetail: EvidenceGapDetail = {
    dimension: "flow_condition",
    dimension_label: "Flow Condition",
    total_cases_analyzed: 10,
    cases_with_evidence: 4,
    cases_missing_evidence: 6,
    availability_ratio: 0.4,
    affected_case_ids: ["case-uuid-1", "case-uuid-2"],
    affected_segment_ids: [],
    first_observed_at: new Date().toISOString(),
    last_observed_at: new Date().toISOString(),
    epistemic_statement:
      "6 of 10 analyzed SignalCases do not include a Flow Condition value. This is an evidence availability statistic only.",
  };

  const mockNeedsResponse: MissionNeedListResponse = {
    total: 2,
    needs: [
      {
        id: "need-uuid-1",
        evidence_gap_dimension: "flow_condition",
        title: "Flow Condition Evidence Need",
        description: "Collect flow conditions along Segment A.",
        rationale:
          "Systematic absence of flow_condition prevents runoff turbidity differentiation.",
        status: "IDENTIFIED",
        created_by_researcher: "DR_LIN",
        source_case_ids: ["case-uuid-1"],
        target_stream_segments: [],
        required_evidence: ["flow_condition"],
        created_at: new Date().toISOString(),
        approved_at: null,
        fulfilled_at: null,
        updated_at: new Date().toISOString(),
      },
      {
        id: "need-uuid-2",
        evidence_gap_dimension: "photo",
        title: "Photo Snapshot Need",
        description: "Visual baseline photos needed.",
        rationale: "Longitudinal visual baseline required for seasonal stream monitoring.",
        status: "APPROVED",
        created_by_researcher: "DR_LIN",
        source_case_ids: [],
        target_stream_segments: [],
        required_evidence: ["photo"],
        created_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        fulfilled_at: null,
        updated_at: new Date().toISOString(),
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders EvidenceGapIntelligencePanel with factual metrics and epistemic notice", async () => {
    vi.spyOn(gapApi, "fetchEvidenceGaps").mockResolvedValue(mockGapResponse);

    render(<EvidenceGapIntelligencePanel />);

    await waitFor(() => {
      expect(screen.getByText("Evidence Gap Intelligence")).toBeInTheDocument();
    });

    // Check Epistemic Notice
    expect(screen.getByText(/Epistemic Notice:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Evidence gap statistics reflect citizen observation completeness only/i)
    ).toBeInTheDocument();

    // Check Factual Metrics
    expect(screen.getByText("Flow Condition")).toBeInTheDocument();
    expect(screen.getByText("40% present")).toBeInTheDocument();
    expect(screen.getByText(/6 missing/i)).toBeInTheDocument();

    expect(screen.getByText("Photo / Media")).toBeInTheDocument();
    expect(screen.getByText("80% present")).toBeInTheDocument();
  });

  it("inspects detail for an evidence dimension", async () => {
    vi.spyOn(gapApi, "fetchEvidenceGaps").mockResolvedValue(mockGapResponse);
    vi.spyOn(gapApi, "fetchDimensionGapDetail").mockResolvedValue(mockDetail);

    render(<EvidenceGapIntelligencePanel />);

    await waitFor(() => {
      expect(screen.getByText("Flow Condition")).toBeInTheDocument();
    });

    const inspectButtons = screen.getAllByText("Inspect Detail");
    fireEvent.click(inspectButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Dimension Detail: Flow Condition/i)).toBeInTheDocument();
      expect(
        screen.getByText(/This is an evidence availability statistic only/i)
      ).toBeInTheDocument();
    });
  });

  it("validates rationale when creating a Mission Need (rejects short & placeholder)", async () => {
    vi.spyOn(gapApi, "fetchEvidenceGaps").mockResolvedValue(mockGapResponse);
    vi.spyOn(gapApi, "createMissionNeed").mockResolvedValue(mockNeedsResponse.needs[0]);

    render(<EvidenceGapIntelligencePanel />);

    await waitFor(() => {
      expect(screen.getByText("Flow Condition")).toBeInTheDocument();
    });

    // Open Modal
    const needButtons = screen.getAllByText("+ Mission Need");
    fireEvent.click(needButtons[0]);

    expect(screen.getByText("Create Researcher Mission Need")).toBeInTheDocument();

    // Try submitting with short rationale
    const rationaleInput = screen.getByPlaceholderText(/Explain why filling this evidence gap/i);
    fireEvent.change(rationaleInput, { target: { value: "short" } });

    const submitBtn = screen.getByText("Create Need (IDENTIFIED)");
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/Rationale must be at least 20 characters/i)
    ).toBeInTheDocument();

    // Try submitting with placeholder
    fireEvent.change(rationaleInput, { target: { value: "todo" } });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/Substantive researcher rationale is required/i)
    ).toBeInTheDocument();

    // Valid substantive rationale
    fireEvent.change(rationaleInput, {
      target: {
        value: "Flow conditions are required to determine stream velocity and discharge dynamics.",
      },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(gapApi.createMissionNeed).toHaveBeenCalledWith(
        expect.objectContaining({
          evidence_gap_dimension: "flow_condition",
          rationale:
            "Flow conditions are required to determine stream velocity and discharge dynamics.",
        })
      );
    });
  });

  it("renders MissionNeedsTracker with lifecycle FSM and agent boundary banner", async () => {
    vi.spyOn(gapApi, "fetchMissionNeeds").mockResolvedValue(mockNeedsResponse);
    vi.spyOn(gapApi, "transitionMissionNeedStatus").mockResolvedValue({
      ...mockNeedsResponse.needs[0],
      status: "REVIEWED",
    });

    render(<MissionNeedsTracker />);

    await waitFor(() => {
      expect(screen.getByText("Researcher Mission Needs")).toBeInTheDocument();
    });

    // Check Agent boundary banner
    expect(screen.getByText(/Agent Boundary:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/The Evidence Mission Agent can only read/i)
    ).toBeInTheDocument();

    // Check Needs listed
    expect(screen.getByText("Flow Condition Evidence Need")).toBeInTheDocument();
    expect(screen.getByText("Photo Snapshot Need")).toBeInTheDocument();

    // Status badges
    expect(screen.getAllByText("IDENTIFIED").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("APPROVED").length).toBeGreaterThanOrEqual(1);

    // Approved item shows Plan Mission action button
    expect(screen.getByText(/Plan Mission/i)).toBeInTheDocument();

    // Advance IDENTIFIED -> REVIEWED
    const reviewBtn = screen.getByText("Mark Reviewed");
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(gapApi.transitionMissionNeedStatus).toHaveBeenCalledWith(
        "need-uuid-1",
        "REVIEWED"
      );
    });
  });
});
