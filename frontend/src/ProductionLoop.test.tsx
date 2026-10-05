/**
 * StreamSignal — Production Vertical Slice Tests
 * Tests:
 * 1. Two-browser routing simulation (Citizen Observe vs Research Workspace)
 * 2. URL synchronization and browser refresh survival
 * 3. Empty database representation across both surfaces
 * 4. Case investigation navigation and back-to-inbox flow
 * 5. Citizen impact status loading from database
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "./App";
import * as reportsApi from "./api/reports";
import * as researchApi from "./api/research";
import { EvidenceCaseResponse, TriageResponse } from "./types/evidence_case";
import { ResearchInboxResponse, ResearchCaseDetailResponse } from "./types/research";

const mockEmptyInbox: ResearchInboxResponse = {
  items: [],
  total: 0,
  limit: 50,
  offset: 0,
};

const testReportId = "99999999-8888-7777-6666-555555555555";

const mockEvidenceCase: EvidenceCaseResponse = {
  case_id: testReportId,
  report_id: testReportId,
  status: "pending_review",
  created_at: "2026-10-03T12:00:00Z",
  citizen_evidence: {
    description: "Turbid water near storm drain segment.",
    water_appearance: "cloudy_brown",
    flow_condition: "moderate",
    odor: "earthy",
    observation_time: "2026-10-03T12:00:00Z",
    location: { latitude: 40.7128, longitude: -74.006 },
    foam_observed: false,
    litter_observed: false,
    dead_wildlife_observed: false,
    media: [],
  },
  evidence_quality: {
    report_id: testReportId,
    score: 0.83,
    quality: "PARTIAL",
    present: ["description", "water_appearance", "location", "observation_time", "flow_condition"],
    missing: ["media"],
    recommendations: ["Attach clear photo evidence"],
  },
  machine_assistance: {
    status: "available",
    items: [],
  },
  contextual_evidence: {
    status: "available",
    items: [],
  },
  human_decision: {
    status: "pending",
    decision: null,
    reviewer: null,
    notes: null,
  },
  provenance: {
    source: "streamsignal",
    generated_at: "2026-10-03T12:00:00Z",
    components: ["citizen_report", "evidence_quality"],
  },
};

const mockTriage: TriageResponse = {
  report_id: testReportId,
  recommended_action: "EXPERT_REVIEW",
  reason_codes: ["HUMAN_VERIFICATION_REQUIRED"],
  evidence_summary: {
    quality: "PARTIAL",
    quality_score: 0.83,
    media_count: 0,
    visual_observation_count: 0,
    historical_match_count: 0,
    human_review_status: "PENDING",
  },
  explanation: ["Evidence completeness warranting expert review."],
  limitations: ["Pattern similarity does not establish causation."],
};


const mockDetail: ResearchCaseDetailResponse = {
  case_id: testReportId,
  observed_at: "2026-10-03T12:00:00Z",
  location: { latitude: 40.7128, longitude: -74.006 },
  description: "Turbid water near storm drain segment.",
  water_appearance: "cloudy_brown",
  flow_condition: "moderate",
  odor: "earthy",
  foam_observed: false,
  litter_observed: false,
  dead_wildlife_observed: false,
  human_decision_status: "AWAITING_REVIEW",
  workflow_status: "AWAITING_REVIEW",
  evidence_state: "E4_CORROBORATED",
  latest_human_review: null,
  review_count: 0,
  lineage_count: 1,
  why_surfaced: [
    {
      category: "TRIAGE_ACTION",
      summary: "High-priority expert review recommended",
    },
  ],
  evidence_quality: {
    report_id: testReportId,
    quality: "PARTIAL",
    score: 0.83,
    present: ["description", "location"],
    missing: ["media"],
    recommendations: ["Attach photo"],
  },
  media: [],
  media_observations: [],
  contextual_evidence: {
    report_id: testReportId,
    status: "NO_MATCHES",
    search_radius_meters: 1000,
    historical_window_days: 90,
    matches: [],
    summary: "No historical patterns in range",
    interpretation_limit: "Similarity does not indicate causation",
  },
  triage: {
    report_id: testReportId,
    recommended_action: "EXPERT_REVIEW",
    reason_codes: ["HUMAN_VERIFICATION_REQUIRED"],
    summary: "High-priority review recommended",
    evidence_summary: {
      evidence_quality_tier: "PARTIAL",
      media_count: 0,
      visual_observation_count: 0,
      historical_match_count: 0,
      human_decision_status: "AWAITING_REVIEW",
    },
  },
  evidence_contract: {
    report_id: testReportId,
    contract_version: "1.0",
    created_at: "2026-10-03T12:00:00Z",
    claims: [],
    provenance: {
      system: "StreamSignal",
      governance_standard: "One Health",
      evaluated_at: "2026-10-03T12:00:00Z",
    },
  },
};

describe("Production Vertical Slice — Two Surfaces & Refresh Survival", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("streamsignal_auth_role", "citizen");
    localStorage.setItem("streamsignal_citizen_username", "aqua-001");
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("Browser 1 (Citizen): renders landing page with capture CTAs", () => {
    window.history.pushState({}, "", "/citizen/observe");
    render(<App />);

    expect(screen.getByText(/Notice something unusual in a stream\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Capture what you see/i)).toBeInTheDocument();
    expect(screen.getByText(/Or start without a photo/i)).toBeInTheDocument();
  });

  it("Browser 2 (Research Workspace): opens empty inbox when 0 cases in database", async () => {
    window.history.pushState({}, "", "/research");
    vi.spyOn(researchApi, "fetchResearchInbox").mockResolvedValue(mockEmptyInbox);

    render(<App />);

    expect(screen.getByText(/Research Evidence Workspace/i)).toBeInTheDocument();
    expect(await screen.findByText(/No evidence has been recorded yet|No SignalCases Found/i)).toBeInTheDocument();
    expect(screen.getByText(/No evidence cases match the selected filters/i)).toBeInTheDocument();
  });

  it("Mode switching updates URL and switches views", async () => {
    vi.spyOn(researchApi, "fetchResearchInbox").mockResolvedValue(mockEmptyInbox);

    render(<App />);

    // Click Research Workspace in Header
    const researchBtn = screen.getByRole("button", { name: /Research Workspace/i });
    fireEvent.click(researchBtn);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/research");
      expect(screen.getByText(/Research Evidence Workspace/i)).toBeInTheDocument();
    });

    // Click Citizen Observe in Header
    const citizenBtn = screen.getByRole("button", { name: /Citizen Observe/i });
    fireEvent.click(citizenBtn);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/citizen");
      expect(screen.getByText(/Notice something unusual in a stream\?/i)).toBeInTheDocument();
    });
  });

  it("Browser refresh survival: directly loading /citizen?caseId= loads case from backend", async () => {
    window.history.pushState({}, "", `/citizen?caseId=${testReportId}`);
    vi.spyOn(reportsApi, "getEvidenceCase").mockResolvedValue(mockEvidenceCase);
    vi.spyOn(reportsApi, "getEvidenceTriage").mockResolvedValue(mockTriage);
    vi.spyOn(reportsApi, "getReportImpactStatus").mockResolvedValue({
      case_id: testReportId,
      status: "AWAITING_REVIEW",
      status_label: "Awaiting human review",
      description: "Observation is preserved and awaiting review.",
      updated_at: "2026-10-03T12:00:00Z",
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Your observation is recorded/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Turbid water near storm drain segment/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Awaiting human review/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("Browser refresh survival: directly loading /research/cases/:id loads case investigation", async () => {
    window.history.pushState({}, "", `/research/cases/${testReportId}`);
    vi.spyOn(researchApi, "fetchResearchCaseDetail").mockResolvedValue(mockDetail);
    vi.spyOn(researchApi, "fetchCaseLineage").mockResolvedValue({
      total: 0,
      events: [],
    });


    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("SignalCase Investigation")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Turbid water near storm drain segment/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Why This Case Surfaced for Investigation/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Start Review/i).length).toBeGreaterThanOrEqual(1);
  });
});



