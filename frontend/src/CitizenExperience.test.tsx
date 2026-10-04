import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import { WaterSignalHome } from "./components/citizen/WaterSignalHome";
import { CitizenImpactView } from "./components/citizen/CitizenImpactView";
import * as impactApi from "./api/impact";
import * as researchApi from "./api/research";
import * as missionsApi from "./api/missions";
import { ContributorImpactResponse, EvidenceCoverageInfo } from "./types/impact";

const mockCoverage: EvidenceCoverageInfo = {
  total_cases_analyzed: 14,
  overall_coverage_ratio: 0.62,
  overall_coverage_percentage: 62.0,
  total_potential_dimensions: 84,
  total_dimensions_present: 52,
  potential_coverage_per_dimension: 0.89,
  epistemic_notice: "Evidence coverage reflects availability of observations only — not a drinking-water safety assessment.",
  gaps: [
    {
      dimension: "flow_condition",
      dimension_label: "Flow Condition",
      total_cases_analyzed: 14,
      cases_with_evidence: 8,
      cases_missing_evidence: 6,
      availability_ratio: 0.57,
    },
    {
      dimension: "photo",
      dimension_label: "Photo / Media",
      total_cases_analyzed: 14,
      cases_with_evidence: 10,
      cases_missing_evidence: 4,
      availability_ratio: 0.71,
    },
  ],
};

const mockImpact: ContributorImpactResponse = {
  contributor_id: "SS-C-9999",
  display_name: "BrookDragonfly-2378",
  account_level: "LEVEL_1_CONTRIBUTOR",
  total_contributions: 3,
  verified_contributions: 1,
  overall_evidence_coverage: 62.89,
  total_coverage_delta_contributed: 2.67,
  stewardship_milestones: ["First Signal", "Flow Observer"],
  epistemic_notice: "Evidence coverage reflects the availability of relevant observations. It is not a measure of drinking-water safety.",
  recent_contributions: [
    {
      submission_id: "11111111-2222-3333-4444-555555555555",
      signal_case_id: "22222222-3333-4444-5555-666666666666",
      mission_title: "After-Rain Stream Flow Check",
      dimensions_provided: ["flow_condition", "photo"],
      submitted_at: "2026-10-03T14:30:00Z",
      review_status: "ACCEPTED_FOR_RESEARCH",
      coverage_delta_pct: 1.78,
    },
    {
      submission_id: "33333333-4444-5555-6666-777777777777",
      signal_case_id: "44444444-5555-6666-7777-888888888888",
      mission_title: "Surface Foam Verification",
      dimensions_provided: ["foam_observed"],
      submitted_at: "2026-10-03T16:00:00Z",
      review_status: "AWAITING_REVIEW",
      coverage_delta_pct: 0.89,
    },
  ],
};

