import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { ContributorIdentityBadge } from "./components/missions/ContributorIdentityBadge";
import { CitizenMissionPortal } from "./components/missions/CitizenMissionPortal";
import { AgentGuidedMissionFlow } from "./components/missions/AgentGuidedMissionFlow";
import { ContributorProfile, MissionItem } from "./types/mission";
import * as missionApi from "./api/missions";

describe("Citizen Missions & Contributor Loop Components", () => {
  const mockProfileLevel1: ContributorProfile = {
    id: "contributor-uuid-1",
    contributor_id: "SS-C-4821",
    display_name: "RiverHeron-4821",
    account_level: "LEVEL_1_CONTRIBUTOR",
    email: null,
    created_at: new Date().toISOString(),
  };

  const mockProfileLevel2: ContributorProfile = {
    id: "contributor-uuid-1",
    contributor_id: "SS-C-4821",
    display_name: "RiverHeron-4821",
    account_level: "LEVEL_2_REGISTERED",
    email: "scout@oneaquahealth.org",
    created_at: new Date().toISOString(),
  };

  const mockMission: MissionItem = {
    id: "mission-uuid-1",
    mission_type: "AFTER_RAIN_STREAM_CHECK",
    status: "COLLECTING_EVIDENCE",
    title: "After-Rain Stream Check",
    purpose: "Collect structured observations and media of a stream after rainfall.",
    research_need: "Temporal comparison of stream conditions during precipitation events.",
    research_need_source: "TEMPLATE",
    target_latitude: 41.1579,
    target_longitude: -8.6291,
    required_evidence: ["photo", "flow_condition", "water_appearance", "foam_observed"],
    collected_evidence: { flow_condition: "moderate" },
    missing_evidence: ["photo", "water_appearance", "foam_observed"],
    next_action: {
      action_type: "REQUEST_PHOTO",
      reason: "Missing photograph for visual baseline.",
      user_message: "Please attach a clear photograph showing the stream surface.",
      required_evidence: ["photo", "flow_condition", "water_appearance", "foam_observed"],
      missing_evidence: ["photo", "water_appearance", "foam_observed"],
      micro_learning: "Photos provide baseline visual documentation.",
    },
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders ContributorIdentityBadge with handle and level 1 indicator", () => {
    const onUpdated = vi.fn();
    render(
      <ContributorIdentityBadge
        profile={mockProfileLevel1}
        onProfileUpdated={onUpdated}
      />
    );

    expect(screen.getByText("RiverHeron-4821")).toBeInTheDocument();
    expect(screen.getByText("SS-C-4821")).toBeInTheDocument();
    expect(screen.getByText("Level 1 Anonymous Contributor")).toBeInTheDocument();
    expect(screen.getByText("Upgrade")).toBeInTheDocument();
  });

  it("opens account upgrade modal and preserves identifier", () => {
    const onUpdated = vi.fn();
    render(
      <ContributorIdentityBadge
        profile={mockProfileLevel1}
        onProfileUpdated={onUpdated}
      />
    );

    fireEvent.click(screen.getByText("Upgrade"));
    expect(screen.getByText("Upgrade to Level 2 Contributor")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SS-C-4821 (RiverHeron-4821)")).toBeInTheDocument();
  });

  it("shows Level 2 indicator and hides upgrade button when account is upgraded", () => {
    const onUpdated = vi.fn();
    render(
      <ContributorIdentityBadge
        profile={mockProfileLevel2}
        onProfileUpdated={onUpdated}
      />
    );

    expect(screen.getByText("✓ Level 2 Registered Contributor")).toBeInTheDocument();
    expect(screen.queryByText("Upgrade")).not.toBeInTheDocument();
  });

  it("renders CitizenMissionPortal with empty state when no missions exist", async () => {
    vi.spyOn(missionApi, "fetchContributorProfile").mockResolvedValue(mockProfileLevel1);
    vi.spyOn(missionApi, "fetchCitizenMissions").mockResolvedValue({
      missions: [],
      total: 0,
    });

    render(<CitizenMissionPortal />);

    await waitFor(() => {
      expect(screen.getByText("No Active Evidence Missions")).toBeInTheDocument();
    });
  });

  it("renders CitizenMissionPortal with available missions", async () => {
    vi.spyOn(missionApi, "fetchContributorProfile").mockResolvedValue(mockProfileLevel1);
    vi.spyOn(missionApi, "fetchCitizenMissions").mockResolvedValue({
      missions: [mockMission],
      total: 1,
    });

    render(<CitizenMissionPortal />);

    await waitFor(() => {
      expect(screen.getByText("After-Rain Stream Check")).toBeInTheDocument();
      expect(screen.getByText("Accept Mission →")).toBeInTheDocument();
    });
  });

  it("renders AgentGuidedMissionFlow with agent advice and micro-learning", () => {
    const onUpdate = vi.fn();
    const onSubmit = vi.fn();
    const onBack = vi.fn();

    render(
      <AgentGuidedMissionFlow
        mission={mockMission}
        contributor={mockProfileLevel1}
        onMissionUpdated={onUpdate}
        onMissionSubmitted={onSubmit}
        onBack={onBack}
      />
    );

    expect(
      screen.getByText("Evidence Mission Agent Guidance")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Please attach a clear photograph showing the stream surface.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Photos provide baseline visual documentation/i)
    ).toBeInTheDocument();
    expect(screen.getByText("🔍 Validate with Agent")).toBeInTheDocument();
  });
});
