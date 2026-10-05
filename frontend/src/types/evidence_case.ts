import { ReportMediaResponse } from "./media";

export type EvidenceQualityLevel = "COMPLETE" | "PARTIAL" | "INSUFFICIENT";

export interface EvidenceQualityResponse {
  report_id: string;
  quality: EvidenceQualityLevel;
  score: number;
  present: string[];
  missing: string[];
  recommendations: string[];
}

export interface LocationData {
  latitude: number;
  longitude: number;
}

export interface CitizenEvidence {
  observation_time: string;
  location: LocationData;
  description: string;
  water_appearance?: string | null;
  odor?: string | null;
  flow_condition?: string | null;
  foam_observed: boolean;
  litter_observed: boolean;
  dead_wildlife_observed: boolean;
  media: ReportMediaResponse[];
}

export interface MachineAssistanceSection {
  status: string;
  items: Record<string, unknown>[];
}

export interface ContextualEvidenceSection {
  status: string;
  items: Record<string, unknown>[];
}

export interface HumanDecisionSection {
  status: string;
  decision?: string | null;
  reviewer?: string | null;
  notes?: string | null;
}

export interface EvidenceCaseProvenance {
  source: string;
  generated_at: string;
  components: string[];
}

export interface EvidenceCaseResponse {
  case_id: string;
  report_id: string;
  status: string;
  created_at: string;
  citizen_evidence: CitizenEvidence;
  evidence_quality: EvidenceQualityResponse;
  machine_assistance: MachineAssistanceSection;
  contextual_evidence: ContextualEvidenceSection;
  human_decision: HumanDecisionSection;
  provenance: EvidenceCaseProvenance;
}

export type TriageAction = "MONITOR" | "REQUEST_MORE_EVIDENCE" | "EXPERT_REVIEW" | "FIELD_VERIFICATION";

export interface TriageEvidenceSummary {
  quality: string;
  quality_score: number;
  media_count: number;
  visual_observation_count: number;
  historical_match_count: number;
  human_review_status: string;
}

export interface TriageResponse {
  report_id: string;
  recommended_action: TriageAction;
  reason_codes: string[];
  evidence_summary: TriageEvidenceSummary;
  explanation: string[];
  limitations: string[];
}
