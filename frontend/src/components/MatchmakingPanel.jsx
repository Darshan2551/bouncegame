import { MODES } from "../lib/constants";

export default function MatchmakingPanel({
  profile,
  onProfileChange,
  queueMode,
  onModeChange,
  fallbackToAI,
  onFallbackChange,
  status,
  onFindMatch,
  onCancel,
  onBack,
}) {
  const searching = status?.status === "searching";

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="neon-panel w-full max-w-2xl rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl uppercase tracking-[0.16em] text-white">Play Online</h2>
          <button type="button" onClick={onBack} className="neon-button rounded-lg px-3 py-1 text-xs uppercase">
            Back
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs uppercase tracking-[0.16em] text-slate-300">Mode</label>
            <div className="mt-2 grid gap-2">
              {MODES.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => onModeChange(mode.key)}
                  className={`rounded-lg border px-3 py-2 text-left ${
                    queueMode === mode.key ? "border-arena-cyan bg-cyan-500/10" : "border-slate-700 bg-slate-900/70"
                  }`}
                >
                  <div className="font-semibold text-white">{mode.label}</div>
                  <div className="text-xs text-slate-300">{mode.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.16em] text-slate-300">Name</label>
            <input
              value={profile.name}
              onChange={(event) => onProfileChange({ ...profile, name: event.target.value })}
              className="mt-2 w-full rounded-lg border border-cyan-300/25 bg-slate-950/75 px-3 py-2 text-white outline-none focus:border-cyan-300/70"
              maxLength={18}
            />

            <label className="mt-4 flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={fallbackToAI}
                onChange={(event) => onFallbackChange(event.target.checked)}
                className="h-4 w-4 accent-cyan-300"
              />
              Auto fallback to AI if queue is empty
            </label>

            <div className="mt-4 rounded-lg border border-cyan-300/25 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
              {status?.status === "searching" && "Finding opponents..."}
              {status?.status === "match_found" && "Match found! Loading arena..."}
              {status?.status === "fallback_ai" && "No players found. Starting AI match..."}
              {status?.status === "canceled" && "Matchmaking canceled."}
              {!status?.status && "Click Find Match to enter global queue."}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onFindMatch}
            disabled={searching}
            className="neon-button rounded-lg px-4 py-3 text-sm font-semibold uppercase disabled:opacity-50"
          >
            {searching ? "Searching..." : "Find Match"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={!searching}
            className="ember-button rounded-lg px-4 py-3 text-sm font-semibold uppercase disabled:opacity-50"
          >
            Cancel Queue
          </button>
        </div>
      </div>
    </div>
  );
}