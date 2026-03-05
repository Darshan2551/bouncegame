import { AI_LEVELS } from "../lib/constants";

export default function AISetupPanel({ profile, onProfileChange, aiLevel, onLevelChange, onStart, onBack }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="neon-panel w-full max-w-2xl rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl uppercase tracking-[0.16em] text-white">Play vs AI</h2>
          <button type="button" onClick={onBack} className="neon-button rounded-lg px-3 py-1 text-xs uppercase">
            Back
          </button>
        </div>

        <label className="mt-5 block text-xs uppercase tracking-[0.16em] text-slate-300">Name</label>
        <input
          value={profile.name}
          onChange={(event) => onProfileChange({ ...profile, name: event.target.value })}
          className="mt-2 w-full rounded-lg border border-cyan-300/25 bg-slate-950/75 px-3 py-2 text-white outline-none focus:border-cyan-300/70"
          maxLength={18}
        />

        <label className="mt-4 block text-xs uppercase tracking-[0.16em] text-slate-300">Winning Score</label>
        <input
          type="number"
          min={3}
          max={25}
          value={profile.winningScore}
          onChange={(event) => onProfileChange({ ...profile, winningScore: Number(event.target.value || 10) })}
          className="mt-2 w-full rounded-lg border border-cyan-300/25 bg-slate-950/75 px-3 py-2 text-white outline-none focus:border-cyan-300/70"
        />

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {AI_LEVELS.map((level) => (
            <button
              key={level.key}
              type="button"
              onClick={() => onLevelChange(level.key)}
              className={`rounded-lg border px-3 py-3 text-left ${
                aiLevel === level.key ? "border-arena-cyan bg-cyan-500/10" : "border-slate-700 bg-slate-900/70"
              }`}
            >
              <div className="font-semibold text-white">{level.label}</div>
              <div className="text-xs text-slate-300">{level.description}</div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onStart}
          className="neon-button mt-5 w-full rounded-lg px-4 py-3 text-base font-semibold uppercase"
        >
          Start AI Match
        </button>
      </div>
    </div>
  );
}