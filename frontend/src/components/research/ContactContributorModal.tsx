import React, { useState, useEffect } from "react";
import {
  ContactRequestItem,
  ContactReason,
  ContactRequestCreatePayload,
} from "../../types/contact";
import {
  fetchCaseContactRequests,
  createResearcherContactRequest,
} from "../../api/contact";
import { ApiError } from "../../api/client";
import {
  X,
  Send,
  MessageSquare,
  Shield,
  CheckCircle2,
  Clock,
  XCircle,
  Mail,
  Phone,
  User,
  Info,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface ContactContributorModalProps {
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
  onContactUpdated?: () => void;
}

export const ContactContributorModal: React.FC<ContactContributorModalProps> = ({
  caseId,
  isOpen,
  onClose,
  onContactUpdated,
}) => {
  const [requests, setRequests] = useState<ContactRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [reason, setReason] = useState<ContactReason>("CLARIFICATION");
  const [message, setMessage] = useState<string>("");
  const [reviewerId, setReviewerId] = useState<string>(
    "Dr-Sarah-Chen-Lead-Limnologist"
  );
  const [showNewForm, setShowNewForm] = useState<boolean>(false);

  const loadRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCaseContactRequests(caseId);
      setRequests(data);
      if (data.length === 0) {
        setShowNewForm(true);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load contact requests.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRequests();
    }
  }, [isOpen, caseId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || message.trim().length < 5) {
      setError("Please provide a message explaining what clarification is needed (min 5 chars).");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: ContactRequestCreatePayload = {
        reason,
        message: message.trim(),
      };
      await createResearcherContactRequest(caseId, payload, reviewerId);
      setMessage("");
      setShowNewForm(false);
      await loadRequests();
      if (onContactUpdated) onContactUpdated();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to create contact request.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl border border-brand-border shadow-xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-border px-4 sm:px-6 py-3.5 sm:py-4 bg-brand-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-light flex items-center justify-center text-brand-teal shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-brand-text">
                Contact Contributor
              </h2>
              <p className="text-[11px] sm:text-xs text-brand-secondary">
                SignalCase #{caseId.slice(0, 8).toUpperCase()} · Safe follow-up & clarification
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

        {/* Content Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          {/* Privacy & Epistemic Boundary Notice */}
          <div className="bg-brand-light/40 border border-brand-border rounded-lg p-3.5 flex items-start gap-3 text-xs text-brand-text">
            <Shield className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-brand-dark block">
                Consent-First Epistemic Boundary
              </span>
              Contact sharing is voluntary. The contributor will choose whether to accept and which contact channels to share. Personal contact details are never exposed to public evidence views, downloads, or FHIR exports.
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-brand-teal animate-spin mx-auto" />
              <p className="text-xs text-brand-secondary">Loading contact requests...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Existing Contact Requests List */}
              {requests.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dark">
                      Contact History ({requests.length})
                    </h3>
                    {!showNewForm && (
                      <button
                        type="button"
                        onClick={() => setShowNewForm(true)}
                        className="text-xs font-semibold text-brand-teal hover:underline"
                      >
                        + Send Another Request
                      </button>
                    )}
                  </div>

                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="border border-brand-border rounded-lg p-4 bg-white space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-brand-dark bg-gray-100 px-2 py-0.5 rounded">
                            {req.reason.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            By {req.initiated_by === "RESEARCHER" ? req.researcher_id || "Researcher" : "Citizen"}
                          </span>
                        </div>

                        {req.status === "ACCEPTED" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Accepted
                          </span>
                        ) : req.status === "DECLINED" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full border border-gray-200">
                            <XCircle className="w-3 h-3 text-gray-500" />
                            Declined
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                            Awaiting Response
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-brand-text bg-gray-50/70 p-2.5 rounded border border-gray-100">
                        {req.message}
                      </p>

                      {/* Display Shared Contact Info when Accepted */}
                      {req.status === "ACCEPTED" && (
                        <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 space-y-2 text-xs">
                          <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Contributor: {req.contributor_handle || "Citizen Contributor"}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-emerald-800">
                            {req.shared_email ? (
                              <div className="flex items-center gap-1.5 font-mono">
                                <Mail className="w-3.5 h-3.5 text-emerald-700" />
                                <span>{req.shared_email}</span>
                              </div>
                            ) : (
                              <div className="text-gray-400 italic">No email provided</div>
                            )}
                            {req.shared_phone ? (
                              <div className="flex items-center gap-1.5 font-mono">
                                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                                <span>{req.shared_phone}</span>
                              </div>
                            ) : (
                              <div className="text-gray-400 italic">No phone provided</div>
                            )}
                          </div>
                          {req.preferred_method && (
                            <div className="text-[11px] text-emerald-700 pt-1">
                              Preferred Method: <strong className="font-semibold">{req.preferred_method}</strong>
                            </div>
                          )}
                          {req.contributor_note && (
                            <div className="text-[11px] text-emerald-900 bg-white/70 p-2 rounded border border-emerald-200/60 mt-1">
                              <em>Contributor note:</em> "{req.contributor_note}"
                            </div>
                          )}
                        </div>
                      )}

                      {req.status === "DECLINED" && (
                        <div className="text-[11px] text-gray-500 italic bg-gray-50 p-2 rounded">
                          Contributor elected to keep this observation anonymous. Case analysis continues using submitted photographic & observational evidence.
                        </div>
                      )}

                      <div className="text-[10px] text-gray-400 flex items-center justify-between">
                        <span>Created: {new Date(req.created_at).toLocaleString()}</span>
                        {req.responded_at && (
                          <span>Responded: {new Date(req.responded_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Form to Send New Contact Request */}
              {showNewForm && (
                <form
                  onSubmit={handleSubmit}
                  className="border border-brand-border rounded-lg p-4 bg-brand-surface space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-dark flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-brand-teal" />
                      New Contact Request
                    </h3>
                    {requests.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowNewForm(false)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-brand-secondary block mb-1">
                        Reason for Contact
                      </label>
                      <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value as ContactReason)}
                        className="w-full text-xs bg-white border border-brand-border rounded-lg px-2.5 py-2 text-brand-text focus:outline-hidden focus:ring-1 focus:ring-brand-teal"
                      >
                        <option value="CLARIFICATION">Clarification on Observation</option>
                        <option value="ADDITIONAL_EVIDENCE">Request Additional Evidence</option>
                        <option value="FIELD_VERIFICATION">Field Verification Coordination</option>
                        <option value="GENERAL_INQUIRY">General Inquiry</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-brand-secondary block mb-1">
                        Researcher Identity
                      </label>
                      <input
                        type="text"
                        value={reviewerId}
                        onChange={(e) => setReviewerId(e.target.value)}
                        className="w-full text-xs bg-white border border-brand-border rounded-lg px-2.5 py-2 text-brand-text font-mono focus:outline-hidden focus:ring-1 focus:ring-brand-teal"
                        placeholder="e.g. Dr-Sarah-Chen"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-brand-secondary block mb-1">
                      Message to Contributor
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      className="w-full text-xs bg-white border border-brand-border rounded-lg p-2.5 text-brand-text placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-brand-teal"
                      placeholder="Explain specifically what clarification or additional evidence is requested..."
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    {requests.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowNewForm(false)}
                        className="text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="text-xs font-semibold text-white bg-brand-dark hover:bg-brand-dark/90 px-4 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Send Request</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-brand-border px-4 sm:px-6 py-3 bg-gray-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
