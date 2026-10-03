import React, { useState } from "react";
import { ContributorProfile } from "../../types/mission";
import { upgradeContributorAccount } from "../../api/missions";

interface Props {
  profile: ContributorProfile | null;
  onProfileUpdated: (updated: ContributorProfile) => void;
}

export const ContributorIdentityBadge: React.FC<Props> = ({
  profile,
  onProfileUpdated,
}) => {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-400">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Connecting Contributor Identity...
      </div>
    );
  }

  const isLevel2 = profile.account_level === "LEVEL_2_REGISTERED";

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please provide an email and password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await upgradeContributorAccount(
        { email, password },
        profile.contributor_id
      );
      onProfileUpdated(res.contributor);
      setShowUpgradeModal(false);
      setEmail("");
      setPassword("");
    } catch (err: any) {
      setError(err?.message || "Failed to upgrade account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-1.5 pr-3 rounded-full bg-slate-800/90 border border-slate-700/80 shadow-inner">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600 to-emerald-500 text-white font-bold text-xs shadow-sm">
          {profile.display_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-200">
              {profile.display_name}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
              {profile.contributor_id}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            {isLevel2 ? (
              <span className="text-emerald-400 font-medium">✓ Level 2 Registered Contributor</span>
            ) : (
              <span>Level 1 Anonymous Contributor</span>
            )}
          </div>
        </div>

        {!isLevel2 && (
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="ml-2 text-[11px] px-2.5 py-1 rounded-md bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 transition-colors font-medium"
            title="Upgrade in-place to Level 2 without losing mission history"
          >
            Upgrade
          </button>
        )}
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-left">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Upgrade to Level 2 Contributor
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Preserve your pseudonymous handle{" "}
                  <strong className="text-cyan-400">{profile.display_name}</strong> and
                  retain all historical mission contributions.
                </p>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpgrade} className="mt-4 space-y-3.5">
              {error && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Public ID (Retained)
                </label>
                <input
                  type="text"
                  disabled
                  value={`${profile.contributor_id} (${profile.display_name})`}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 text-xs font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="scout@oneaquahealth.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white shadow-md disabled:opacity-50 transition-all"
                >
                  {loading ? "Upgrading..." : "Confirm Upgrade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
