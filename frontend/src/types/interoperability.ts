/**
 * StreamSignal — Track 7 Interoperability Types
 * Typed contracts for Evidence Passport and FHIR R4 Bundle exports.
 */

export interface PassportMetadata {
  passport_id: string;
  schema_version: string;
  generated_at: string;
  system_source: string;
  governance_standard: string;
}

export interface SignalCaseIdentity {
  case_id: string;
  report_id: string;
  created_at: string;
  current_evidence_state: string;
  current_workflow_status: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
}

export interface CitizenEvidencePassportSection {
  evidence_origin: string;
  observed_at: string;
  location: LocationData;
  description: string;
  water_appearance?: string | null;
  flow_condition?: string | null;
  odor?: string | null;
  foam_observed: boolean;
  litter_observed: boolean;
  dead_wildlife_observed: boolean;
}

export interface QualityPassportSection {
  quality_tier: string;
  completeness_score: number;
  present_dimensions: string[];
  missing_dimensions: string[];
  recommendations: string[];
  interpretation_boundary: string;
}

export interface MediaPassportItem {
  media_id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  sha256_hash: string;
  safe_reference: string;
}

export interface MediaPassportSection {
  total_media: number;
  items: MediaPassportItem[];
}

export interface MachineObservationPassportItem {
  observation_id: string;
  media_id: string;
  observation_type: string;
  evidence_class: string;
  description: string;
  uncertainty: string;
  sha256_integrity: string;
}

export interface MachineObservationPassportSection {
  status: string;
  evidence_class: string;
  items: MachineObservationPassportItem[];
  scientific_limitation: string;
}

export interface ContextualMatchPassportItem {
  report_id: string;
  observed_at: string;
  distance_meters: number;
  days_difference: number;
  matched_signals: string[];
  similarity_explanation: string[];
}

export interface ContextualPassportSection {
  status: string;
  matches_count: number;
  search_radius_meters: number;
  historical_window_days: number;
  summary: string;
  matches: ContextualMatchPassportItem[];
  interpretation_boundary: string;
}

export interface SignalGuardPassportSection {
  contract_version: string;
  rules_applied: string[];
  guarantees: string[];
  supported_claims: string[];
  prohibited_interpretations: string[];
}

export interface HumanDecisionPassportSection {
  review_status: string;
  outcome?: string | null;
  workflow_status: string;
  evidence_state_before?: string | null;
  evidence_state_after?: string | null;
  reviewer_id?: string | null;
  rationale?: string | null;
  linked_case_id?: string | null;
  reviewed_at?: string | null;
  boundary_notice: string;
}

export interface LineagePassportItem {
  event_id: string;
  event_type: string;
  actor_type: string;
  actor_id: string;
  summary: string;
  created_at: string;
}

export interface LineagePassportSection {
  total_events: number;
  events: LineagePassportItem[];
}

export interface EvidencePassportResponse {
  metadata: PassportMetadata;
  identity: SignalCaseIdentity;
  citizen_evidence: CitizenEvidencePassportSection;
  evidence_quality: QualityPassportSection;
  media_evidence: MediaPassportSection;
  machine_assistance: MachineObservationPassportSection;
  contextual_evidence: ContextualPassportSection;
  signal_guard: SignalGuardPassportSection;
  human_decision: HumanDecisionPassportSection;
  lineage: LineagePassportSection;
}

export interface FHIRBundleEntry {
  fullUrl: string;
  resource: Record<string, any>;
}

export interface FHIRBundle {
  resourceType: string;
  id: string;
  type: string;
  timestamp: string;
  total: number;
  entry: FHIRBundleEntry[];
}
