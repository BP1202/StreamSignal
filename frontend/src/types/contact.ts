/**
 * StreamSignal — Researcher-Contributor Contact Types (Issue 36)
 */

export type ContactReason =
  | "CLARIFICATION"
  | "ADDITIONAL_EVIDENCE"
  | "FIELD_VERIFICATION"
  | "GENERAL_INQUIRY";

export type ContactStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";

export type ContactInitiator = "RESEARCHER" | "CONTRIBUTOR";

export type PreferredContactMethod = "EMAIL" | "PHONE" | "IN_APP";

export interface ContactRequestItem {
  id: string;
  signal_case_id: string;
  contributor_id: string | null;
  contributor_handle: string | null;
  initiated_by: ContactInitiator;
  researcher_id: string | null;
  reason: ContactReason | string;
  message: string;
  status: ContactStatus;
  shared_email: string | null;
  shared_phone: string | null;
  preferred_method: PreferredContactMethod | string | null;
  contributor_note: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactRequestCreatePayload {
  reason: ContactReason | string;
  message: string;
}

export interface ContactResponsePayload {
  action: "ACCEPT" | "DECLINE";
  shared_email?: string;
  shared_phone?: string;
  preferred_method?: PreferredContactMethod;
  contributor_note?: string;
}

export interface CitizenContactInitiatePayload {
  reason?: ContactReason | string;
  message: string;
  shared_email?: string;
  shared_phone?: string;
  preferred_method?: PreferredContactMethod;
  note?: string;
}
