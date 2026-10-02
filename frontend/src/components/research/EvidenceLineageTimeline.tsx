import React, { useState, useEffect } from "react";
import { EvidenceLineageEventItem } from "../../types/research";
import { fetchCaseLineage } from "../../api/research";
import {
  History,
  User,
  Cpu,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileCheck2,
} from "lucide-react";

interface EvidenceLineageTimelineProps {
  caseId: string;
  refreshTrigger?: number;
}

export const EvidenceLineageTimeline: React.FC<EvidenceLineageTimelineProps> = ({
  caseId,
  refreshTrigger = 0,
}) => {
  const [events, setEvents] = useState<EvidenceLineageEventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const loadLineage = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchCaseLineage(caseId);
      setEvents(res.events);
    } catch {
      setError("Unable to load evidence lineage audit trail.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLineage();
  }, [caseId, refreshTrigger]);

  const toggleEvent = (id: string) => {
    setExpandedEventId((prev) => (prev === id ? null : id));
  };

  const getActorBadge = (actorType: string, actorId: string) => {
    switch (actorType) {
      case "RESEARCHER":
        return {
          icon: <User className="w-3.5 h-3.5" />,
          label: `Researcher: ${actorId}`,
          bg: "bg-teal-50",
          text: "text-brand-teal",
          border: "border-teal-200",
        };
      case "CITIZEN":
        return {
          icon: <User className="w-3.5 h-3.5" />,
          label: `Citizen: ${actorId}`,
          bg: "bg-blue-50",
          text: "text-blue-700",
          border: "border-blue-200",
        };
      case "FIELD_VERIFIER":
        return {
          icon: <Shield className="w-3.5 h-3.5" />,
          label: `Field Verifier: ${actorId}`,
          bg: "bg-amber-50",
          text: "text-amber-700",
          border: "border-amber-200",
        };
      default:
        return {
          icon: <Cpu className="w-3.5 h-3.5" />,
          label: `System: ${actorId}`,
          bg: "bg-gray-100",
          text: "text-gray-700",
          border: "border-gray-200",
        };
    }
  };

  return (
    <div id="evidence-lineage-section" className="bg-white rounded-xl border border-brand-border p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-brand-border pb-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-brand-teal" />
          <div>
            <h3 className="text-sm font-bold text-brand-text">
              EVIDENCE LINEAGE AUDIT TRAIL
            </h3>
            <span className="text-[11px] text-brand-secondary">
              Immutable provenance record of review decisions and state transformations
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={loadLineage}
          className="text-[11px] font-semibold text-gray-500 hover:text-brand-dark flex items-center gap-1 p-1"
          title="Refresh lineage"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-gray-500 space-y-2">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-teal" />
          <p>Loading lineage audit records...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-xs">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="p-6 text-center bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 space-y-1">
          <FileCheck2 className="w-6 h-6 mx-auto text-gray-400" />
          <p className="font-semibold text-gray-600">
            No immutable review lineage events recorded yet for this SignalCase.
          </p>
          <p className="text-[11px]">
            Lineage events are appended automatically and permanently when a researcher records a review decision.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-brand-border">
          {events.map((ev) => {
            const badge = getActorBadge(ev.actor_type, ev.actor_id);
            const isExpanded = expandedEventId === ev.id;
            const formattedTime = new Date(ev.created_at).toLocaleString();

            return (
              <div key={ev.id} className="relative text-xs">
                {/* Timeline node */}
                <div className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-brand-teal ring-4 ring-white" />

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-sm border ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded-sm">
                        {ev.event_type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{formattedTime}</span>
                    </div>
                  </div>

                  <p className="text-brand-text font-medium text-xs">
                    {ev.summary}
                  </p>

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-gray-400">
                      source: {ev.source_service}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleEvent(ev.id)}
                      className="text-[11px] text-brand-teal font-semibold flex items-center gap-0.5 hover:underline"
                    >
                      <span>{isExpanded ? "Hide Payload" : "View Structured Payload"}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 bg-white border border-gray-200 rounded p-2.5 font-mono text-[11px] text-gray-700 overflow-x-auto">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(ev.structured_payload_json, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
