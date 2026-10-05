import React, { useEffect, useState } from "react";
import {
  Droplets,
  ShieldCheck,
  Camera,
  Compass,
  ArrowRight,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { fetchEvidenceCoverage } from "../../api/impact";
import { fetchMissionRecommendations } from "../../api/missions";
import { EvidenceCoverageInfo } from "../../types/impact";
import { MissionItem } from "../../types/mission";

interface WaterSignalHomeProps {
  onStartWithPhoto: () => void;
  onStartWithoutPhoto: () => void;
  onGoToMissions: () => void;
  onGoToImpact: () => void;
}

export const WaterSignalHome: React.FC<WaterSignalHomeProps> = ({
  onStartWithPhoto,
  onStartWithoutPhoto,
  onGoToMissions,
  onGoToImpact,
}) => {
  const [coverageData, setCoverageData] = useState<EvidenceCoverageInfo | null>(null);
  const [recommendedMissions, setRecommendedMissions] = useState<MissionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    const contributorId = localStorage.getItem("streamsignal_contributor_id") || undefined;
    Promise.all([
      fetchEvidenceCoverage(),
      fetchMissionRecommendations(contributorId).catch(() => ({ recommendations: [], total: 0 })),
    ])
      .then(([covData, recData]) => {
        setCoverageData(covData);
        setRecommendedMissions(recData.recommendations || []);
      })
      .catch((err) => {
        console.warn("Could not load real-time evidence coverage:", err);
        setError(err?.message || "Failed to load evidence coverage.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalCases = coverageData?.total_cases_analyzed ?? 0;
  const coveragePct = coverageData?.overall_coverage_percentage ?? 0.0;
  const perDimDelta = coverageData?.potential_coverage_per_dimension ?? 0.0;

  // Tracked dimensions
  const gaps = coverageData?.gaps || [];
  const missingDims = gaps.filter((g) => g.cases_missing_evidence > 0);

  return (
    <div className="space-y-8 text-left w-full max-w-screen-2xl mx-auto py-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
          <div className="text-base font-semibold text-red-900">Evidence could not be loaded.</div>
          <p className="text-xs text-red-700 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="text-xs font-semibold text-white bg-red-700 hover:bg-red-800 px-4 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── 1. Hero Catchment Surveillance Banner ────────────────────────── */}
      <section className="bg-linear-to-br from-brand-dark via-slate-900 to-brand-dark rounded-3xl p-6 sm:p-10 text-white shadow-md relative overflow-hidden space-y-4">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold">
            <Droplets className="w-3.5 h-3.5" />
            <span>Real-time Urban Freshwater Surveillance</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            How much do we actually know about our urban water?
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Urban streams change rapidly after rainfall, construction, and seasonal shifts.
            StreamSignal turns community observations into structured, reviewable One Health evidence —
            closing information gaps before problems escalate.
          </p>
        </div>
      </section>

      {/* ── 2. Dynamic Evidence Coverage Meter ───────────────────────────── */}
      <section className="bg-white rounded-2xl border border-brand-border p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-teal" />
              <h2 className="text-lg font-bold text-brand-text">
                Catchment Evidence Coverage
              </h2>
            </div>
            <p className="text-xs text-brand-secondary">
              Proportion of required evidence dimensions currently satisfied across real SignalCases.
            </p>
          </div>

          <div className="text-right">
            <div className="text-3xl font-extrabold text-brand-teal font-mono">
              {loading ? "..." : `${coveragePct.toFixed(2)}%`}
            </div>
            <span className="text-[11px] font-medium text-brand-secondary">
              {totalCases} cases analyzed
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-brand-teal h-3 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(Math.max(coveragePct, 2), 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-brand-secondary font-mono">
            <span>0% Baseline</span>
            <span>{coveragePct.toFixed(1)}% Documented</span>
            <span>100% Comprehensive</span>
          </div>
        </div>

        {/* Epistemic Boundary Notice */}
        <div className="p-3.5 rounded-xl bg-cyan-50/60 border border-cyan-100 flex items-start gap-3 text-xs text-cyan-950">
          <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Evidence Coverage Notice:</strong> This metric represents the availability of
            factual physical observations (flow, clarity, media, odor) required for research triage.
            It is <strong>not a drinking-water safety or chemical toxicity assessment</strong>.
          </p>
        </div>

        {/* Missing Evidence Gaps Breakdown */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-secondary">
            What would improve this evidence?
          </h3>

          {totalCases === 0 ? (
            <div className="p-4 rounded-xl bg-brand-bg border border-brand-border text-xs text-brand-secondary">
              🌊 <strong>Catchment baseline open:</strong> No SignalCases have been recorded in this
              area yet. Recording the first observation establishes baseline spatial and visual context!
            </div>
          ) : missingDims.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>All standard evidence dimensions currently have baseline observations!</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {missingDims.slice(0, 4).map((gap) => (
                <div
                  key={gap.dimension}
                  className="p-3.5 rounded-xl border border-brand-border bg-gray-50 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-brand-text block">
                      {gap.dimension_label}
                    </span>
                    <span className="text-[11px] text-amber-700">
                      Missing in {gap.cases_missing_evidence} of {gap.total_cases_analyzed} cases
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-brand-teal bg-white px-2 py-1 rounded border border-gray-200">
                    +{perDimDelta.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 3. Actionable Evidence Opportunity Card ──────────────────────── */}
      {loading ? (
        <section className="bg-brand-surface rounded-2xl border border-dashed border-brand-border p-4 sm:p-6 text-brand-text shadow-xs space-y-2 text-center animate-pulse">
          <div className="text-sm font-semibold text-brand-text">Loading evidence...</div>
          <p className="text-xs text-brand-secondary">Checking targeted research mission availability...</p>
        </section>
      ) : recommendedMissions.length > 0 ? (
        <section className="bg-brand-surface rounded-2xl border border-brand-border p-4 sm:p-6 text-brand-text shadow-xs space-y-4">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-light text-brand-dark px-2.5 py-1 rounded-md border border-brand-border self-start xs:self-auto">
              Recommended Evidence Mission
            </span>
            <span className="text-xs text-brand-teal font-mono font-semibold">
              +{perDimDelta.toFixed(2)}% Potential Coverage
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-brand-text">
              {recommendedMissions[0].title}
            </h3>
            <p className="text-xs text-brand-secondary">
              {recommendedMissions[0].purpose}
            </p>
          </div>

          {/* Why this mission? */}
          <div className="p-3.5 rounded-xl bg-brand-bg border border-brand-border space-y-2 text-xs">
            <span className="font-semibold text-brand-teal block text-[11px] uppercase tracking-wider">
              Why this mission?
            </span>
            <ul className="text-brand-secondary space-y-1 text-xs">
              {(recommendedMissions[0].why_this_mission && recommendedMissions[0].why_this_mission.length > 0
                ? recommendedMissions[0].why_this_mission
                : [
                    `${(recommendedMissions[0].required_evidence[0] || "FLOW_CONDITION").toUpperCase()} is missing`,
                    "This research need is approved",
                    "Your selected area matches",
                    "You have not recently submitted this evidence",
                  ]
              ).map((reason, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-brand-success font-bold">✓</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border">
            <div className="flex items-center gap-2 text-xs text-brand-secondary">
              <Clock className="w-3.5 h-3.5" />
              <span>Takes ~2 min · Targeted citizen observation</span>
            </div>

            <button
              type="button"
              onClick={onGoToMissions}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-brand-teal hover:bg-cyan-500 text-white transition-colors shadow-sm"
            >
              <span>Participate in Mission</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      ) : (
        <section className="bg-brand-surface rounded-2xl border border-dashed border-brand-border p-4 sm:p-6 text-brand-text shadow-xs space-y-4">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-light text-brand-dark px-2.5 py-1 rounded-md border border-brand-border self-start xs:self-auto">
              Catchment Surveillance
            </span>
            <span className="text-xs text-brand-secondary font-mono font-semibold">
              {coveragePct.toFixed(1)}% Current Coverage
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-brand-text">
              No targeted missions are currently available.
            </h3>
            <p className="text-xs text-brand-secondary">
              Recommendations originate only from researcher-approved research needs that match active evidence gaps in your watershed. General observations are always welcome.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border">
            <div className="flex items-center gap-2 text-xs text-brand-secondary">
              <Clock className="w-3.5 h-3.5" />
              <span>Takes ~2 min · Rapid baseline observation</span>
            </div>

            <button
              type="button"
              onClick={onStartWithPhoto}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-brand-teal hover:bg-cyan-500 text-white transition-colors shadow-sm"
            >
              <span>Make an Observation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      )}

    </div>
  );
};
