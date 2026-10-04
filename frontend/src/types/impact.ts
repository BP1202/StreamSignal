/**
 * StreamSignal — Citizen Contributor Impact & Evidence Coverage Types
 */

export interface ContributionHistoryItem {
  submission_id: string;
  signal_case_id: string | null;
  mission_title: string;
  dimensions_provided: string[];
  submitted_at: string;
  review_status: "AWAITING_REVIEW" | "ACCEPTED_FOR_RESEARCH" | "MORE_EVIDENCE_REQUESTED" | string;
  coverage_delta_pct: number;
}

export interface ContributorImpactResponse {
  contributor_id: string;
  display_name: string;
  account_level: string;
  total_contributions: number;
  verified_contributions: number;
  overall_evidence_coverage: number;
  total_coverage_delta_contributed: number;
  recent_contributions: ContributionHistoryItem[];
  stewardship_milestones: string[];
  epistemic_notice: string;
}

export interface EvidenceCoverageInfo {
  total_cases_analyzed: number;
  overall_coverage_ratio: number;
  overall_coverage_percentage: number;
  total_potential_dimensions: number;
  total_dimensions_present: number;
  potential_coverage_per_dimension: number;
  epistemic_notice: string;
  gaps: Array<{
    dimension: string;
    dimension_label: string;
    total_cases_analyzed: number;
    cases_with_evidence: number;
    cases_missing_evidence: number;
    availability_ratio: number;
  }>;
}
