import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InteroperabilitySection } from "./components/research/InteroperabilitySection";
import * as researchApi from "./api/research";
import {
  EvidencePassportResponse,
  FHIRBundle,
} from "./types/interoperability";

const mockPassport: EvidencePassportResponse = {
  metadata: {
    passport_id: "55555555-5555-5555-5555-555555555555",
    schema_version: "1.0.0",
    generated_at: "2026-10-03T12:00:00Z",
    system_source: "StreamSignal Interoperability Gateway",
    governance_standard: "StreamSignal One Health Evidence Model",
  },
  identity: {
    case_id: "11111111-1111-1111-1111-111111111111",
    report_id: "11111111-1111-1111-1111-111111111111",
    created_at: "2026-10-01T10:00:00Z",
    current_evidence_state: "E4_CORROBORATED",
    current_workflow_status: "AWAITING_REVIEW",
  },
  citizen_evidence: {
    evidence_origin: "CITIZEN_REPORTED",
    observed_at: "2026-10-01T09:30:00Z",
    location: {
      latitude: 23.0225,
      longitude: 72.5714,
    },
    description: "Thick green layer floating near concrete culvert discharge.",
    water_appearance: "green_surface_material",
    flow_condition: "stagnant",
    odor: "earthy",
    foam_observed: true,
    litter_observed: false,
    dead_wildlife_observed: false,
  },
  evidence_quality: {
    quality_tier: "COMPLETE",
    completeness_score: 0.85,
    present_dimensions: ["location", "description", "water_appearance", "odor", "flow_condition"],
    missing_dimensions: ["dead_wildlife"],
    recommendations: ["Ensure safe distance from stagnant bank."],
    interpretation_boundary: "Completeness reflects documented physical dimension density, not scientific truth.",
  },
  media_evidence: {
    total_media: 1,
    items: [
      {
        media_id: "22222222-2222-2222-2222-222222222222",
        original_filename: "algae_culvert.jpg",
        content_type: "image/jpeg",
        size_bytes: 14200,
        sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        safe_reference: "/api/v1/reports/11111111-1111-1111-1111-111111111111/media/22222222-2222-2222-2222-222222222222",
      },
    ],
  },
  machine_assistance: {
    status: "AVAILABLE",
    evidence_class: "E3_INFERRED",
    items: [
      {
        observation_id: "obs-machine-1",
        media_id: "22222222-2222-2222-2222-222222222222",
        observation_type: "GREEN_VISUAL_REGION",
        evidence_class: "E3_INFERRED",
        description: "Green discoloration cue detected on water surface.",
        uncertainty: "Visible cue only; illumination variations may alter hue.",
        sha256_integrity: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      },
    ],
    scientific_limitation: "Machine vision observations indicate visible cues only and do not establish biological identity.",
  },
  contextual_evidence: {
    status: "MATCHES_FOUND",
    matches_count: 1,
    search_radius_meters: 1000,
    historical_window_days: 90,
    summary: "1 historical observation(s) with matching physical appearance.",
    matches: [
      {
        report_id: "33333333-3333-3333-3333-333333333333",
        observed_at: "2026-09-15T08:00:00Z",
        distance_meters: 150.5,
        days_difference: 16,
        matched_signals: ["green_surface_material"],
        similarity_explanation: ["Similar green coloration recorded at upstream culvert."],
      },
    ],
    interpretation_boundary: "Historical recurrence indicates pattern similarity, not environmental causation.",
  },
  signal_guard: {
    contract_version: "1.0",
    rules_applied: ["SIGNALGUARD_STRICT_EVIDENCE_CLASS", "INTERPRETATION_FIREWALL"],
    guarantees: ["Original citizen evidence preserved unchanged"],
    supported_claims: ["Citizen reported thick green layer near culvert."],
    prohibited_interpretations: [
      "POLLUTION_CONFIRMED",
      "TOXICITY_CONFIRMED",
      "HEALTH_RISK_CONFIRMED",
      "CAUSE_CONFIRMED",
    ],
  },
  human_decision: {
    review_status: "AWAITING_REVIEW",
    outcome: null,
    workflow_status: "AWAITING_REVIEW",
    evidence_state_before: null,
    evidence_state_after: null,
    reviewer_id: null,
    rationale: null,
    linked_case_id: null,
    reviewed_at: null,
    boundary_notice: "Human review requests further verification and does not automatically confirm clinical causation.",
  },
  lineage: {
    total_events: 1,
    events: [
      {
        event_id: "44444444-4444-4444-4444-444444444444",
        event_type: "HUMAN_REVIEW_RECORDED",
        actor_type: "RESEARCHER",
        actor_id: "R-042",
        summary: "Researcher initiated investigation triage.",
        created_at: "2026-10-02T14:30:00Z",
      },
    ],
  },
};

