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
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-surface border border-brand-border text-xs text-brand-secondary">
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
      <div className="flex items-center gap-3 p-1.5 pr-3 rounded-full bg-brand-surface border border-brand-border shadow-xs">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-teal text-white font-bold text-xs shadow-sm">
          {profile.display_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-brand-text">
              {profile.display_name}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-light text-brand-dark font-mono">
              {profile.contributor_id}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-brand-secondary">
            {isLevel2 ? (
              <span className="text-brand-success font-medium">✓ Level 2 Registered Contributor</span>
            ) : (
              <span>Level 1 Anonymous Contributor</span>
            )}
          </div>
        </div>

        {!isLevel2 && (
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="ml-2 text-[11px] px-2.5 py-1 rounded-md bg-brand-light hover:bg-brand-light/80 text-brand-dark border border-brand-border transition-colors font-medium"
            title="Upgrade in-place to Level 2 without losing mission history"
          >
            Upgrade
          </button>
        )}
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-brand-surface border border-brand-border p-6 shadow-xl text-left">
            <div className="flex items-start justify-between pb-3 border-b border-brand-border">
              <div>
                <h3 className="text-base font-semibold text-brand-text">
                  Upgrade to Level 2 Contributor
                </h3>
                <p className="text-xs text-brand-secondary mt-0.5">
                  Preserve your pseudonymous handle{" "}
                  <strong className="text-brand-teal">{profile.display_name}</strong> and
                  retain all historical mission contributions.
                </p>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-brand-secondary hover:text-brand-text text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpgrade} className="mt-4 space-y-3.5">
              {error && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-brand-error text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-brand-text mb-1">
                  Public ID (Retained)
                </label>
                <input
                  type="text"
                  disabled
                  value={`${profile.contributor_id} (${profile.display_name})`}
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 border border-brand-border text-brand-secondary text-xs font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-text mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="scout@oneaquahealth.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-brand-border text-brand-text text-xs focus:outline-none focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-brand-text mb-1">
                  Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-brand-border text-brand-text text-xs focus:outline-none focus:border-brand-teal"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-brand-secondary hover:bg-brand-bg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-teal hover:bg-brand-dark text-white shadow-xs disabled:opacity-50 transition-all"
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
