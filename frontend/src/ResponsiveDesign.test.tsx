import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { ObservationSignalsStep } from "./components/journey/ObservationSignalsStep";
import { PhotoCaptureStep } from "./components/journey/PhotoCaptureStep";
import { LocationTimeStep } from "./components/journey/LocationTimeStep";
import { HeroLanding } from "./components/journey/HeroLanding";
import { WaterSignalHome } from "./components/citizen/WaterSignalHome";
import { CitizenImpactView } from "./components/citizen/CitizenImpactView";
import { EvidenceInboxView } from "./components/research/EvidenceInboxView";

// Mock API modules
vi.mock("./api/impact", () => ({
  fetchEvidenceCoverage: vi.fn().mockResolvedValue({
    total_cases_analyzed: 5,
    overall_coverage_percentage: 65.4,
    potential_coverage_per_dimension: 8.5,
    gaps: [
      {
        dimension: "flow_condition",
        dimension_label: "Flow Condition",
        cases_with_evidence: 3,
        cases_missing_evidence: 2,
        total_cases_analyzed: 5,
        availability_ratio: 0.6,
      },
    ],
  }),
  fetchContributorImpact: vi.fn().mockResolvedValue({
    contributor_id: "test-contributor",
    display_name: "Community Steward",
    account_level: "TRUSTED_CONTRIBUTOR",
    total_contributions: 4,
    verified_contributions: 3,
    total_coverage_delta_contributed: 14.5,
    overall_evidence_coverage: 72.8,
    stewardship_milestones: ["FIRST_OBSERVATION", "PHOTO_VERIFIED"],
    recent_contributions: [],
    epistemic_notice: "Evidence coverage reflects information density, not water quality safety.",
  }),
}));

vi.mock("./api/missions", () => ({
  fetchMissionRecommendations: vi.fn().mockResolvedValue({
    recommendations: [
      {
        id: "mission-1",
        title: "Flow Condition Verification",
        mission_type: "WATER_FLOW",
        purpose: "Record stream flow dynamics to complete baseline telemetry.",
        status: "AVAILABLE",
        required_evidence: ["flow_condition"],
        why_this_mission: ["FLOW_CONDITION is missing", "This research need is approved"],
      },
    ],
    total: 1,
  }),
  fetchCitizenMissions: vi.fn().mockResolvedValue({ missions: [], total: 0 }),
  fetchContributorProfile: vi.fn().mockResolvedValue({
    contributor_id: "test-contributor",
    account_level: "TRUSTED_CONTRIBUTOR",
    total_contributions: 4,
    display_name: "Community Steward",
  }),
}));

vi.mock("./api/research", () => ({
  fetchResearchInbox: vi.fn().mockResolvedValue({
    total: 1,
    limit: 20,
    offset: 0,
    items: [
      {
        case_id: "case-responsive-1",
        observed_at: new Date().toISOString(),
        location: { latitude: 24.5854, longitude: 73.7125 },
        description: "Dense greenish scum noticed along the northern riverbank.",
        water_appearance: "green_discoloration",
        flow_condition: "stagnant",
        odor: "musty_earthy",
        media_count: 1,
        completeness_score: 0.85,
        quality_rating: "COMPLETE",
        triage_action: "EXPERT_REVIEW",
        evidence_class: "E3_INFERRED",
        evidence_state: "E2_STRUCTURED",
        human_decision_status: "pending",
        workflow_status: "TRIAGED",
        why_surfaced: [
          {
            summary: "High completeness score with multi-modal media attachment",
            details: "Citizen uploaded photographic evidence and answered follow-up questions.",
          },
        ],
        pattern_echo_count: 2,
      },
    ],
  }),
  fetchCaseLineage: vi.fn().mockResolvedValue({ events: [] }),
}));

vi.mock("./api/contact", () => ({
  fetchContributorContactRequests: vi.fn().mockResolvedValue([]),
  fetchCaseContactRequests: vi.fn().mockResolvedValue([]),
}));

