/**
 * StreamSignal — Research Workspace API Client
 * Calls the versioned backend endpoints under /api/v1/research and /api/v1/reports.
 */

import { request } from "./client";
import {
  ResearchInboxResponse,
  ResearchCaseDetailResponse,
  HumanReviewCreateRequest,
  HumanReviewItem,
  HumanReviewListResponse,
  EvidenceLineageListResponse,
  CitizenImpactStatus,
} from "../types/research";
import {
  EvidencePassportResponse,
  FHIRBundle,
} from "../types/interoperability";

export interface ResearchInboxParams {
  action?: string;
  quality_rating?: string;
  has_media?: boolean;
  has_pattern_echo?: boolean;
  limit?: number;
  offset?: number;
}

export async function fetchResearchInbox(
  params: ResearchInboxParams = {}
): Promise<ResearchInboxResponse> {
  const query = new URLSearchParams();
  if (params.action) query.set("action", params.action);
  if (params.quality_rating) query.set("quality_rating", params.quality_rating);
  if (params.has_media !== undefined) query.set("has_media", String(params.has_media));
  if (params.has_pattern_echo !== undefined) query.set("has_pattern_echo", String(params.has_pattern_echo));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));

  const qs = query.toString();
  const endpoint = `/api/v1/research/evidence-cases${qs ? `?${qs}` : ""}`;
  return request<ResearchInboxResponse>(endpoint, { method: "GET" });
}

export async function fetchResearchCaseDetail(
  caseId: string
): Promise<ResearchCaseDetailResponse> {
  return request<ResearchCaseDetailResponse>(
    `/api/v1/research/evidence-cases/${caseId}`,
    { method: "GET" }
  );
}

export async function submitHumanReview(
  caseId: string,
  payload: HumanReviewCreateRequest,
  reviewerId: string = "researcher-primary"
): Promise<HumanReviewItem> {
  return request<HumanReviewItem>(
    `/api/v1/research/evidence-cases/${caseId}/reviews`,
    {
      method: "POST",
      headers: {
        "X-Reviewer-Id": reviewerId,
      },
      body: JSON.stringify(payload),
    }
  );
}

export async function fetchCaseReviews(
  caseId: string
): Promise<HumanReviewListResponse> {
  return request<HumanReviewListResponse>(
    `/api/v1/research/evidence-cases/${caseId}/reviews`,
    { method: "GET" }
  );
}

export async function fetchCaseLineage(
  caseId: string
): Promise<EvidenceLineageListResponse> {
  return request<EvidenceLineageListResponse>(
    `/api/v1/research/evidence-cases/${caseId}/lineage`,
    { method: "GET" }
  );
}

export async function fetchCitizenImpactStatus(
  caseId: string
): Promise<CitizenImpactStatus> {
  return request<CitizenImpactStatus>(
    `/api/v1/reports/${caseId}/impact-status`,
    { method: "GET" }
  );
}

export async function fetchEvidencePassport(
  caseId: string
): Promise<EvidencePassportResponse> {
  return request<EvidencePassportResponse>(
    `/api/v1/research/evidence-cases/${caseId}/evidence-passport`,
    { method: "GET" }
  );
}

export async function fetchFHIRBundle(
  caseId: string
): Promise<FHIRBundle> {
  return request<FHIRBundle>(
    `/api/v1/research/evidence-cases/${caseId}/fhir`,
    { method: "GET" }
  );
}
