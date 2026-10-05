/**
 * StreamSignal — Evidence Gap Intelligence & Mission Need Types (Issue 17)
 */

export interface EvidenceGapSummary {
  dimension: string;
  dimension_label: string;
  total_cases_analyzed: number;
  cases_with_evidence: number;
  cases_missing_evidence: number;
  availability_ratio: number;
  affected_segment_ids: string[];
  first_observed_at: string | null;
  last_observed_at: string | null;
}

export interface EvidenceGapListResponse {
  total_cases_analyzed: number;
  gaps: EvidenceGapSummary[];
  analysis_timestamp: string;
  epistemic_notice: string;
}

export interface EvidenceGapDetail {
  dimension: string;
  dimension_label: string;
  total_cases_analyzed: number;
  cases_with_evidence: number;
  cases_missing_evidence: number;
  availability_ratio: number;
  affected_case_ids: string[];
  affected_segment_ids: string[];
  first_observed_at: string | null;
  last_observed_at: string | null;
  epistemic_statement: string;
}

export type MissionNeedStatus =
  | "IDENTIFIED"
  | "REVIEWED"
  | "APPROVED"
  | "MISSION_PLANNED"
  | "ACTIVE"
  | "FULFILLED"
  | "CLOSED";

export interface MissionNeed {
  id: string;
  evidence_gap_dimension: string;
  title: string;
  description: string;
  rationale: string;
  status: MissionNeedStatus;
  created_by_researcher: string;
  source_case_ids: string[];
  target_stream_segments: string[];
  required_evidence: string[];
  created_at: string;
  approved_at: string | null;
  fulfilled_at: string | null;
  updated_at: string;
}

export interface MissionNeedCreateRequest {
  evidence_gap_dimension: string;
  title: string;
  description: string;
  rationale: string;
  source_case_ids?: string[];
  target_stream_segments?: string[];
  required_evidence?: string[];
  created_by_researcher?: string;
}

export interface MissionNeedListResponse {
  needs: MissionNeed[];
  total: number;
}
