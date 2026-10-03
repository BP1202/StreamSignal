/**
 * StreamSignal — Issue 14: Realtime Live Evidence Bridge Frontend Tests
 * Tests:
 * - Live Connection Indicator (● Live, ○ Reconnecting..., ○ Offline)
 * - Real-time SIGNAL_CASE_CREATED event receipt and banner display
 * - Open Case navigation from live alert
 * - Case deduplication by case_id
 * - Citizen Aqua App live CITIZEN_IMPACT_UPDATED receipt and banner update
 * - Empty database state displays no fake cases
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { EvidenceInboxView } from "./components/research/EvidenceInboxView";
import { EvidenceCaseView } from "./components/evidence/EvidenceCaseView";
import * as researchApi from "./api/research";
import { MockWebSocket } from "./test-setup";
import { ResearchInboxResponse } from "./types/research";
import { EvidenceCaseResponse } from "./types/evidence_case";

const mockEmptyInbox: ResearchInboxResponse = {
  items: [],
  total: 0,
  limit: 50,
  offset: 0,
};

const mockInboxWithCase: ResearchInboxResponse = {
  items: [
    {
      case_id: "11111111-2222-3333-4444-555555555555",
      observed_at: "2026-06-15T10:30:00Z",
      location: { latitude: 40.7128, longitude: -74.006 },
      description: "After-Rain Stream Check: Green surface scum.",
      quality_rating: "COMPLETE",
      completeness_score: 0.85,
      media_count: 1,
      pattern_echo_count: 2,
      triage_action: "EXPERT_REVIEW",
      triage_reasons: ["Triggered by triage rules: RECURRING_CLUSTER"],
      why_surfaced: [
        {
          category: "TRIAGE_ACTION",
          summary: "High-priority expert review recommended",
        },
      ],
      human_decision_status: "AWAITING_REVIEW",
      workflow_status: "AWAITING_REVIEW",
      evidence_state: "E4_CORROBORATED",
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const mockCitizenCase: EvidenceCaseResponse = {
  case_id: "11111111-2222-3333-4444-555555555555",
  report_id: "11111111-2222-3333-4444-555555555555",
  status: "pending_review",
  created_at: "2026-06-15T10:30:00Z",
  citizen_evidence: {
    description: "After-Rain Stream Check: Green surface scum.",
    water_appearance: "green_surface_material",
    flow_condition: "slow",
    odor: "none",
    observation_time: "2026-06-15T10:30:00Z",
    location: { latitude: 40.7128, longitude: -74.006 },
    foam_observed: false,
    litter_observed: false,
    dead_wildlife_observed: false,
    media: [],
  },
  evidence_quality: {
    report_id: "11111111-2222-3333-4444-555555555555",
    quality: "COMPLETE",
    score: 0.85,
    present: ["description", "location", "time"],
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
    status: "pending",
    notes: null,
  },
  provenance: {
    source: "CITIZEN",
    generated_at: "2026-06-15T10:30:00Z",
    components: ["CitizenObservation", "QualityAssessment"],
  },
};

describe("Issue 14 — Live Evidence Bridge (Frontend)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
  });

  it("renders Live connection indicator when WebSocket connects", async () => {
    vi.spyOn(researchApi, "fetchResearchInbox").mockResolvedValue(mockEmptyInbox);

    render(<EvidenceInboxView onSelectCase={() => {}} />);

    // Initially connecting or connected
    const indicator = await screen.findByTestId("live-indicator");
    expect(indicator).toBeInTheDocument();

    // After mock socket opens, indicator should read "● Live"
    await waitFor(() => {
      expect(screen.getByText("● Live")).toBeInTheDocument();
    });
  });

  it("displays empty database state cleanly without fake fallback cases", async () => {
    vi.spyOn(researchApi, "fetchResearchInbox").mockResolvedValue(mockEmptyInbox);

    render(<EvidenceInboxView onSelectCase={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("No SignalCases Found")).toBeInTheDocument();
    });

    expect(screen.queryByText("SS-1048")).not.toBeInTheDocument();
    expect(screen.queryByText("R-042")).not.toBeInTheDocument();
  });

  it("receives live SIGNAL_CASE_CREATED event, renders banner, and triggers background refresh", async () => {
    const fetchSpy = vi
      .spyOn(researchApi, "fetchResearchInbox")
      .mockResolvedValueOnce(mockEmptyInbox)
      .mockResolvedValueOnce(mockInboxWithCase);

    const onSelectCase = vi.fn();
    render(<EvidenceInboxView onSelectCase={onSelectCase} />);

    // Wait for initial load
    await screen.findByText("No SignalCases Found");
    expect(MockWebSocket.instances.length).toBeGreaterThan(0);

    const socket = MockWebSocket.instances[0];

    // Simulate receiving real backend WebSocket event
    act(() => {
      socket.simulateServerMessage({
        event_type: "SIGNAL_CASE_CREATED",
        case_id: "11111111-2222-3333-4444-555555555555",
        report_id: "11111111-2222-3333-4444-555555555555",
        occurred_at: "2026-06-15T10:35:00Z",
        payload: {
          title: "Observation #11111111",
          completeness_score: 0.85,
          media_count: 1,
        },
      });
    });

    // Alert banner should appear
    const alert = await screen.findByTestId("new-evidence-alert");
    expect(alert).toBeInTheDocument();
    expect(within(alert).getByText("NEW EVIDENCE")).toBeInTheDocument();
    expect(within(alert).getByText("SS-11111111")).toBeInTheDocument();
    expect(within(alert).getByText(/Observation #11111111/)).toBeInTheDocument();

    // Clicking "Open Case" navigates to the case
    const openBtn = screen.getByRole("button", { name: /Open Case/i });
    fireEvent.click(openBtn);
    expect(onSelectCase).toHaveBeenCalledWith("11111111-2222-3333-4444-555555555555");

    // Background fetch was called again
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("deduplicates inbox cases when duplicate events or identical IDs arrive", async () => {
    // API returning two identical case_ids
    vi.spyOn(researchApi, "fetchResearchInbox").mockResolvedValue({
      items: [
        mockInboxWithCase.items[0],
        { ...mockInboxWithCase.items[0] }, // duplicate item
      ],
      total: 2,
      limit: 50,
      offset: 0,
    });

    render(<EvidenceInboxView onSelectCase={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Sorted deterministically/)).toBeInTheDocument();
    });

    // Exactly 1 case card should be rendered despite 2 in response
    const countElement = screen.getByText((_, el) => el?.textContent?.trim() === "Showing 1 case");
    expect(countElement).toBeInTheDocument();
  });

  it("Citizen Aqua App receives CITIZEN_IMPACT_UPDATED and updates live without refresh", async () => {
    render(
      <EvidenceCaseView
        evidenceCase={mockCitizenCase}
        onNewObservation={() => {}}
      />
    );

    // Initial state: awaiting review
    expect(screen.getAllByText("Awaiting human review").length).toBeGreaterThan(0);

    expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    const citizenSocket = MockWebSocket.instances[0];

    // Simulate backend sending non-sensitive live update
    act(() => {
      citizenSocket.simulateServerMessage({
        event_type: "CITIZEN_IMPACT_UPDATED",
        case_id: "11111111-2222-3333-4444-555555555555",
        report_id: "11111111-2222-3333-4444-555555555555",
        occurred_at: "2026-06-15T11:00:00Z",
        payload: {
          workflow_status: "FIELD_VERIFICATION_REQUESTED",
          citizen_label: "Field Verification Requested",
          safe_description:
            "Your observation helped identify a location for possible professional field verification.",
        },
      });
    });

    // Badge updates to "Field Verification Requested"
    const liveBadge = await screen.findByTestId("citizen-live-status-badge");
    expect(liveBadge).toHaveTextContent("Field Verification Requested");

    // Impact card appears with safe description
    const impactCard = await screen.findByTestId("citizen-live-impact-card");
    expect(impactCard).toBeInTheDocument();
    expect(
      within(impactCard).getByText(
        /Your observation helped identify a location for possible professional field verification/
      )
    ).toBeInTheDocument();

    // Check One Health notice is present
    expect(
      within(impactCard).getByText(
        /This does not establish pollution, toxicity, health risk, or environmental cause/
      )
    ).toBeInTheDocument();
  });
});
