import { motion } from "framer-motion";

import { PADDLE_STYLES } from "../lib/constants";

function SlotCard({ player, index }) {
  if (!player) {
    return (
      <div className="rounded-xl border border-dashed border-slate-600/70 bg-slate-950/40 px-3 py-3 text-sm text-slate-400">
        Slot {index + 1} - Waiting...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-400/25 bg-slate-900/70 px-3 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{player.avatar}</span>
          <span className="font-semibold text-white">
            {player.name}
            {player.isBot ? " [AI]" : ""}
          </span>
        </div>
        <span className={`text-xs uppercase ${player.connected ? "text-lime-300" : "text-red-300"}`}>
          {player.connected ? "Online" : "Reconnecting"}
        </span>
      </div>
      <div className="mt-1 text-xs text-slate-300">{player.paddleStyle}</div>
      <div className="mt-2 text-xs uppercase tracking-widest text-slate-300">
        {player.ready ? "Ready" : "Not ready"}
        {player.isHost ? " - Host" : ""}
      </div>
    </div>
  );
}

export default function LobbyScreen({
  room,
  playerId,
  isSpectator,
  onToggleReady,
  onStart,
  onSelectPaddle,
  onLeave,
}) {
  const localPlayer = room.players.find((player) => player.id === playerId) || null;

  const leftSlots = Array.from({ length: room.mode.left }, (_, idx) =>
    room.players.find((player) => player.team === "left" && player.slot === idx)
  );
  const rightSlots = Array.from({ length: room.mode.right }, (_, idx) =>
    room.players.find((player) => player.team === "right" && player.slot === idx)
  );

  return (
    <div className="relative min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="neon-panel rounded-2xl px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Share this room code</p>
              <p className="font-display text-4xl uppercase tracking-[0.35em] text-arena-cyan">{room.code}</p>
            </div>
            <div className="text-right text-sm text-slate-300">
              <div>Mode: {room.modeKey}</div>
              <div>Winning score: {room.winningScore}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr,1fr]">
          <div className="neon-panel rounded-2xl p-4">
            <h3 className="font-display text-lg uppercase tracking-[0.16em] text-white">Team Slots</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-cyan-200">Left Team</div>
                <div className="space-y-2">
                  {leftSlots.map((slot, idx) => (
                    <SlotCard key={`left_${idx}`} player={slot} index={idx} />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-lime-200">Right Team</div>
                <div className="space-y-2">
                  {rightSlots.map((slot, idx) => (
                    <SlotCard key={`right_${idx}`} player={slot} index={idx} />
                  ))}
                </div>
              </div>
            </div>

            {room.spectators.length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
                Spectators: {room.spectators.map((spectator) => spectator.name).join(", ")}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="neon-panel rounded-2xl p-4">
              <h3 className="font-display text-lg uppercase tracking-[0.16em] text-white">Paddle Style</h3>
              {isSpectator && <p className="mt-2 text-sm text-slate-300">Spectating only: style changes disabled.</p>}

              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.keys(PADDLE_STYLES).map((style) => (
                  <button
                    key={style}
                    type="button"
                    disabled={isSpectator}
                    onClick={() => onSelectPaddle(style)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      localPlayer?.paddleStyle === style
                        ? "border-arena-cyan bg-cyan-500/10"
                        : "border-slate-700 bg-slate-900/70"
                    } disabled:opacity-40`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="neon-panel rounded-2xl p-4"
            >
              <h3 className="font-display text-lg uppercase tracking-[0.16em] text-white">Ready Check</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={isSpectator}
                  onClick={onToggleReady}
                  className="neon-button rounded-lg px-4 py-3 text-base font-semibold uppercase disabled:opacity-40"
                >
                  {localPlayer?.ready ? "Unready" : "Ready"}
                </button>
                <button
                  type="button"
                  disabled={!localPlayer?.isHost || !room.canStart}
                  onClick={onStart}
                  className="ember-button rounded-lg px-4 py-3 text-base font-semibold uppercase disabled:opacity-40"
                >
                  Start Match
                </button>
              </div>

              <button
                type="button"
                onClick={onLeave}
                className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm uppercase tracking-[0.15em] text-slate-200"
              >
                Leave Lobby
              </button>
            </motion.div>

            {room.matchHistory.length > 0 && (
              <div className="neon-panel soft-scrollbar max-h-44 overflow-auto rounded-2xl p-4">
                <h3 className="font-display text-sm uppercase tracking-[0.18em] text-white">Recent Matches</h3>
                <div className="mt-2 space-y-2 text-sm text-slate-300">
                  {room.matchHistory.map((match) => (
                    <div key={match.id} className="rounded-md border border-slate-700/70 bg-slate-950/50 px-2 py-1">
                      Winner: {match.winner.toUpperCase()} ({match.scores.left}-{match.scores.right})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
