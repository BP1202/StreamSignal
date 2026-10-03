/**
 * StreamSignal — Mission & Contributor Types
 * Urban Freshwater Evidence Collection & Provenance
 */

export interface ContributorProfile {
  id: string;
  contributor_id: string; // e.g. "SS-C-4821"
  display_name: string;   // e.g. "RiverHeron-4821"
  account_level: string;  // "LEVEL_1_CONTRIBUTOR" | "LEVEL_2_REGISTERED"
  email?: string | null;
  created_at: string;
}

export type MissionType =
  | "AFTER_RAIN_STREAM_CHECK"
  | "EVIDENCE_CLARIFICATION"
  | "PLACE_EVIDENCE_SNAPSHOT";

export type MissionStatus =
  | "DISCOVERING"
  | "MISSION_PLANNED"
  | "WAITING_FOR_CITIZEN"
  | "COLLECTING_EVIDENCE"
  | "VALIDATING_EVIDENCE"
  | "NEEDS_CLARIFICATION"
  | "READY_FOR_SUBMISSION"
  | "SUBMITTED"
  | "RESEARCH_REVIEW";

export type MissionAgentActionType =
  | "REQUEST_OBSERVATION"
  | "REQUEST_PHOTO"
  | "REQUEST_CLARIFICATION"
  | "READY_FOR_SUBMISSION"
  | "HANDOFF_TO_RESEARCH";

export interface MissionAgentAction {
  action_type: MissionAgentActionType;
  observation_type?: string | null;
  reason: string;
  user_message: string;
  required_evidence: string[];
  missing_evidence: string[];
  micro_learning?: string | null;
}

export interface AgentAuditItem {
  id: string;
  action_type: string;
  actor: string;
  tool_used?: string | null;
  reason?: string | null;
  result_summary?: string | null;
  created_at: string;
}

export interface MissionItem {
  id: string;
  mission_type: MissionType;
  status: MissionStatus;
  title: string;
  purpose: string;
  research_need: string;
  research_need_source: string;
  target_latitude?: number | null;
  target_longitude?: number | null;
  required_evidence: string[];
  collected_evidence: Record<string, any>;
  missing_evidence: string[];
  next_action?: MissionAgentAction | null;
  contributor_id?: string | null;
  signal_case_id?: string | null;
  created_at: string;
  submitted_at?: string | null;
  agent_audits?: AgentAuditItem[];
}

export interface MissionEvidenceSubmission {
  description?: string;
  water_appearance?: string;
  flow_condition?: string;
  odor?: string;
  foam_observed?: boolean;
  litter_observed?: boolean;
  dead_wildlife_observed?: boolean;
  media_id?: string;
  latitude?: number;
  longitude?: number;
  additional_notes?: string;
}

export interface MissionTemplate {
  mission_type: MissionType;
  title: string;
  purpose: string;
  research_need: string;
  research_need_source: string;
  required_evidence: string[];
  micro_learning: string;
  estimated_effort_minutes: number;
}
