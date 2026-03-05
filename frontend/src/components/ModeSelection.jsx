import { motion } from "framer-motion";

import { MODES, AVATARS, PADDLE_STYLES } from "../lib/constants";

export default function ModeSelection({ profile, onProfileChange, onSelectMode, onBack }) {
  return (
    <div className="relative min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-3xl uppercase tracking-[0.15em] text-white">Create Match</h2>
          <button type="button" onClick={onBack} className="neon-button rounded-lg px-4 py-2 text-sm font-semibold uppercase">
            Back
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr,1fr]">
          <div className="neon-panel rounded-2xl p-5">
            <h3 className="font-display text-xl uppercase tracking-wider text-arena-cyan">Choose Mode</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {MODES.map((mode) => (
                <motion.button
                  key={mode.key}
                  type="button"
                  whileHover={{ y: -4, scale: 1.01 }}
                  onClick={() => onSelectMode(mode.key)}
                  className="rounded-xl border border-cyan-300/30 bg-slate-900/70 px-4 py-5 text-left transition hover:border-arena-cyan/70"
                >
                  <div className="font-display text-2xl uppercase text-white">{mode.label}</div>
                  <div className="text-sm text-slate-300">{mode.description}</div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="neon-panel rounded-2xl p-5">
            <h3 className="font-display text-xl uppercase tracking-wider text-arena-cyan">Player Setup</h3>

            <label className="mt-4 block text-sm uppercase tracking-wider text-slate-300">Name</label>
            <input
              value={profile.name}
              onChange={(event) => onProfileChange({ ...profile, name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-cyan-300/25 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-cyan-300/70"
              maxLength={18}
            />

            <label className="mt-4 block text-sm uppercase tracking-wider text-slate-300">Winning Score</label>
            <input
              type="number"
              min={3}
              max={25}
              value={profile.winningScore}
              onChange={(event) =>
                onProfileChange({ ...profile, winningScore: Number(event.target.value || 10) })
              }
              className="mt-1 w-full rounded-lg border border-cyan-300/25 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-cyan-300/70"
            />

            <label className="mt-4 block text-sm uppercase tracking-wider text-slate-300">Avatar</label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  type="button"
                  onClick={() => onProfileChange({ ...profile, avatar })}
                  className={`rounded-lg border px-2 py-2 text-2xl ${
                    profile.avatar === avatar
                      ? "border-arena-cyan bg-cyan-500/10"
                      : "border-slate-700 bg-slate-900/70"
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>

            <label className="mt-4 block text-sm uppercase tracking-wider text-slate-300">Paddle Style</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {Object.keys(PADDLE_STYLES).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => onProfileChange({ ...profile, paddleStyle: style })}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    profile.paddleStyle === style
                      ? "border-arena-cyan bg-cyan-500/10"
                      : "border-slate-700 bg-slate-900/70"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs text-slate-400">Select a game mode to create the room instantly.</p>
          </div>
        </div>
      </div>
    </div>
  );
}