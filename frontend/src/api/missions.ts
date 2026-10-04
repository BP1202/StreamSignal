/**
 * StreamSignal — Mission & Contributor API Client
 * Urban Freshwater Evidence Collection & Provenance
 */

import { request } from "./client";
import {
  ContributorProfile,
  MissionEvidenceSubmission,
  MissionItem,
  MissionTemplate,
} from "../types/mission";

export async function fetchContributorProfile(
  contributorId?: string
): Promise<ContributorProfile> {
  const headers: Record<string, string> = {};
  if (contributorId) {
    headers["X-Contributor-Id"] = contributorId;
  }
  return request<ContributorProfile>("/api/v1/citizen/me", {
    method: "GET",
    headers,
  });
}

export async function upgradeContributorAccount(
  data: { email: string; password: string },
  contributorId: string
): Promise<{ success: boolean; message: string; contributor: ContributorProfile }> {
  return request<{ success: boolean; message: string; contributor: ContributorProfile }>(
    "/api/v1/citizen/account/upgrade",
    {
      method: "POST",
      headers: {
        "X-Contributor-Id": contributorId,
      },
      body: JSON.stringify(data),
    }
  );
}

export async function fetchCitizenMissions(
  contributorId?: string
): Promise<{ missions: MissionItem[]; total: number }> {
  const headers: Record<string, string> = {};
  if (contributorId) {
    headers["X-Contributor-Id"] = contributorId;
  }
  return request<{ missions: MissionItem[]; total: number }>(
    "/api/v1/citizen/missions",
    {
      method: "GET",
      headers,
    }
  );
}

export async function fetchMissionRecommendations(
  contributorId?: string,
  streamSegment?: string
): Promise<{ recommendations: MissionItem[]; total: number }> {
  const headers: Record<string, string> = {};
  if (contributorId) {
    headers["X-Contributor-Id"] = contributorId;
  }
  const query = streamSegment ? `?stream_segment=${encodeURIComponent(streamSegment)}` : "";
  return request<{ recommendations: MissionItem[]; total: number }>(
    `/api/v1/citizen/missions/recommendations${query}`,
    {
      method: "GET",
      headers,
    }
  );
}

export async function fetchMissionDetail(missionId: string): Promise<MissionItem> {
  return request<MissionItem>(`/api/v1/citizen/missions/${missionId}`, {
    method: "GET",
  });
}

export async function startMission(
  missionId: string,
  contributorId: string
): Promise<MissionItem> {
  return request<MissionItem>(`/api/v1/citizen/missions/${missionId}/start`, {
    method: "POST",
    headers: {
      "X-Contributor-Id": contributorId,
    },
  });
}

export async function provideMissionEvidence(
  missionId: string,
  submission: MissionEvidenceSubmission,
  contributorId: string
): Promise<MissionItem> {
  return request<MissionItem>(`/api/v1/citizen/missions/${missionId}/evidence`, {
    method: "POST",
    headers: {
      "X-Contributor-Id": contributorId,
    },
    body: JSON.stringify(submission),
  });
}

export async function validateMission(
  missionId: string,
  submission: MissionEvidenceSubmission,
  contributorId: string
): Promise<MissionItem> {
  return request<MissionItem>(`/api/v1/citizen/missions/${missionId}/validate`, {
    method: "POST",
    headers: {
      "X-Contributor-Id": contributorId,
    },
    body: JSON.stringify(submission),
  });
}

export async function submitMission(
  missionId: string,
  contributorId: string
): Promise<{
  status: string;
  mission_id: string;
  case_id: string;
  message: string;
}> {
  return request<{
    status: string;
    mission_id: string;
    case_id: string;
    message: string;
  }>(`/api/v1/citizen/missions/${missionId}/submit`, {
    method: "POST",
    headers: {
      "X-Contributor-Id": contributorId,
    },
  });
}

export async function fetchMissionTemplates(): Promise<MissionTemplate[]> {
  return request<MissionTemplate[]>("/api/v1/agent/templates", {
    method: "GET",
  });
}

export async function planMission(
  missionType: string,
  targetLat?: number,
  targetLon?: number
): Promise<MissionItem> {
  return request<MissionItem>("/api/v1/agent/missions/plan", {
    method: "POST",
    body: JSON.stringify({
      mission_type: missionType,
      target_latitude: targetLat,
      target_longitude: targetLon,
    }),
  });
}

export async function planMissionFromGap(caseId: string): Promise<MissionItem> {
  return request<MissionItem>(`/api/v1/agent/missions/plan?case_id=${caseId}`, {
    method: "POST",
  });
}

export async function fetchResearcherMissions(
  caseId?: string
): Promise<{ missions: MissionItem[]; total: number }> {
  const url = caseId
    ? `/api/v1/research/missions?case_id=${caseId}`
    : "/api/v1/research/missions";
  return request<{ missions: MissionItem[]; total: number }>(url, {
    method: "GET",
  });
}

export async function fetchCaseMissionNeeds(caseId: string): Promise<any> {
  return request<any>(`/api/v1/research/evidence-cases/${caseId}/mission-needs`, {
    method: "GET",
  });
}
