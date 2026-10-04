import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContactContributorModal } from "./components/research/ContactContributorModal";
import { CitizenContactRequestsModal } from "./components/missions/CitizenContactRequestsModal";
import * as contactApi from "./api/contact";
import { ContactRequestItem } from "./types/contact";

const mockPendingRequest: ContactRequestItem = {
  id: "req-1111-2222",
  signal_case_id: "case-aaaa-bbbb",
  contributor_id: "contr-1234",
  contributor_handle: "RiverOtter-9988",
  initiated_by: "RESEARCHER",
  researcher_id: "Dr-Sarah-Chen",
  reason: "CLARIFICATION",
  message: "Could you confirm if water was flowing near the culvert?",
  status: "PENDING",
  shared_email: null,
  shared_phone: null,
  preferred_method: null,
  contributor_note: null,
  responded_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockAcceptedRequest: ContactRequestItem = {
  ...mockPendingRequest,
  status: "ACCEPTED",
  shared_email: "citizen.researcher@example.com",
  shared_phone: "+1-555-0199",
  preferred_method: "EMAIL",
  contributor_note: "Available weekdays after 4pm.",
  responded_at: new Date().toISOString(),
};

describe("Issue 36 — Researcher-Contributor Contact Workflow (Frontend)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders ContactContributorModal and displays existing contact request history", async () => {
    vi.spyOn(contactApi, "fetchCaseContactRequests").mockResolvedValue([mockAcceptedRequest]);

    render(
      <ContactContributorModal
        caseId="case-aaaa-bbbb"
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Loading contact requests...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Contact Contributor")).toBeInTheDocument();
      expect(screen.getByText(/RiverOtter-9988/)).toBeInTheDocument();
      expect(screen.getByText("citizen.researcher@example.com")).toBeInTheDocument();
      expect(screen.getByText("+1-555-0199")).toBeInTheDocument();
      expect(screen.getByText(/Available weekdays after 4pm/)).toBeInTheDocument();
    });
  });

  it("allows researcher to send a new contact request", async () => {
    vi.spyOn(contactApi, "fetchCaseContactRequests").mockResolvedValue([]);
    const createSpy = vi
      .spyOn(contactApi, "createResearcherContactRequest")
      .mockResolvedValue(mockPendingRequest);

    render(
      <ContactContributorModal
        caseId="case-aaaa-bbbb"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("New Contact Request")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(
      /Explain specifically what clarification/i
    );
    fireEvent.change(textarea, {
      target: { value: "We would like to take a sample at your observation point." },
    });

    const sendBtn = screen.getByRole("button", { name: /Send Request/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        "case-aaaa-bbbb",
        {
          reason: "CLARIFICATION",
          message: "We would like to take a sample at your observation point.",
        },
        "Dr-Sarah-Chen-Lead-Limnologist"
      );
    });
  });

  it("renders CitizenContactRequestsModal and allows citizen to accept with contact details", async () => {
    vi.spyOn(contactApi, "fetchContributorContactRequests").mockResolvedValue([
      mockPendingRequest,
    ]);
    const respondSpy = vi
      .spyOn(contactApi, "respondToContactRequest")
      .mockResolvedValue(mockAcceptedRequest);

    render(
      <CitizenContactRequestsModal
        contributorId="SS-C-1234"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Researcher Communications/i)).toBeInTheDocument();
      expect(
        screen.getByText(/"Could you confirm if water was flowing near the culvert\?"/)
      ).toBeInTheDocument();
    });

    // Click Respond / Share Contact
    const respondBtn = screen.getByRole("button", {
      name: /Respond \/ Share Contact/i,
    });
    fireEvent.click(respondBtn);

    // Form appears
    const emailInput = screen.getByPlaceholderText("your.email@example.com");
    fireEvent.change(emailInput, {
      target: { value: "my.email@domain.org" },
    });

    const submitBtn = screen.getByRole("button", { name: /Submit Response/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(respondSpy).toHaveBeenCalledWith(
        "req-1111-2222",
        expect.objectContaining({
          action: "ACCEPT",
          shared_email: "my.email@domain.org",
        }),
        "SS-C-1234"
      );
    });
  });

  it("allows citizen to decline contact request maintaining anonymity", async () => {
    vi.spyOn(contactApi, "fetchContributorContactRequests").mockResolvedValue([
      mockPendingRequest,
    ]);
    const respondSpy = vi
      .spyOn(contactApi, "respondToContactRequest")
      .mockResolvedValue({
        ...mockPendingRequest,
        status: "DECLINED",
      });

    render(
      <CitizenContactRequestsModal
        contributorId="SS-C-1234"
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/"Could you confirm if water was flowing near the culvert\?"/)
      ).toBeInTheDocument();
    });

    const declineBtn = screen.getByRole("button", { name: "Decline" });
    fireEvent.click(declineBtn);

    const submitBtn = screen.getByRole("button", { name: /Submit Response/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(respondSpy).toHaveBeenCalledWith(
        "req-1111-2222",
        expect.objectContaining({
          action: "DECLINE",
        }),
        "SS-C-1234"
      );
    });
  });
});
