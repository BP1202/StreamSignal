import { request } from "./client";
import { ReportCreate, ReportResponse, ReportListResponse } from "../types/report";
import { ReportMediaResponse } from "../types/media";
import {
  EvidenceInterviewResponse,
  EvidenceInterviewAnswersResponse,
  InterviewAnswerSubmission,
} from "../types/interview";
import { EvidenceCaseResponse, TriageResponse } from "../types/evidence_case";

export async function createReport(data: ReportCreate): Promise<ReportResponse> {
  return request<ReportResponse>("/api/v1/reports", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getReport(reportId: string): Promise<ReportResponse> {
  return request<ReportResponse>(`/api/v1/reports/${reportId}`, {
    method: "GET",
  });
}

export async function listReports(limit = 20, offset = 0): Promise<ReportListResponse> {
  return request<ReportListResponse>(`/api/v1/reports?limit=${limit}&offset=${offset}`, {
    method: "GET",
  });
}

export async function uploadReportMedia(
  reportId: string,
  file: File
): Promise<ReportMediaResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return request<ReportMediaResponse>(`/api/v1/reports/${reportId}/media`, {
    method: "POST",
    body: formData,
  });
}

export async function getEvidenceInterview(
  reportId: string
): Promise<EvidenceInterviewResponse> {
  return request<EvidenceInterviewResponse>(
    `/api/v1/reports/${reportId}/evidence-interview`,
    {
      method: "GET",
    }
  );
}

export async function submitEvidenceInterviewAnswers(
  reportId: string,
  answers: InterviewAnswerSubmission[]
): Promise<EvidenceInterviewAnswersResponse> {
  return request<EvidenceInterviewAnswersResponse>(
    `/api/v1/reports/${reportId}/evidence-interview/answers`,
    {
      method: "POST",
      body: JSON.stringify({ answers }),
    }
  );
}

export async function getEvidenceCase(
  reportId: string
): Promise<EvidenceCaseResponse> {
  return request<EvidenceCaseResponse>(
    `/api/v1/reports/${reportId}/evidence-case`,
    {
      method: "GET",
    }
  );
}

export async function getEvidenceTriage(
  reportId: string
): Promise<TriageResponse> {
  return request<TriageResponse>(`/api/v1/reports/${reportId}/triage`, {
    method: "GET",
  });
}