const mockBundle: FHIRBundle = {
  resourceType: "Bundle",
  id: "bundle-11111111-1111-1111-1111-111111111111",
  type: "collection",
  timestamp: "2026-10-03T12:00:00Z",
  total: 6,
  entry: [
    {
      fullUrl: "urn:uuid:loc-1",
      resource: {
        resourceType: "Location",
        id: "loc-11111111-1111-1111-1111-111111111111",
        position: { latitude: 23.0225, longitude: 72.5714 },
      },
    },
    {
      fullUrl: "urn:uuid:qr-1",
      resource: {
        resourceType: "QuestionnaireResponse",
        id: "qr-11111111-1111-1111-1111-111111111111",
      },
    },
    {
      fullUrl: "urn:uuid:obs-1",
      resource: {
        resourceType: "Observation",
        id: "obs-citizen-11111111-1111-1111-1111-111111111111",
      },
    },
    {
      fullUrl: "urn:uuid:med-1",
      resource: {
        resourceType: "Media",
        id: "med-22222222-2222-2222-2222-222222222222",
      },
    },
    {
      fullUrl: "urn:uuid:task-1",
      resource: {
        resourceType: "Task",
        id: "task-1",
        status: "requested",
      },
    },
    {
      fullUrl: "urn:uuid:prov-1",
      resource: {
        resourceType: "Provenance",
        id: "prov-1",
      },
    },
  ],
};

describe("One Health InteroperabilitySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(researchApi, "fetchEvidencePassport").mockResolvedValue(mockPassport);
    vi.spyOn(researchApi, "fetchFHIRBundle").mockResolvedValue(mockBundle);
  });

  it("renders InteroperabilitySection with dynamic resource counts", async () => {
    render(
      <InteroperabilitySection caseId="11111111-1111-1111-1111-111111111111" />
    );

    // Initial loading state
    expect(screen.queryByText(/One Health Evidence Interoperability/i)).not.toBeInTheDocument();

    // Resolves and displays title
    await waitFor(() => {
      expect(screen.getByText(/One Health Evidence Interoperability/i)).toBeInTheDocument();
      expect(screen.getByText(/Evidence Passport & FHIR R4 Gateway/i)).toBeInTheDocument();
    });

    // Check dynamic resource count badges
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Survey QR")).toBeInTheDocument();
    expect(screen.getByText("Media Attachments")).toBeInTheDocument();
    expect(screen.getByText("Workflow Tasks")).toBeInTheDocument();
    expect(screen.queryByText("Provenance Events")).not.toBeInTheDocument();
  });

  it("opens Evidence Passport modal with structured sections", async () => {
    render(
      <InteroperabilitySection caseId="11111111-1111-1111-1111-111111111111" />
    );

    await waitFor(() => {
      expect(screen.getByText(/View Passport/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/View Passport/i));

    // Modal appears
    expect(screen.getByText(/SignalCase Evidence Passport/i)).toBeInTheDocument();
    expect(screen.getByText(/StreamSignal One Health Evidence Model/i)).toBeInTheDocument();
    expect(screen.getByText(/Thick green layer floating near concrete culvert discharge./i)).toBeInTheDocument();
    expect(screen.getByText(/POLLUTION_CONFIRMED/i)).toBeInTheDocument();
    expect(screen.getByText(/TOXICITY_CONFIRMED/i)).toBeInTheDocument();
  });

  it("opens FHIR R4 Bundle modal and allows viewing bundle JSON", async () => {
    render(
      <InteroperabilitySection caseId="11111111-1111-1111-1111-111111111111" />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /FHIR R4 Bundle/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /FHIR R4 Bundle/i }));

    // Modal appears with JSON
    expect(screen.getByText(/FHIR R4-Compatible Collection Bundle/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy FHIR JSON/i)).toBeInTheDocument();
    expect(screen.getByText(/Reference Integrity: Verified/i)).toBeInTheDocument();
  });

  it("handles fetch error state safely", async () => {
    vi.spyOn(researchApi, "fetchEvidencePassport").mockRejectedValue(
      new Error("Gateway connection timeout")
    );

    render(
      <InteroperabilitySection caseId="11111111-1111-1111-1111-111111111111" />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Interoperability Gateway Unavailable/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Gateway connection timeout/i)
      ).toBeInTheDocument();
    });
  });

  it("renders a consistent interoperability journey without the broken lineage panel", async () => {
    render(
      <InteroperabilitySection caseId="11111111-1111-1111-1111-111111111111" />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/This case is represented as a deterministic FHIR R4 bundle/i)
      ).toBeInTheDocument();
    });

    // The available journey is kept focused on working views; audit data remains in the FHIR Bundle.
    expect(screen.getByText("SignalCase")).toBeInTheDocument();
    expect(screen.getByText("Evidence Passport Envelope")).toBeInTheDocument();
    expect(screen.getByText("FHIR R4 Serialization")).toBeInTheDocument();
    expect(screen.getByText("One Health Systems")).toBeInTheDocument();
    expect(screen.queryByText("Evidence Lineage Audit")).not.toBeInTheDocument();
    expect(screen.queryByText("Provenance Trail")).not.toBeInTheDocument();
  });
});
