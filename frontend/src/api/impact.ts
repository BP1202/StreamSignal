import { request } from "./client";
import { ContributorImpactResponse, EvidenceCoverageInfo } from "../types/impact";

/**
 * Fetches the authenticated/current citizen contributor's impact metrics:
 * - Evidence coverage delta (+0.89%)
 * - Completed mission history linked to SignalCases
 * - Researcher review statuses
 * - Stewardship milestones
 */
export async function fetchContributorImpact(
  contributorId?: string
): Promise<ContributorImpactResponse> {
  const headers: Record<string, string> = {};
  if (contributorId) {
    headers["X-Contributor-Id"] = contributorId;
  }
  return request<ContributorImpactResponse>("/api/v1/citizen/impact", {
    method: "GET",
    headers,
  });
}

/**
 * Fetches global evidence coverage statistics across all analyzed SignalCases.
 * Returns deterministic coverage percentage and per-dimension availability.
 */
export async function fetchEvidenceCoverage(): Promise<EvidenceCoverageInfo> {
  return request<EvidenceCoverageInfo>("/api/v1/citizen/evidence-coverage", {
    method: "GET",
  });
}