describe("Citizen Experience & Product Coherence Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/");
  });

  it("renders WaterSignalHome with evidence coverage and non-claim disclaimer", async () => {
    vi.spyOn(impactApi, "fetchEvidenceCoverage").mockResolvedValue(mockCoverage);
    vi.spyOn(missionsApi, "fetchMissionRecommendations").mockResolvedValue({
      recommendations: [
        {
          id: "mission-fc-1",
          mission_type: "EVIDENCE_CLARIFICATION",
          status: "WAITING_FOR_CITIZEN",
          title: "Document Flow Condition",
          purpose: "Targeted verification of flow condition in urban stream.",
          research_need: "Hydrological baseline missing flow evidence.",
          research_need_source: "RESEARCHER_REQUIREMENT",
          required_evidence: ["flow_condition"],
          collected_evidence: {},
          missing_evidence: ["flow_condition"],
          created_at: new Date().toISOString(),
          is_recommended: true,
          why_this_mission: [
            "FLOW_CONDITION is missing",
            "This research need is approved",
            "Your selected area matches",
            "You have not recently submitted this evidence",
          ],
        },
      ],
      total: 1,
    });

    const onPhoto = vi.fn();
    const onNoPhoto = vi.fn();
    const onMissions = vi.fn();
    const onImpact = vi.fn();

    render(
      <WaterSignalHome
        onStartWithPhoto={onPhoto}
        onStartWithoutPhoto={onNoPhoto}
        onGoToMissions={onMissions}
        onGoToImpact={onImpact}
      />
    );

    expect(screen.getByText(/How much do we actually know about our urban water\?/i)).toBeInTheDocument();
    expect(await screen.findByText(/62.00%/i)).toBeInTheDocument();
    expect(screen.getByText(/Catchment Evidence Coverage/i)).toBeInTheDocument();
    expect(screen.getByText(/not a drinking-water safety or chemical toxicity assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/What would improve this evidence\?/i)).toBeInTheDocument();
    expect(await screen.findByText(/Document Flow Condition/i)).toBeInTheDocument();
    expect(screen.getByText(/FLOW_CONDITION is missing/i)).toBeInTheDocument();
    expect(screen.getByText(/This research need is approved/i)).toBeInTheDocument();

    // Click mission CTA
    const missionBtn = screen.getByRole("button", { name: /Participate in Mission/i });
    fireEvent.click(missionBtn);
    expect(onMissions).toHaveBeenCalled();
  });

  it("renders WaterSignalHome with empty state and Make an Observation CTA when no recommendations exist", async () => {
    vi.spyOn(impactApi, "fetchEvidenceCoverage").mockResolvedValue(mockCoverage);
    vi.spyOn(missionsApi, "fetchMissionRecommendations").mockResolvedValue({
      recommendations: [],
      total: 0,
    });

    const onPhoto = vi.fn();
    const onNoPhoto = vi.fn();
    const onMissions = vi.fn();
    const onImpact = vi.fn();

    render(
      <WaterSignalHome
        onStartWithPhoto={onPhoto}
        onStartWithoutPhoto={onNoPhoto}
        onGoToMissions={onMissions}
        onGoToImpact={onImpact}
      />
    );

    expect(await screen.findByText(/No targeted missions are currently available/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Make an Observation/i })).toBeInTheDocument();
  });

  it("renders CitizenImpactView with coverage delta and contribution provenance", async () => {
    vi.spyOn(impactApi, "fetchContributorImpact").mockResolvedValue(mockImpact);

    const onMissions = vi.fn();
    const onObserve = vi.fn();
    const onSelectCase = vi.fn();

    render(
      <CitizenImpactView
        onGoToMissions={onMissions}
        onGoToObserve={onObserve}
        onSelectCase={onSelectCase}
      />
    );

    expect(await screen.findByText("BrookDragonfly-2378")).toBeInTheDocument();
    expect(screen.getByText("SS-C-9999")).toBeInTheDocument();
    expect(screen.getByText("+2.67%")).toBeInTheDocument();
    expect(screen.getByText("After-Rain Stream Flow Check")).toBeInTheDocument();
    expect(screen.getByText("Accepted for Research")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Research Review")).toBeInTheDocument();
    expect(screen.getByText("First Signal")).toBeInTheDocument();
    expect(screen.getByText("Flow Observer")).toBeInTheDocument();

    // Click case link
    const caseBtn = screen.getByText("22222222-3333-4444-5555-666666666666");
    fireEvent.click(caseBtn);
    expect(onSelectCase).toHaveBeenCalledWith("22222222-3333-4444-5555-666666666666");
  });

  it("navigates across Citizen sub-tabs seamlessly", async () => {
    vi.spyOn(impactApi, "fetchEvidenceCoverage").mockResolvedValue(mockCoverage);
    vi.spyOn(impactApi, "fetchContributorImpact").mockResolvedValue(mockImpact);
    vi.spyOn(researchApi, "fetchResearchInbox").mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });

    render(<App />);

    // Initially on WaterSignal (Home)
    expect(screen.getByText(/How much do we actually know about our urban water\?/i)).toBeInTheDocument();

    // Click "My Impact" in Header
    const impactBtn = screen.getByRole("button", { name: /My Impact/i });
    fireEvent.click(impactBtn);

    expect(await screen.findByText("BrookDragonfly-2378")).toBeInTheDocument();

    // Click "Observe" in Header
    const observeBtn = screen.getByRole("button", { name: /^Observe$/i });
    fireEvent.click(observeBtn);

    expect(await screen.findByText(/Capture what you see/i)).toBeInTheDocument();

    // Switch to Research Workspace
    const researchBtn = screen.getByRole("button", { name: /Research Workspace/i });
    fireEvent.click(researchBtn);

    expect(await screen.findByText(/Research Evidence Workspace/i)).toBeInTheDocument();

    // Switch back to Citizen Surface
    const citizenSwitchBtn = screen.getByRole("button", { name: /Citizen Observe/i });
    fireEvent.click(citizenSwitchBtn);

    expect(await screen.findByText(/How much do we actually know about our urban water\?/i)).toBeInTheDocument();
  });
});
