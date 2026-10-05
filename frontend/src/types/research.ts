/**
 * StreamSignal — Research Workspace Types
 * Defines TypeScript interfaces for the Research Evidence Workspace,
 * Evidence Inbox, Why-This-Case explainability, Case Investigation,
 * Human Review decisions, and Evidence Lineage events.
 */

export type WhySurfacedCategory =
  | "VISUAL_EVIDENCE"
  | "HISTORICAL_CONTEXT"
  | "EVIDENCE_COMPLETENESS"
  | "TRIAGE_ACTION"
  | "HUMAN_REVIEW_STATE";

export interface WhySurfacedReason {
  category: WhySurfacedCategory;
  summary: string;
  details?: string | null;
}

export interface ResearchLocationSummary {
  latitude: number;
  longitude: number;
  stream_name?: string | null;
}

export type TriageAction =
  | "MONITOR"
  | "REQUEST_MORE_EVIDENCE"
  | "EXPERT_REVIEW"
  | "FIELD_VERIFICATION";

export type EvidenceQualityTier = "COMPLETE" | "PARTIAL" | "INSUFFICIENT";

// ----------------------------------------------------------------------------
// Issue 13: Human Review & Evidence Trust Loop Types
// ----------------------------------------------------------------------------

export type HumanReviewOutcome =
  | "SUPPORTS_REPORTED_OBSERVATION"
  | "REQUEST_CLARIFICATION"
  | "REQUEST_MORE_EVIDENCE"
  | "REQUEST_FIELD_VERIFICATION"
  | "MARK_RELATED_CASE"
  | "MARK_POTENTIAL_DUPLICATE"
  | "INSUFFICIENT_EVIDENCE"
  | "RESOLVED_NO_ACTION";

export type CaseWorkflowStatus =
  | "AWAITING_REVIEW"
  | "REVIEWED"
  | "AWAITING_CITIZEN_RESPONSE"
  | "AWAITING_MORE_EVIDENCE"
  | "FIELD_VERIFICATION_REQUESTED"
  | "RELATED_TO_CASE"
  | "POTENTIAL_DUPLICATE"
  | "CLOSED_INSUFFICIENT_EVIDENCE"
  | "RESOLVED";

export type EvidenceStateTier =
  | "E1_REPORTED"
  | "E2_DOCUMENTED"
  | "E3_INFERRED"
  | "E4_CORROBORATED"
  | "E5_VERIFIED";

export type ActorType =
  | "CITIZEN"
  | "SYSTEM"
  | "RESEARCHER"
  | "FIELD_VERIFIER"
  | "SENSOR"
  | "LABORATORY";

export interface HumanReviewItem {
  id: string;
  case_id: string;
  report_id: string;
  reviewer_id: string;
  outcome: HumanReviewOutcome;
  rationale: string;
  linked_case_id?: string | null;
  evidence_state_before: string;
  evidence_state_after: string;
  workflow_status: CaseWorkflowStatus;
  created_at: string;
}

export interface HumanReviewCreateRequest {
  outcome: HumanReviewOutcome;
  rationale: string;
  linked_case_id?: string | null;
}

export interface HumanReviewListResponse {
  reviews: HumanReviewItem[];
  total: number;
}

export interface EvidenceLineageEventItem {
  id: string;
  signal_case_id: string;
  event_type: string;
  actor_type: ActorType;
  actor_id: string;
  source_service: string;
  summary: string;
  structured_payload_json: Record<string, any>;
  created_at: string;
}

export interface EvidenceLineageListResponse {
  events: EvidenceLineageEventItem[];
  total: number;
}

export interface CitizenImpactStatus {
  case_id: string;
  status: string;
  status_label: string;
  description: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// Inbox and Detail Models
// ----------------------------------------------------------------------------

export interface ResearchInboxItem {
  case_id: string;
  observed_at: string;
  location: ResearchLocationSummary;
  description?: string | null;
  water_appearance?: string | null;
  flow_condition?: string | null;
  odor?: string | null;
  quality_rating: EvidenceQualityTier;
  completeness_score: number;
  media_count: number;
  pattern_echo_count: number;
  triage_action: TriageAction;
  triage_reasons: string[];
  human_decision_status: string;
  workflow_status?: string;
  evidence_state?: string;
  why_surfaced: WhySurfacedReason[];
}

export interface ResearchInboxResponse {
  items: ResearchInboxItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface EvidenceQualityAssessment {
  report_id: string;
  quality: EvidenceQualityTier;
  score: number;
  present: string[];
  missing: string[];
  recommendations: string[];
}

export interface ResearchMediaAttachment {
  media_id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface VisualObservationItem {
  observation_id: string;
  media_id: string;
  observation_type: string;
  evidence_class: string;
  description: string;
  uncertainty: string;
  support: {
    media_id: string;
    sha256: string;
    content_type: string;
  };
}

export interface MediaVisualObservationGroup {
  media_id: string;
  observations: VisualObservationItem[];
}

export interface PatternEchoMatchItem {
  report_id: string;
  observed_at: string;
  distance_meters: number;
  days_difference: number;
  matched_signals: string[];
  similarity_explanation: string[];
}

export interface PatternEchoData {
  report_id: string;
  status: "AVAILABLE" | "NO_MATCHES";
  search_radius_meters: number;
  historical_window_days: number;
  matches: PatternEchoMatchItem[];
  summary: string;
  interpretation_limit: string;
}

export interface EvidenceClaimItem {
  claim_id: string;
  claim: string;
  evidence_class: string;
  source: string;
  support: string[];
  uncertainty: string[];
  allowed_actions: string[];
  prohibited_interpretations: string[];
}

export interface EvidenceContractData {
  report_id: string;
  contract_version: string;
  created_at: string;
  claims: EvidenceClaimItem[];
  provenance: {
    system: string;
    governance_standard: string;
    evaluated_at: string;
  };
}

export interface TriageDetailData {
  report_id: string;
  recommended_action: TriageAction;
  reason_codes: string[];
  summary: string;
  evidence_summary: {
    evidence_quality_tier: string;
    media_count: number;
    visual_observation_count: number;
    historical_match_count: number;
    human_decision_status: string;
  };
}

export interface ResearchCaseDetailResponse {
  case_id: string;
  observed_at: string;
  location: ResearchLocationSummary;
  description?: string | null;
  water_appearance?: string | null;
  flow_condition?: string | null;
  odor?: string | null;
  foam_observed?: boolean | null;
  litter_observed?: boolean | null;
  dead_wildlife_observed?: boolean | null;
  human_decision_status: string;
  workflow_status: string;
  evidence_state: string;
  latest_human_review?: HumanReviewItem | null;
  review_count: number;
  lineage_count: number;
  why_surfaced: WhySurfacedReason[];
  evidence_quality: EvidenceQualityAssessment;
  media?: ResearchMediaAttachment[];
  media_observations: MediaVisualObservationGroup[];
  contextual_evidence: PatternEchoData;
  triage: TriageDetailData;
  evidence_contract: EvidenceContractData;
}

export interface CitizenMediaSummaryItem {
  media_id: string;
  case_id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  report_description?: string | null;
  water_appearance?: string | null;
  flow_condition?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CitizenMediaListResponse {
  items: CitizenMediaSummaryItem[];
  total: number;
}
