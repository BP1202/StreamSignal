import React, { useEffect, useState } from "react";
import {
  Droplets,
  ShieldCheck,
  Camera,
  Compass,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
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
    <div className="space-y-10 text-left max-w-4xl mx-auto py-4">
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
      {/* ── 1. Hero: Purpose Before Functionality ──────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark via-slate-900 to-brand-surface border border-brand-border p-6 sm:p-10 shadow-lg text-white">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold">
            <Droplets className="w-3.5 h-3.5 text-cyan-400" />
            <span>WaterSignal · Urban Freshwater Evidence</span>
          </div>

          <div className="text-xs sm:text-sm font-semibold text-cyan-200">
            Notice something unusual in a stream?
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            How much do we actually know about our urban water?
          </h1>


          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Urban streams change rapidly after rainfall, construction, and seasonal shifts.
            StreamSignal turns community observations into structured, reviewable One Health evidence
            — closing information gaps before problems escalate.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStartWithPhoto}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-brand-teal hover:bg-cyan-600 text-white shadow-md transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>Capture what you see</span>
            </button>
            <button
              type="button"
              onClick={onGoToMissions}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Missions</span>
            </button>
            <button
              type="button"
              onClick={onStartWithoutPhoto}
              className="text-xs text-slate-400 hover:text-white underline underline-offset-4 px-2 py-2"
            >
              Or start without a photo →
            </button>
          </div>
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
            <span className="text-[11px] font-medium text-slate-400">
              {totalCases} cases analyzed
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-brand-teal to-cyan-500 h-3 rounded-full transition-all duration-700"
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
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
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
        <section className="bg-slate-900/80 rounded-2xl border border-dashed border-slate-800 p-6 text-white shadow-sm space-y-2 text-center animate-pulse">
          <div className="text-sm font-semibold text-slate-200">Loading evidence...</div>
          <p className="text-xs text-slate-400">Checking targeted research mission availability...</p>
        </section>
      ) : recommendedMissions.length > 0 ? (
        <section className="bg-gradient-to-r from-cyan-950 via-slate-900 to-slate-900 rounded-2xl border border-cyan-800/80 p-6 text-white shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-md border border-cyan-500/30">
              Recommended Evidence Mission
            </span>
            <span className="text-xs text-cyan-300 font-mono font-semibold">
              +{perDimDelta.toFixed(2)}% Potential Coverage
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-white">
              {recommendedMissions[0].title}
            </h3>
            <p className="text-xs text-slate-300">
              {recommendedMissions[0].purpose}
            </p>
          </div>

          {/* Why this mission? */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2 text-xs">
            <span className="font-semibold text-cyan-300 block text-[11px] uppercase tracking-wider">
              Why this mission?
            </span>
            <ul className="text-slate-300 space-y-1 text-xs">
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
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400">
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
        <section className="bg-slate-900/80 rounded-2xl border border-dashed border-slate-800 p-6 text-white shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 px-2.5 py-1 rounded-md border border-slate-700">
              Catchment Surveillance
            </span>
            <span className="text-xs text-slate-400 font-mono font-semibold">
              {coveragePct.toFixed(1)}% Current Coverage
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-200">
              No targeted missions are currently available.
            </h3>
            <p className="text-xs text-slate-400">
              Recommendations originate only from researcher-approved research needs that match active evidence gaps in your watershed. General observations are always welcome.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80">
            <div className="flex items-center gap-2 text-xs text-slate-500">
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

      {/* ── 4. Flexible Participation Levels ─────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-brand-text">
          Choose How You Would Like to Contribute
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={onStartWithPhoto}
            className="p-4 rounded-xl border border-brand-border bg-white hover:border-brand-teal cursor-pointer transition-all shadow-xs space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              2m
            </div>
            <h4 className="text-xs font-bold text-brand-text">Quick Observation</h4>
            <p className="text-[11px] text-brand-secondary">
              Snap a photo and record water appearance in under 2 minutes.
            </p>
          </div>

          <div
            onClick={onStartWithoutPhoto}
            className="p-4 rounded-xl border border-brand-border bg-white hover:border-brand-teal cursor-pointer transition-all shadow-xs space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold text-sm">
              5m
            </div>
            <h4 className="text-xs font-bold text-brand-text">Structured Field Signals</h4>
            <p className="text-[11px] text-brand-secondary">
              Document flow, odor, and visible foam to corroborate historical cases.
            </p>
          </div>

          <div
            onClick={onGoToMissions}
            className="p-4 rounded-xl border border-brand-border bg-white hover:border-brand-teal cursor-pointer transition-all shadow-xs space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
              🎯
            </div>
            <h4 className="text-xs font-bold text-brand-text">Research Mission</h4>
            <p className="text-[11px] text-brand-secondary">
              Fulfill targeted evidence gaps approved by One Health researchers.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
