import { PADDLE_STYLES, AVATARS } from "../lib/constants";

export default function JoinPanel({ profile, onProfileChange, roomCode, onRoomCodeChange, onJoin, onBack }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="neon-panel w-full max-w-xl rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl uppercase tracking-[0.16em] text-white">Join Game</h2>
          <button type="button" onClick={onBack} className="neon-button rounded-lg px-3 py-1.5 text-xs uppercase">
            Back
          </button>
        </div>

        <label className="mt-5 block text-sm uppercase tracking-[0.16em] text-slate-300">Game Code</label>
        <input
          value={roomCode}
          onChange={(event) => onRoomCodeChange(event.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
          className="mt-2 w-full rounded-lg border border-cyan-300/25 bg-slate-950/75 px-3 py-2 text-lg uppercase tracking-[0.3em] text-white outline-none focus:border-cyan-300/70"
        />

        <label className="mt-4 block text-sm uppercase tracking-[0.16em] text-slate-300">Name</label>
        <input
          value={profile.name}
          onChange={(event) => onProfileChange({ ...profile, name: event.target.value })}
          maxLength={18}
          className="mt-2 w-full rounded-lg border border-cyan-300/25 bg-slate-950/75 px-3 py-2 text-white outline-none focus:border-cyan-300/70"
        />

        <label className="mt-4 block text-sm uppercase tracking-[0.16em] text-slate-300">Avatar</label>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {AVATARS.map((avatar) => (
            <button
              key={avatar}
              type="button"
              onClick={() => onProfileChange({ ...profile, avatar })}
              className={`rounded-lg border px-2 py-2 text-2xl ${
                profile.avatar === avatar ? "border-arena-cyan bg-cyan-500/10" : "border-slate-700 bg-slate-900/70"
              }`}
            >
              {avatar}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm uppercase tracking-[0.16em] text-slate-300">Paddle Style</label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {Object.keys(PADDLE_STYLES).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onProfileChange({ ...profile, paddleStyle: style })}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                profile.paddleStyle === style ? "border-arena-cyan bg-cyan-500/10" : "border-slate-700 bg-slate-900/70"
              }`}
            >
              {style}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onJoin(false)}
            className="neon-button rounded-lg px-4 py-3 text-base font-semibold uppercase tracking-wide"
          >
            Join as Player
          </button>
          <button
            type="button"
            onClick={() => onJoin(true)}
            className="ember-button rounded-lg px-4 py-3 text-base font-semibold uppercase tracking-wide"
          >
            Spectate
          </button>
        </div>
      </div>
    </div>
  );
}