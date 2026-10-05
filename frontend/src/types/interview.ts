import { EvidenceQualityResponse } from "./evidence_case";

export interface QuestionOption {
  label: string;
  value: string;
}

export interface EvidenceInterviewQuestion {
  question_id: string;
  field: string;
  question: string;
  answer_type: "single_choice" | "free_text" | string;
  options?: QuestionOption[] | null;
}

export interface EvidenceInterviewResponse {
  report_id: string;
  questions: EvidenceInterviewQuestion[];
}

export interface InterviewAnswerSubmission {
  question_id: string;
  value: string;
}

export interface EvidenceInterviewAnswersRequest {
  answers: InterviewAnswerSubmission[];
}

export interface EvidenceInterviewAnswersResponse {
  report_id: string;
  updated_fields: string[];
  message: string;
  evidence_quality: EvidenceQualityResponse;
}
