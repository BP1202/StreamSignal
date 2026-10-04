import React, { useState, useEffect } from "react";
import {
  ContactRequestItem,
  ContactResponsePayload,
  PreferredContactMethod,
  CitizenContactInitiatePayload,
} from "../../types/contact";
import {
  fetchContributorContactRequests,
  respondToContactRequest,
  initiateCitizenContact,
} from "../../api/contact";
import { ApiError } from "../../api/client";
import {
  X,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Send,
  AlertCircle,
  RefreshCw,
  Mail,
  Phone,
  HelpCircle,
  ChevronRight,
} from "lucide-react";

interface CitizenContactRequestsModalProps {
  contributorId?: string;
  isOpen: boolean;
  onClose: () => void;
  onRequestResponded?: () => void;
  caseIdForDirectContact?: string;
}

export const CitizenContactRequestsModal: React.FC<CitizenContactRequestsModalProps> = ({
  contributorId,
  isOpen,
  onClose,
  onRequestResponded,
  caseIdForDirectContact,
}) => {
  const [requests, setRequests] = useState<ContactRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Responding state
  const [activeRespondingId, setActiveRespondingId] = useState<string | null>(null);
  const [responseAction, setResponseAction] = useState<"ACCEPT" | "DECLINE">("ACCEPT");
  const [sharedEmail, setSharedEmail] = useState<string>("");
  const [sharedPhone, setSharedPhone] = useState<string>("");
  const [preferredMethod, setPreferredMethod] = useState<PreferredContactMethod>("EMAIL");
  const [contributorNote, setContributorNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Direct contact initiation state
  const [isInitiatingDirect, setIsInitiatingDirect] = useState<boolean>(
    Boolean(caseIdForDirectContact)
  );
  const [directReason, setDirectReason] = useState<string>("ADDITIONAL_EVIDENCE");
  const [directMessage, setDirectMessage] = useState<string>("");
  const [directEmail, setDirectEmail] = useState<string>("");
  const [directPhone, setDirectPhone] = useState<string>("");

  const loadRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchContributorContactRequests(contributorId);
      setRequests(data);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load contact inquiries.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRequests();
      if (caseIdForDirectContact) {
        setIsInitiatingDirect(true);
      }
    }
  }, [isOpen, contributorId, caseIdForDirectContact]);

  if (!isOpen) return null;

  const handleRespondSubmit = async (e: React.FormEvent, requestId: string) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: ContactResponsePayload = {
        action: responseAction,
        shared_email: responseAction === "ACCEPT" && sharedEmail.trim() ? sharedEmail.trim() : undefined,
        shared_phone: responseAction === "ACCEPT" && sharedPhone.trim() ? sharedPhone.trim() : undefined,
        preferred_method: responseAction === "ACCEPT" ? preferredMethod : undefined,
        contributor_note: contributorNote.trim() || undefined,
      };

      await respondToContactRequest(requestId, payload, contributorId);
      setSuccessMessage(
        responseAction === "ACCEPT"
          ? "Thank you! Your direct contact preference was safely shared with the research team."
          : "Your preference was saved. The observation remains active for evidence analysis."
      );
      setActiveRespondingId(null);
      await loadRequests();
      if (onRequestResponded) onRequestResponded();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to record response.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDirectContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseIdForDirectContact) return;
    if (!directMessage.trim() || directMessage.trim().length < 5) {
      setError("Please provide a descriptive message (min 5 characters).");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: CitizenContactInitiatePayload = {
        reason: directReason,
        message: directMessage.trim(),
        shared_email: directEmail.trim() || undefined,
        shared_phone: directPhone.trim() || undefined,
        preferred_method: "EMAIL",
      };
      await initiateCitizenContact(caseIdForDirectContact, payload, contributorId);
      setSuccessMessage("Message sent directly to the research team for this observation.");
      setIsInitiatingDirect(false);
      setDirectMessage("");
      await loadRequests();
      if (onRequestResponded) onRequestResponded();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to send message.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const resolvedRequests = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-brand-border shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-border px-6 py-4 bg-brand-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-brand-teal">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-brand-text">
                Researcher Communications
              </h2>
              <p className="text-xs text-brand-secondary">
                Direct follow-up & clarification requests for your observations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Privacy Notice */}
          <div className="bg-brand-light/30 border border-brand-border rounded-lg p-3 flex items-start gap-2.5 text-xs text-brand-text">
            <Shield className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-brand-dark block">
                Opt-In Privacy Guarantee
              </span>
              Contact details are only shared directly with authorized researchers investigating your specific observation. They are never attached to public records or FHIR exports.
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-brand-teal animate-spin mx-auto" />
              <p className="text-xs text-brand-secondary">Loading inquiries...</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Direct message initiation form if requested */}
              {isInitiatingDirect && caseIdForDirectContact && (
                <form
                  onSubmit={handleDirectContactSubmit}
                  className="bg-brand-surface border border-brand-border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dark flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-brand-teal" />
                      Contact Research Team Regarding Observation
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsInitiatingDirect(false)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-brand-secondary block mb-1">
                      Reason
                    </label>
                    <select
                      value={directReason}
                      onChange={(e) => setDirectReason(e.target.value)}
                      className="w-full text-xs bg-white border border-brand-border rounded-lg px-2.5 py-2 text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-teal"
                    >
                      <option value="ADDITIONAL_EVIDENCE">Additional Observation / Photos</option>
                      <option value="CLARIFICATION">Clarification on Location / Water</option>
                      <option value="GENERAL_INQUIRY">Question About Research</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-brand-secondary block mb-1">
                      Message
                    </label>
                    <textarea
                      value={directMessage}
                      onChange={(e) => setDirectMessage(e.target.value)}
                      rows={3}
                      className="w-full text-xs bg-white border border-brand-border rounded-lg p-2.5 text-brand-text placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-brand-teal"
                      placeholder="Share what you observed or any questions for the research team..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-brand-secondary block mb-1">
                        Your Email (Optional)
                      </label>
                      <input
                        type="email"
                        value={directEmail}
                        onChange={(e) => setDirectEmail(e.target.value)}
                        className="w-full text-xs bg-white border border-brand-border rounded-lg px-2.5 py-1.5 text-brand-text font-mono"
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-brand-secondary block mb-1">
                        Your Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        value={directPhone}
                        onChange={(e) => setDirectPhone(e.target.value)}
                        className="w-full text-xs bg-white border border-brand-border rounded-lg px-2.5 py-1.5 text-brand-text font-mono"
                        placeholder="+1-555-..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="text-xs font-semibold text-white bg-brand-dark hover:bg-brand-dark/90 px-4 py-2 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send to Researchers</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Pending Inquiries Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dark">
                  Pending Inquiries ({pendingRequests.length})
                </h3>

                {pendingRequests.length === 0 ? (
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-6 text-center text-xs text-brand-secondary">
                    No pending inquiries from researchers. You will be notified here if an expert requests follow-up details on your observations.
                  </div>
                ) : (
                  pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="border border-brand-teal/40 bg-teal-50/20 rounded-lg p-4 space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-brand-teal bg-teal-100/60 px-2 py-0.5 rounded">
                            Case #{req.signal_case_id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="text-xs text-brand-text font-semibold">
                            {req.reason.replace(/_/g, " ")}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono">
                          From: {req.researcher_id || "Lead Researcher"}
                        </span>
                      </div>

                      <p className="text-xs text-brand-text bg-white p-3 rounded border border-brand-border/60">
                        "{req.message}"
                      </p>

                      {/* Action trigger or Form */}
                      {activeRespondingId === req.id ? (
                        <form
                          onSubmit={(e) => handleRespondSubmit(e, req.id)}
                          className="bg-white border border-brand-border rounded-lg p-3.5 space-y-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 font-semibold text-emerald-800 cursor-pointer">
                              <input
                                type="radio"
                                name="action"
                                checked={responseAction === "ACCEPT"}
                                onChange={() => setResponseAction("ACCEPT")}
                              />
                              Accept & Share Details
                            </label>
                            <label className="flex items-center gap-1.5 font-semibold text-gray-700 cursor-pointer">
                              <input
                                type="radio"
                                name="action"
                                checked={responseAction === "DECLINE"}
                                onChange={() => setResponseAction("DECLINE")}
                              />
                              Decline (Keep Anonymous)
                            </label>
                          </div>

                          {responseAction === "ACCEPT" && (
                            <div className="space-y-2 pt-2 border-t border-gray-100">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[11px] text-gray-600 block mb-1">
                                    Email (Optional)
                                  </label>
                                  <input
                                    type="email"
                                    value={sharedEmail}
                                    onChange={(e) => setSharedEmail(e.target.value)}
                                    placeholder="your.email@example.com"
                                    className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-gray-600 block mb-1">
                                    Phone (Optional)
                                  </label>
                                  <input
                                    type="tel"
                                    value={sharedPhone}
                                    onChange={(e) => setSharedPhone(e.target.value)}
                                    placeholder="+1-555-..."
                                    className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] text-gray-600 block mb-1">
                                  Preferred Contact Method
                                </label>
                                <select
                                  value={preferredMethod}
                                  onChange={(e) =>
                                    setPreferredMethod(
                                      e.target.value as PreferredContactMethod
                                    )
                                  }
                                  className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5"
                                >
                                  <option value="EMAIL">Email</option>
                                  <option value="PHONE">Phone / SMS</option>
                                  <option value="IN_APP">Platform / In-App Message</option>
                                </select>
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="text-[11px] text-gray-600 block mb-1">
                              Note to Researcher (Optional)
                            </label>
                            <input
                              type="text"
                              value={contributorNote}
                              onChange={(e) => setContributorNote(e.target.value)}
                              placeholder="e.g. Best times to call or additional context..."
                              className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5"
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setActiveRespondingId(null)}
                              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="text-xs font-semibold text-white bg-brand-teal hover:bg-brand-teal/90 px-4 py-1.5 rounded-lg shadow-xs"
                            >
                              {isSubmitting ? "Submitting..." : "Submit Response"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRespondingId(req.id);
                              setResponseAction("DECLINE");
                            }}
                            className="text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRespondingId(req.id);
                              setResponseAction("ACCEPT");
                            }}
                            className="text-xs font-semibold text-white bg-brand-teal hover:bg-brand-teal/90 px-4 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                          >
                            <span>Respond / Share Contact</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Resolved Inquiries History */}
              {resolvedRequests.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-brand-border">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-secondary">
                    Past Inquiries ({resolvedRequests.length})
                  </h3>

                  {resolvedRequests.map((req) => (
                    <div
                      key={req.id}
                      className="border border-gray-200 rounded-lg p-3 bg-gray-50/60 space-y-1.5 text-xs text-brand-secondary"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-semibold text-gray-700">
                          Case #{req.signal_case_id.slice(0, 8).toUpperCase()} · {req.reason.replace(/_/g, " ")}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            req.status === "ACCEPTED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-gray-100 text-gray-600 border border-gray-200"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 truncate">
                        "{req.message}"
                      </p>
                      {req.responded_at && (
                        <div className="text-[10px] text-gray-400">
                          Responded on {new Date(req.responded_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-brand-border px-6 py-3 bg-gray-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