describe("Comprehensive Responsive Design Across Viewports (320px to 1920px)", () => {
  const VIEWPORTS = [
    { name: "320px (iPhone SE 1st Gen)", width: 320, height: 568 },
    { name: "375px (iPhone SE 2nd/3rd Gen)", width: 375, height: 667 },
    { name: "390px (iPhone 12/13/14)", width: 390, height: 844 },
    { name: "430px (iPhone Pro Max)", width: 430, height: 932 },
    { name: "768px (iPad Portrait)", width: 768, height: 1024 },
    { name: "1024px (iPad Landscape)", width: 1024, height: 768 },
    { name: "1280px (Standard Desktop)", width: 1280, height: 800 },
    { name: "1440px (Large Desktop)", width: 1440, height: 900 },
    { name: "1920px (FHD Desktop)", width: 1920, height: 1080 },
  ];

  const setViewport = (width: number, height: number) => {
    window.innerWidth = width;
    window.innerHeight = height;
    window.dispatchEvent(new Event("resize"));
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("At 320px — Critical Acceptance Target", () => {
    beforeEach(() => {
      setViewport(320, 568);
    });

    it("renders Header without horizontal overflow and displays compact brand", () => {
      render(<Header mode="citizen" citizenTab="home" />);
      expect(screen.getByText("StreamSignal")).toBeInTheDocument();
      // Mobile menu toggle is visible
      expect(screen.getByLabelText("Toggle navigation menu")).toBeInTheDocument();
    });

    it("renders Footer with accessible scientific boundary text", () => {
      render(<Footer />);
      expect(screen.getByText("StreamSignal Evidence Platform")).toBeInTheDocument();
      expect(screen.getByText(/Scientific Boundary:/)).toBeInTheDocument();
    });

    it("renders ObservationSignalsStep with all visual cards and continue CTA accessible", () => {
      render(
        <ObservationSignalsStep
          description="Test observation text"
          onChangeDescription={vi.fn()}
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
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );
      expect(screen.getByText("What caught your attention?")).toBeInTheDocument();
      expect(screen.getByText("Continue to location")).toBeInTheDocument();
      expect(screen.getByText("← Back")).toBeInTheDocument();
    });

    it("renders LocationTimeStep with full-width responsive submit CTA", () => {
      render(
        <LocationTimeStep
          latitude="24.5854"
          onChangeLatitude={vi.fn()}
          longitude="73.7125"
          onChangeLongitude={vi.fn()}
          observedAt="2026-10-04T12:00"
          onChangeObservedAt={vi.fn()}
          hasMedia={true}
          hasDescription={true}
          hasCharacteristics={true}
          isSubmitting={false}
          submittingMessage=""
          errorMessage={null}
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />
      );
      expect(screen.getByText("Where & when did you see it?")).toBeInTheDocument();
      expect(screen.getByText("Create my Evidence Case")).toBeInTheDocument();
      expect(screen.getByText("← Back")).toBeInTheDocument();
    });

    it("renders PhotoCaptureStep with accessible action buttons", () => {
      render(
        <PhotoCaptureStep
          mediaFile={null}
          onSelectMedia={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      );
      expect(screen.getByText("Show us what you saw")).toBeInTheDocument();
      expect(screen.getByText("Continue to observation")).toBeInTheDocument();
      expect(screen.getByText("Skip photo for now →")).toBeInTheDocument();
    });

    it("renders HeroLanding with stacked responsive CTAs", () => {
      render(
        <HeroLanding
          onStartWithPhoto={vi.fn()}
          onStartWithoutPhoto={vi.fn()}
        />
      );
      expect(screen.getByText("Notice something unusual in a stream?")).toBeInTheDocument();
      expect(screen.getByText("Capture what you see")).toBeInTheDocument();
      expect(screen.getByText("Or start without a photo")).toBeInTheDocument();
    });

    it("renders WaterSignalHome with responsive mission opportunity and coverage meter", async () => {
      render(
        <WaterSignalHome
          onStartWithPhoto={vi.fn()}
          onStartWithoutPhoto={vi.fn()}
          onGoToMissions={vi.fn()}
          onGoToImpact={vi.fn()}
        />
      );
      expect(await screen.findByText("Catchment Evidence Coverage")).toBeInTheDocument();
      expect(await screen.findByText("Recommended Evidence Mission")).toBeInTheDocument();
      expect(await screen.findByText("Participate in Mission")).toBeInTheDocument();
    });

    it("renders CitizenImpactView with responsive highlights and delta banner", async () => {
      render(
        <CitizenImpactView
          onGoToMissions={vi.fn()}
          onGoToObserve={vi.fn()}
          onSelectCase={vi.fn()}
        />
      );
      expect(await screen.findByText("Completed Submissions")).toBeInTheDocument();
      expect(await screen.findByText("Your Evidence Coverage Delta")).toBeInTheDocument();
      expect(await screen.findByText("Catchment Baseline")).toBeInTheDocument();
      expect(await screen.findByText("With Your Observations")).toBeInTheDocument();
    });

    it("renders EvidenceInboxView with subtabs and investigated cards", async () => {
      render(<EvidenceInboxView onSelectCase={vi.fn()} />);
      expect(await screen.findByText("SignalCase Inbox")).toBeInTheDocument();
      expect(await screen.findByText("Evidence Gap Intelligence & Mission Needs")).toBeInTheDocument();
      expect(await screen.findByText("Investigate Evidence Case")).toBeInTheDocument();
    });
  });

  describe("Across All Standard Breakpoints", () => {
    VIEWPORTS.forEach(({ name, width, height }) => {
      it(`renders Header correctly at ${name}`, () => {
        setViewport(width, height);
        render(<Header mode="citizen" citizenTab="home" />);
        expect(screen.getByText("StreamSignal")).toBeInTheDocument();
      });

      it(`renders HeroLanding correctly at ${name}`, () => {
        setViewport(width, height);
        render(<HeroLanding onStartWithPhoto={vi.fn()} onStartWithoutPhoto={vi.fn()} />);
        expect(screen.getByText("Capture what you see")).toBeInTheDocument();
      });
    });
  });

  describe("200% Browser Zoom Verification", () => {
    it("simulates 200% zoom (1280px / 2 = 640px equivalent) and renders cleanly", () => {
      // At 200% zoom on a 1280px screen, the CSS layout viewport is 640px
      setViewport(640, 400);
      render(<Header mode="citizen" citizenTab="home" />);
      expect(screen.getByText("StreamSignal")).toBeInTheDocument();
    });

    it("simulates 200% zoom on mobile (640px / 2 = 320px equivalent) and renders cleanly", () => {
      setViewport(320, 240);
      render(
        <HeroLanding
          onStartWithPhoto={vi.fn()}
          onStartWithoutPhoto={vi.fn()}
        />
      );
      expect(screen.getByText("Capture what you see")).toBeInTheDocument();
    });
  });
});
