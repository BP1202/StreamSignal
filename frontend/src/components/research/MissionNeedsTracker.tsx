import React, { useState, useEffect } from "react";
import {
  fetchMissionNeeds,
  transitionMissionNeedStatus,
} from "../../api/evidence_gap";
import { MissionNeed, MissionNeedStatus } from "../../types/evidence_gap";

interface MissionNeedsTrackerProps {
  refreshTrigger?: number;
  onStatusChanged?: () => void;
}

export const MissionNeedsTracker: React.FC<MissionNeedsTrackerProps> = ({
  refreshTrigger,
  onStatusChanged,
}) => {
  const [needs, setNeeds] = useState<MissionNeed[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadNeeds = async () => {
    setLoading(true);
    setError(null);
    try {
      const filter = statusFilter === "ALL" ? undefined : statusFilter;
      const res = await fetchMissionNeeds(filter);
      setNeeds(res.needs);
    } catch (err: any) {
      setError(err?.message || "Failed to load mission needs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNeeds();
  }, [statusFilter, refreshTrigger]);

  const handleTransition = async (needId: string, toStatus: MissionNeedStatus) => {
    setActionInProgress(needId);
    try {
      await transitionMissionNeedStatus(needId, toStatus);
      await loadNeeds();
      if (onStatusChanged) onStatusChanged();
    } catch (err: any) {
      alert(`Transition failed: ${err?.message || "Unknown error"}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const getStatusBadge = (status: MissionNeedStatus) => {
    const configs: Record<MissionNeedStatus, { bg: string; color: string; border: string }> = {
      IDENTIFIED: {
        bg: "rgba(148, 163, 184, 0.15)",
        color: "#94a3b8",
        border: "rgba(148, 163, 184, 0.3)",
      },
      REVIEWED: {
        bg: "rgba(56, 189, 248, 0.15)",
        color: "#38bdf8",
        border: "rgba(56, 189, 248, 0.3)",
      },
      APPROVED: {
        bg: "rgba(34, 197, 94, 0.15)",
        color: "#4ade80",
        border: "rgba(34, 197, 94, 0.3)",
      },
      MISSION_PLANNED: {
        bg: "rgba(168, 85, 247, 0.15)",
        color: "#c084fc",
        border: "rgba(168, 85, 247, 0.3)",
      },
      ACTIVE: {
        bg: "rgba(234, 179, 8, 0.15)",
        color: "#facc15",
        border: "rgba(234, 179, 8, 0.3)",
      },
      FULFILLED: {
        bg: "rgba(16, 185, 129, 0.2)",
        color: "#10b981",
        border: "rgba(16, 185, 129, 0.4)",
      },
      CLOSED: {
        bg: "rgba(100, 116, 139, 0.2)",
        color: "#64748b",
        border: "rgba(100, 116, 139, 0.3)",
      },
    };

    const cfg = configs[status] || configs.IDENTIFIED;
    return (
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          background: cfg.bg,
          color: cfg.color,
          border: `1px solid ${cfg.border}`,
          borderRadius: "4px",
          padding: "2px 8px",
        }}
      >
        {status}
      </span>
    );
  };

  return (
    <div
      style={{
        background: "#0d1527",
        border: "1px solid #1e293b",
        borderRadius: "12px",
        padding: "24px",
        color: "#e2e8f0",
        marginBottom: "24px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>📋</span>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#f8fafc" }}>
              Researcher Mission Needs
            </h3>
            <span
              style={{
                fontSize: "11px",
                background: "rgba(99, 102, 241, 0.15)",
                color: "#818cf8",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                borderRadius: "12px",
                padding: "2px 8px",
                fontWeight: 500,
              }}
            >
              Researcher-Controlled FSM
            </span>
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>
            Governs the lifecycle of evidence collection needs. Only APPROVED needs are exposed to the Evidence Mission Agent.
          </p>
        </div>

        <button
          onClick={loadNeeds}
          disabled={loading}
          style={{
            background: "#1e293b",
            color: "#94a3b8",
            border: "1px solid #334155",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {["ALL", "IDENTIFIED", "REVIEWED", "APPROVED", "MISSION_PLANNED", "ACTIVE", "CLOSED"].map(
          (st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? "#1e293b" : "transparent",
                color: statusFilter === st ? "#f8fafc" : "#64748b",
                border: `1px solid ${statusFilter === st ? "#38bdf8" : "#1e293b"}`,
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "11px",
                cursor: "pointer",
                fontWeight: statusFilter === st ? 600 : 400,
              }}
            >
              {st}
            </button>
          )
        )}
      </div>

      {/* Authority Boundary Banner */}
      <div
        style={{
          background: "rgba(34, 197, 94, 0.06)",
          border: "1px solid rgba(34, 197, 94, 0.2)",
          borderRadius: "8px",
          padding: "10px 14px",
          marginBottom: "16px",
          fontSize: "12px",
          color: "#86efac",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span>🛡️</span>
        <span>
          <strong>Agent Boundary:</strong> The Evidence Mission Agent can only read <code>APPROVED</code> needs. Researchers maintain exclusive authority over creating, reviewing, and approving needs.
        </span>
      </div>

      {/* Loading / Error / Empty States */}
      {loading && (
        <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: "13px" }}>
          Loading evidence...
        </div>
      )}

      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            color: "#fca5a5",
            padding: "16px",
            borderRadius: "8px",
            fontSize: "13px",
            marginBottom: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 600, color: "#f87171", marginBottom: "4px" }}>
            Evidence could not be loaded.
          </div>
          <div style={{ fontSize: "12px", color: "#fca5a5", marginBottom: "12px" }}>{error}</div>
          <button
            type="button"
            onClick={loadNeeds}
            style={{
              background: "#b91c1c",
              color: "#ffffff",
              border: "none",
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && needs.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "32px",
            background: "#080e1a",
            borderRadius: "8px",
            border: "1px dashed #334155",
            color: "#64748b",
            fontSize: "13px",
          }}
        >
          No evidence has been recorded yet.
        </div>
      )}

      {/* Needs Cards */}
      {!loading && needs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {needs.map((need: MissionNeed) => {
            const isBusy = actionInProgress === need.id;

            return (
              <div
                key={need.id}
                style={{
                  background: "#111c33",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "8px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px", color: "#f8fafc" }}>
                        {need.title}
                      </span>
                      {getStatusBadge(need.status)}
                      <span
                        style={{
                          fontSize: "11px",
                          fontFamily: "monospace",
                          color: "#38bdf8",
                          background: "rgba(56, 189, 248, 0.1)",
                          padding: "1px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        gap:{need.evidence_gap_dimension}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                      {need.description}
                    </p>
                  </div>

                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {new Date(need.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Substantive Rationale Display */}
                <div
                  style={{
                    background: "#080e1a",
                    borderLeft: "3px solid #6366f1",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    margin: "10px 0",
                    fontSize: "12px",
                    color: "#cbd5e1",
                  }}
                >
                  <strong style={{ color: "#a5b4fc" }}>Scientific Rationale: </strong>
                  {need.rationale}
                </div>

                {/* Footer with Metadata & Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "12px",
                    paddingTop: "8px",
                    borderTop: "1px solid #1e293b",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    Author: {need.created_by_researcher}
                    {need.approved_at && (
                      <span style={{ marginLeft: "12px", color: "#4ade80" }}>
                        ✓ Approved {new Date(need.approved_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Researcher FSM Actions */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    {need.status === "IDENTIFIED" && (
                      <>
                        <button
                          onClick={() => handleTransition(need.id, "REVIEWED")}
                          disabled={isBusy}
                          style={{
                            background: "#1e293b",
                            color: "#38bdf8",
                            border: "1px solid #38bdf8",
                            borderRadius: "4px",
                            padding: "4px 10px",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Mark Reviewed
                        </button>
                        <button
                          onClick={() => handleTransition(need.id, "CLOSED")}
                          disabled={isBusy}
                          style={{
                            background: "transparent",
                            color: "#ef4444",
                            border: "1px solid #ef4444",
                            borderRadius: "4px",
                            padding: "4px 8px",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Close
                        </button>
                      </>
                    )}

                    {need.status === "REVIEWED" && (
                      <>
                        <button
                          onClick={() => handleTransition(need.id, "APPROVED")}
                          disabled={isBusy}
                          style={{
                            background: "linear-gradient(135deg, #16a34a, #22c55e)",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "4px",
                            padding: "4px 12px",
                            fontSize: "11px",
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          ✓ Approve for Agent
                        </button>
                        <button
                          onClick={() => handleTransition(need.id, "CLOSED")}
                          disabled={isBusy}
                          style={{
                            background: "transparent",
                            color: "#ef4444",
                            border: "1px solid #ef4444",
                            borderRadius: "4px",
                            padding: "4px 8px",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Close
                        </button>
                      </>
                    )}

                    {need.status === "APPROVED" && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#4ade80",
                          background: "rgba(34, 197, 94, 0.1)",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "1px solid rgba(34, 197, 94, 0.3)",
                        }}
                      >
                        🤖 Ready for Agent Mission Planning
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
