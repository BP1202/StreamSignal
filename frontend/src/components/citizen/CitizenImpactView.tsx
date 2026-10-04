import React, { useEffect, useState } from "react";
import {
  Award,
  CheckCircle2,
  Clock,
  Droplets,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  User,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { fetchContributorImpact } from "../../api/impact";
import { ContributorImpactResponse } from "../../types/impact";

interface CitizenImpactViewProps {
  contributorId?: string;
  onGoToMissions: () => void;
  onGoToObserve: () => void;
  onSelectCase?: (caseId: string) => void;
}

export const CitizenImpactView: React.FC<CitizenImpactViewProps> = ({
  contributorId,
  onGoToMissions,
  onGoToObserve,
  onSelectCase,
}) => {
  const [impactData, setImpactData] = useState<ContributorImpactResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const cid =
      contributorId ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("streamsignal_contributor_id") || undefined
        : undefined);

    fetchContributorImpact(cid)
      .then((data) => {
        if (isMounted) setImpactData(data);
      })
      .catch((err) => {
        if (isMounted) setError(err?.message || "Failed to load impact metrics.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [contributorId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-brand-secondary animate-pulse">
        Loading evidence...
      </div>
    );
  }

  if (error || !impactData) {
    return (
      <div className="p-8 text-center text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
        <div className="font-semibold text-sm">Evidence could not be loaded.</div>
        <p className="text-rose-500">{error || "Could not retrieve contributor impact profile."}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchContributorImpact(contributorId)
              .then((d) => setImpactData(d))
              .catch((err) => setError(err.message || "Failed to load impact metrics."))
              .finally(() => setLoading(false));
          }}
          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const {
    display_name,
    contributor_id,
    account_level,
    total_contributions,
    verified_contributions,
    overall_evidence_coverage,
    total_coverage_delta_contributed,
    recent_contributions,
    stewardship_milestones,
    epistemic_notice,
  } = impactData;

  const acceptedDelta =
    impactData.accepted_coverage_delta !== undefined
      ? impactData.accepted_coverage_delta
      : impactData.total_coverage_delta_contributed;
  const potentialDelta =
    impactData.potential_coverage_delta_submitted !== undefined
      ? impactData.potential_coverage_delta_submitted
      : impactData.total_coverage_delta_contributed;
  const pendingDelta = Math.max(potentialDelta - acceptedDelta, 0);

  const baselineBefore = Math.max(overall_evidence_coverage - acceptedDelta, 0);

  return (
    <div className="space-y-8 text-left max-w-4xl mx-auto py-4">
      {/* ── 1. Contributor Header ───────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-brand-border p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-brand-teal font-bold text-lg">
            <User className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-brand-text">{display_name}</h2>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {contributor_id}
              </span>
            </div>
            <p className="text-xs text-brand-secondary">
              {account_level.replace(/_/g, " ")} · Urban Freshwater Citizen Steward
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGoToObserve}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-teal hover:bg-cyan-600 text-white transition-colors shadow-xs"
          >
            + New Observation
          </button>
          <button
            type="button"
            onClick={onGoToMissions}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            Explore Missions
          </button>
        </div>
      </section>

      {/* ── 2. Impact Highlights Grid ───────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-brand-border shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-brand-secondary block">
            Completed Submissions
          </span>
          <span className="text-2xl font-extrabold text-brand-text font-mono">
            {total_contributions}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-brand-border shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-brand-secondary block">
            Researcher Verified
          </span>
          <span className="text-2xl font-extrabold text-emerald-600 font-mono">
            {verified_contributions}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-brand-border shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-brand-secondary block">
            Accepted Coverage Impact
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-emerald-600 font-mono">
              +{acceptedDelta.toFixed(2)}%
            </span>
          </div>
          {pendingDelta > 0 && (
            <span className="text-[10px] text-slate-500 font-mono block">
              (+{pendingDelta.toFixed(2)}% pending review)
            </span>
          )}
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-brand-border shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-brand-secondary block">
            Overall Catchment State
          </span>
          <span className="text-2xl font-extrabold text-slate-700 font-mono">
            {overall_evidence_coverage.toFixed(2)}%
          </span>
        </div>
      </section>

      {/* ── 3. Coverage Delta Banner ────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-brand-dark via-slate-900 to-cyan-950 rounded-2xl border border-cyan-800/80 p-4 sm:p-6 text-white space-y-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold">Your Evidence Coverage Delta</h3>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/20 px-2.5 py-1 rounded border border-cyan-500/30 self-start sm:self-auto">
            +{acceptedDelta.toFixed(2)} percentage points accepted
          </span>
        </div>

        {/* 3-Stage Evidence Lifecycle Separation */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs py-1 border-b border-cyan-800/60 pb-3">
          <span className="font-semibold text-cyan-200">Evidence Lifecycle:</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono">
            1. Submitted
          </span>
          <span className="text-cyan-500">→</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono">
            2. Reviewed
          </span>
          <span className="text-cyan-500">→</span>
          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[11px] font-mono font-semibold">
            3. Accepted for Research
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-center w-full sm:flex-1">
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
              Catchment Baseline
            </span>
            <span className="text-base font-extrabold font-mono text-slate-300">
              {baselineBefore.toFixed(2)}%
            </span>
          </div>

          <ArrowRight className="w-5 h-5 text-cyan-400 shrink-0 hidden sm:block" />
          <div className="sm:hidden text-cyan-400 font-bold text-sm">↓</div>

          <div className="p-3 rounded-lg bg-cyan-900/40 border border-cyan-700 text-center w-full sm:flex-1">
            <span className="text-[10px] text-cyan-300 block uppercase tracking-wider">
              With Your Observations
            </span>
            <span className="text-base font-extrabold font-mono text-cyan-200">
              {overall_evidence_coverage.toFixed(2)}%
            </span>
          </div>
        </div>

        {pendingDelta > 0 && (
          <div className="text-xs px-3 py-2 rounded-lg bg-cyan-950/70 border border-cyan-800 text-cyan-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Review Pending:</strong> You have submitted +{pendingDelta.toFixed(2)}% in potential evidence awaiting researcher review. Accepted coverage only increases after research verification.
            </span>
          </div>
        )}

        <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800 pt-3">
          {epistemic_notice}
        </p>
      </section>

      {/* ── 4. Stewardship Milestones ────────────────────────────────────── */}
      {stewardship_milestones.length > 0 && (
        <section className="bg-white rounded-2xl border border-brand-border p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-brand-text">Stewardship Milestones</h3>
          </div>
          <p className="text-xs text-brand-secondary">
            Earned through verifiable physical observations — rewarding consistency and quality.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {stewardship_milestones.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>{m}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── 5. Contribution Ledger ──────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-brand-border p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-brand-text">
          Contribution Ledger & Provenance
        </h3>
        <p className="text-xs text-brand-secondary">
          Track the status of your submitted evidence through the research review lifecycle. A raw submission represents submitted potential; accepted evidence closes verified research gaps.
        </p>

        {recent_contributions.length === 0 ? (
          <div className="p-8 text-center text-xs text-brand-secondary bg-gray-50 border border-dashed border-gray-200 rounded-xl space-y-2">
            <p className="font-semibold text-brand-text">No evidence has been recorded yet.</p>
            <p>You have not submitted any evidence missions yet.</p>
            <button
              type="button"
              onClick={onGoToMissions}
              className="text-brand-teal hover:underline font-semibold"
            >
              Browse available missions →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent_contributions.map((item) => {
              const dimsUpper = item.dimensions_provided.map((d) => d.toUpperCase()).join(", ") || "PHYSICAL EVIDENCE";
              const isAccepted = item.review_status === "ACCEPTED_FOR_RESEARCH";
              const isMoreEvidence = item.review_status === "MORE_EVIDENCE_REQUESTED";

              // Factual statement compliant with acceptance criteria
              const factualStatement = item.impact_statement || (
                isAccepted
                  ? `Your accepted evidence closed the ${dimsUpper} gap.`
                  : isMoreEvidence
                  ? `Researcher requested additional verification for ${dimsUpper}.`
                  : `Your evidence was submitted for ${dimsUpper}.`
              );

              return (
                <div key={item.submission_id} className="py-4 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-xs font-bold text-brand-text">{item.mission_title}</span>
                    <span className="text-[11px] text-brand-secondary font-mono">
                      {new Date(item.submitted_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Factual Statement Callout */}
                  <div
                    className={`text-xs p-2.5 rounded-lg border flex items-center gap-2 ${
                      isAccepted
                        ? "bg-emerald-50/70 border-emerald-200 text-emerald-900 font-medium"
                        : isMoreEvidence
                        ? "bg-amber-50/70 border-amber-200 text-amber-900 font-medium"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    {isAccepted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span>{factualStatement}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {item.dimensions_provided.map((d) => (
                      <span
                        key={d}
                        className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200"
                      >
                        {d.replace(/_/g, " ")}
                      </span>
                    ))}

                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        isAccepted
                          ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                          : "text-slate-700 bg-slate-100 border-slate-200"
                      }`}
                    >
                      {isAccepted
                        ? `+${item.coverage_delta_pct.toFixed(2)}% accepted coverage`
                        : `+${item.coverage_delta_pct.toFixed(2)}% potential (pending review)`}
                    </span>

                    {isAccepted ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Accepted for Research</span>
                      </span>
                    ) : isMoreEvidence ? (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                        More Evidence Requested
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Awaiting Research Review</span>
                      </span>
                    )}
                  </div>

                  {item.signal_case_id && (
                    <div className="pt-0.5 text-[11px] text-brand-secondary flex items-center gap-1">
                      <span>Linked to SignalCase:</span>
                      <button
                        type="button"
                        onClick={() => onSelectCase?.(item.signal_case_id!)}
                        className="font-mono text-brand-teal hover:underline inline-flex items-center gap-0.5"
                      >
                        <span>{item.signal_case_id}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
