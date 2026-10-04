/**
 * StreamSignal — Researcher-Contributor Contact API Client (Issue 36)
 */

import { request } from "./client";
import {
  ContactRequestCreatePayload,
  ContactRequestItem,
  ContactResponsePayload,
  CitizenContactInitiatePayload,
} from "../types/contact";

export async function fetchCaseContactRequests(
  caseId: string
): Promise<ContactRequestItem[]> {
  return request<ContactRequestItem[]>(
    `/api/v1/research/evidence-cases/${caseId}/contact-requests`,
    {
      method: "GET",
      headers: {
        "X-Role": "RESEARCHER",
      },
    }
  );
}

export async function createResearcherContactRequest(
  caseId: string,
  payload: ContactRequestCreatePayload,
  reviewerId: string = "Dr-Sarah-Chen-Lead-Limnologist"
): Promise<ContactRequestItem> {
  return request<ContactRequestItem>(
    `/api/v1/research/evidence-cases/${caseId}/contact-requests`,
    {
      method: "POST",
      headers: {
        "X-Role": "RESEARCHER",
        "X-Reviewer-Id": reviewerId,
      },
      body: JSON.stringify(payload),
    }
  );
}

export async function fetchContributorContactRequests(
  contributorId?: string
): Promise<ContactRequestItem[]> {
  const headers: Record<string, string> = {};
  if (contributorId) {
    headers["X-Contributor-Id"] = contributorId;
  }
  return request<ContactRequestItem[]>("/api/v1/citizen/contact-requests", {
    method: "GET",
    headers,
  });
}

export async function respondToContactRequest(
  requestId: string,
  payload: ContactResponsePayload,
  contributorId?: string
): Promise<ContactRequestItem> {
  const headers: Record<string, string> = {};
  if (contributorId) {
    headers["X-Contributor-Id"] = contributorId;
  }
  return request<ContactRequestItem>(
    `/api/v1/citizen/contact-requests/${requestId}/respond`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );
}

export async function initiateCitizenContact(
  caseId: string,
  payload: CitizenContactInitiatePayload,
  contributorId?: string
): Promise<ContactRequestItem> {
  const headers: Record<string, string> = {};
  if (contributorId) {
    headers["X-Contributor-Id"] = contributorId;
  }
  return request<ContactRequestItem>(
    `/api/v1/citizen/evidence-cases/${caseId}/contact-researcher`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );
}
