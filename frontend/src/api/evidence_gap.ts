/**
 * StreamSignal — Evidence Gap Intelligence & Mission Needs API Client (Issue 17)
 */

import { request } from "./client";
import {
  EvidenceGapListResponse,
  EvidenceGapDetail,
  MissionNeed,
  MissionNeedCreateRequest,
  MissionNeedListResponse,
  MissionNeedStatus,
} from "../types/evidence_gap";

export async function fetchEvidenceGaps(minCases: number = 1): Promise<EvidenceGapListResponse> {
  return request<EvidenceGapListResponse>(
    `/api/v1/research/evidence-gaps?min_cases=${minCases}`,
    { method: "GET" }
  );
}

export async function fetchDimensionGapDetail(dimension: string): Promise<EvidenceGapDetail> {
  return request<EvidenceGapDetail>(
    `/api/v1/research/evidence-gaps/${encodeURIComponent(dimension)}`,
    { method: "GET" }
  );
}

export async function createMissionNeed(payload: MissionNeedCreateRequest): Promise<MissionNeed> {
  return request<MissionNeed>("/api/v1/research/mission-needs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMissionNeeds(
  status?: string,
  dimension?: string
): Promise<MissionNeedListResponse> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (dimension) params.set("dimension", dimension);
  const qs = params.toString();
  return request<MissionNeedListResponse>(
    `/api/v1/research/mission-needs${qs ? `?${qs}` : ""}`,
    { method: "GET" }
  );
}

export async function fetchApprovedMissionNeeds(dimension?: string): Promise<MissionNeedListResponse> {
  const params = new URLSearchParams();
  if (dimension) params.set("dimension", dimension);
  const qs = params.toString();
  return request<MissionNeedListResponse>(
    `/api/v1/research/mission-needs/approved${qs ? `?${qs}` : ""}`,
    { method: "GET" }
  );
}

export async function transitionMissionNeedStatus(
  needId: string,
  toStatus: MissionNeedStatus
): Promise<MissionNeed> {
  return request<MissionNeed>(
    `/api/v1/research/mission-needs/${needId}/status?to_status=${toStatus}`,
    { method: "PATCH" }
  );
}
