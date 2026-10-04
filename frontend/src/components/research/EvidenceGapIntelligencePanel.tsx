import React, { useState, useEffect } from "react";
import {
  fetchEvidenceGaps,
  fetchDimensionGapDetail,
  createMissionNeed,
} from "../../api/evidence_gap";
import {
  EvidenceGapListResponse,
  EvidenceGapSummary,
  EvidenceGapDetail,
  MissionNeedCreateRequest,
} from "../../types/evidence_gap";

interface EvidenceGapIntelligencePanelProps {
  onNeedCreated?: () => void;
}

export const EvidenceGapIntelligencePanel: React.FC<EvidenceGapIntelligencePanelProps> = ({
  onNeedCreated,
}) => {
  const [data, setData] = useState<EvidenceGapListResponse | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<EvidenceGapDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [targetDimension, setTargetDimension] = useState<string>("flow_condition");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formRationale, setFormRationale] = useState<string>("");
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const loadGaps = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEvidenceGaps(1);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load evidence gap intelligence.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGaps();
  }, []);

  const handleInspectDimension = async (dim: string) => {
    setDetailLoading(true);
    try {
      const detail = await fetchDimensionGapDetail(dim);
      setSelectedDetail(detail);
    } catch (err: any) {
      console.error("Failed to load dimension detail", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenCreateModal = (dimension: string) => {
    setTargetDimension(dimension);
    setFormTitle(`Address ${dimension.replace(/_/g, " ")} evidence gap`);
    setFormDescription(
      `Targeted citizen evidence collection to fill missing ${dimension.replace(
        /_/g,
        " "
      )} observations across reported stream segments.`
    );
    setFormRationale("");
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleSubmitNeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const trimmedRationale = formRationale.trim();
    const placeholders = ["todo", "tbd", "n/a", "placeholder", "test", "na"];
    if (placeholders.includes(trimmedRationale.toLowerCase())) {
      setFormError("Substantive researcher rationale is required. Placeholders are rejected.");
      return;
    }

    if (trimmedRationale.length < 20) {
      setFormError("Rationale must be at least 20 characters explaining the scientific reason.");
      return;
    }

    setFormSubmitting(true);
    try {
      const payload: MissionNeedCreateRequest = {
        evidence_gap_dimension: targetDimension,
        title: formTitle,
        description: formDescription,
        rationale: trimmedRationale,
        required_evidence: [targetDimension],
        created_by_researcher: "RESEARCHER_WORKSPACE",
        source_case_ids: selectedDetail?.affected_case_ids || [],
      };

      await createMissionNeed(payload);
      setFormSuccess("Mission Need created at IDENTIFIED status. Awaiting review.");
      setTimeout(() => {
        setIsModalOpen(false);
        if (onNeedCreated) onNeedCreated();
      }, 1200);
    } catch (err: any) {
      setFormError(err?.message || "Failed to submit Mission Need.");
    } finally {
      setFormSubmitting(false);
    }
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
            <span style={{ fontSize: "20px" }}>🔬</span>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#f8fafc" }}>
              Evidence Gap Intelligence
            </h3>
            <span
              style={{
                fontSize: "11px",
                background: "rgba(56, 189, 248, 0.15)",
                color: "#38bdf8",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: "12px",
                padding: "2px 8px",
                fontWeight: 500,
              }}
            >
              PostgreSQL Factual Analysis
            </span>
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>
            Analyzes real persisted SignalCases to identify missing observation dimensions and turn them into researcher-approved Mission Needs.
          </p>
        </div>

        <button
          onClick={loadGaps}
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
          {loading ? "Analyzing..." : "↻ Refresh Intelligence"}
        </button>
      </div>

      {/* Epistemic Framing Banner */}
      <div
        style={{
          background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "20px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "18px" }}>⚖️</span>
        <div style={{ fontSize: "12px", color: "#fde68a", lineHeight: "1.4" }}>
          <strong>Epistemic Notice:</strong> Evidence gap statistics reflect citizen observation completeness only. A missing dimension indicates unrecorded data, <em>not</em> water contamination, toxicity, or environmental health risk.
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: "13px" }}>
          Loading evidence...
        </div>
      )}

      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            padding: "16px",
            borderRadius: "8px",
            color: "#fca5a5",
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
            onClick={loadGaps}
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

      {/* Data Visualization Grid */}
      {!loading && data && (
        <div>
          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
              marginBottom: "12px",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Analyzed {data.total_cases_analyzed} active SignalCases</span>
            <span>Last computed: {new Date(data.analysis_timestamp).toLocaleTimeString()}</span>
          </div>

          {data.gaps.length === 0 ? (
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
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              {data.gaps.map((gap: EvidenceGapSummary) => {
                const ratioPct = Math.round(gap.availability_ratio * 100);
                const isSignificantGap = gap.cases_missing_evidence > 0;

                return (
                  <div
                    key={gap.dimension}
                    style={{
                      background: "#111c33",
                      border: "1px solid #1e293b",
                      borderRadius: "8px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "14px",
                            color: "#f1f5f9",
                          }}
                        >
                          {gap.dimension_label}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background:
                              ratioPct >= 80
                                ? "rgba(34, 197, 94, 0.15)"
                                : ratioPct >= 50
                                ? "rgba(234, 179, 8, 0.15)"
                                : "rgba(239, 68, 68, 0.15)",
                            color:
                              ratioPct >= 80
                                ? "#4ade80"
                                : ratioPct >= 50
                                ? "#facc15"
                                : "#f87171",
                          }}
                        >
                          {ratioPct}% present
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div
                        style={{
                          background: "#1e293b",
                          height: "6px",
                          borderRadius: "3px",
                          overflow: "hidden",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: `${ratioPct}%`,
                            height: "100%",
                            background:
                              ratioPct >= 80
                                ? "#22c55e"
                                : ratioPct >= 50
                                ? "#eab308"
                                : "#ef4444",
                            borderRadius: "3px",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "11px",
                          color: "#94a3b8",
                          marginBottom: "12px",
                        }}
                      >
                        <span>✓ {gap.cases_with_evidence} documented</span>
                        <span>✗ {gap.cases_missing_evidence} missing</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <button
                        onClick={() => handleInspectDimension(gap.dimension)}
                        style={{
                          flex: 1,
                          background: "#1e293b",
                          color: "#cbd5e1",
                          border: "1px solid #334155",
                          borderRadius: "6px",
                          padding: "6px 8px",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        Inspect Detail
                      </button>

                      {isSignificantGap && (
                        <button
                          onClick={() => handleOpenCreateModal(gap.dimension)}
                          style={{
                            background: "linear-gradient(135deg, #0284c7, #2563eb)",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "11px",
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          + Mission Need
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Dimension Detail Drawer */}
      {selectedDetail && (
        <div
          style={{
            marginTop: "20px",
            background: "#080e1a",
            border: "1px solid #1e293b",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🔍</span>
              <strong style={{ fontSize: "14px", color: "#f8fafc" }}>
                Dimension Detail: {selectedDetail.dimension_label}
              </strong>
            </div>
            <button
              onClick={() => setSelectedDetail(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              ✕
            </button>
          </div>

          <p
            style={{
              fontSize: "12px",
              color: "#cbd5e1",
              background: "#111c33",
              padding: "10px 12px",
              borderRadius: "6px",
              borderLeft: "3px solid #38bdf8",
              margin: "0 0 12px 0",
              lineHeight: "1.4",
            }}
          >
            {selectedDetail.epistemic_statement}
          </p>

          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
            <strong>Affected SignalCase IDs ({selectedDetail.affected_case_ids.length}):</strong>
            {selectedDetail.affected_case_ids.length === 0 ? (
              <span style={{ marginLeft: "6px", color: "#64748b" }}>None missing</span>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "6px",
                  maxHeight: "80px",
                  overflowY: "auto",
                }}
              >
                {selectedDetail.affected_case_ids.map((id) => (
                  <span
                    key={id}
                    style={{
                      fontFamily: "monospace",
                      fontSize: "10px",
                      background: "#1e293b",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      color: "#94a3b8",
                    }}
                  >
                    {id.slice(0, 8)}…
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Mission Need Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "12px",
              width: "520px",
              maxWidth: "90vw",
              padding: "24px",
              color: "#f8fafc",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                Create Researcher Mission Need
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 16px 0" }}>
              Authorizes targeted citizen evidence collection for dimension{" "}
              <strong style={{ color: "#38bdf8" }}>{targetDimension}</strong>. The Evidence Mission Agent will only consume this need once approved.
            </p>

            <form onSubmit={handleSubmitNeed}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "#cbd5e1", marginBottom: "4px" }}>
                  Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    color: "#f8fafc",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "#cbd5e1", marginBottom: "4px" }}>
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  required
                  rows={2}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    color: "#f8fafc",
                    fontSize: "12px",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <label style={{ fontSize: "11px", color: "#cbd5e1" }}>
                    Substantive Scientific Rationale <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>
                    Min 20 characters (placeholders rejected)
                  </span>
                </div>
                <textarea
                  value={formRationale}
                  onChange={(e) => setFormRationale(e.target.value)}
                  placeholder="Explain why filling this evidence gap is scientifically necessary (e.g., flow condition observations are required to distinguish natural runoff turbidity from industrial discharge)..."
                  required
                  rows={3}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    color: "#f8fafc",
                    fontSize: "12px",
                    resize: "vertical",
                  }}
                />
              </div>

              {formError && (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    color: "#fca5a5",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    marginBottom: "12px",
                  }}
                >
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.15)",
                    border: "1px solid #22c55e",
                    color: "#86efac",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    marginBottom: "12px",
                  }}
                >
                  {formSuccess}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                  style={{
                    background: "#1e293b",
                    color: "#cbd5e1",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    padding: "8px 14px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  style={{
                    background: "linear-gradient(135deg, #0284c7, #2563eb)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: formSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {formSubmitting ? "Creating..." : "Create Need (IDENTIFIED)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
