import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import GameCanvas from "./GameCanvas";
import ReactionPad from "./ReactionPad";
import MobileControls from "./MobileControls";
import EndGameOverlay from "./EndGameOverlay";
import { POWERUP_BADGES } from "../lib/constants";

function formatTimer(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function GameScreen({
  room,
  playerId,
  isSpectator,
  onSendInput,
  onSendReaction,
  onActivateUltimate,
  onRematch,
  onReturnLobby,
  onLeave,
}) {
  const [direction, setDirection] = useState(0);
  const keyStateRef = useRef({ up: false, down: false });
  const directionRef = useRef(0);

  const localPlayer = room.players.find((player) => player.id === playerId) || null;
  const rage = localPlayer?.energy || 0;

  const applyDirection = useCallback(
    (nextDirection) => {
      if (directionRef.current === nextDirection) {
        return;
      }
      directionRef.current = nextDirection;
      setDirection(nextDirection);
      onSendInput({ direction: nextDirection });
    },
    [onSendInput]
  );

  useEffect(() => {
    if (isSpectator) {
      return undefined;
    }

    const syncDirection = () => {
      const up = keyStateRef.current.up;
      const down = keyStateRef.current.down;
      const nextDirection = up === down ? 0 : up ? -1 : 1;
      applyDirection(nextDirection);
    };

    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") {
        keyStateRef.current.up = true;
        syncDirection();
      }
      if (key === "s" || key === "arrowdown") {
        keyStateRef.current.down = true;
        syncDirection();
      }
      if (key === " " || key === "space") {
        event.preventDefault();
        onActivateUltimate();
      }
    };

    const onKeyUp = (event) => {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") {
        keyStateRef.current.up = false;
        syncDirection();
      }
      if (key === "s" || key === "arrowdown") {
        keyStateRef.current.down = false;
        syncDirection();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [applyDirection, isSpectator, onActivateUltimate]);

  useEffect(() => {
    if (isSpectator) {
      return;
    }
    const timer = setInterval(() => {
      if (directionRef.current !== 0) {
        onSendInput({ direction: directionRef.current });
      }
    }, 24);
    return () => clearInterval(timer);
  }, [isSpectator, onSendInput]);

  const activeEffects = useMemo(() => {
    if (!localPlayer) {
      return [];
    }

    return Object.entries(localPlayer.effects)
      .filter(([, remaining]) => remaining > 0)
      .map(([key, remaining]) => {
        const labelKey = key.replace("Ms", "");
        const badgeKey = labelKey === "freeze" ? "freezeOpponent" : labelKey;
        const badge = POWERUP_BADGES[badgeKey] || null;
        return {
          key: badgeKey,
          label: badge?.label || labelKey,
          icon: badge?.icon || "*",
          color: badge?.color || "#3cf3ff",
          remaining,
        };
      });
  }, [localPlayer]);

  return (
    <div className="relative min-h-screen p-3 md:p-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-3">
        <div className="neon-panel rounded-xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <motion.div
                key={`left_${room.scores.left}`}
                initial={{ scale: 1.25, opacity: 0.35 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-display text-3xl text-arena-cyan"
              >
                {room.scores.left}
              </motion.div>
              <span className="font-display text-xl tracking-[0.2em] text-slate-300">:</span>
              <motion.div
                key={`right_${room.scores.right}`}
                initial={{ scale: 1.25, opacity: 0.35 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-display text-3xl text-lime-300"
              >
                {room.scores.right}
              </motion.div>
              <span className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs uppercase tracking-[0.15em] text-slate-300">
                Target {room.winningScore}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-300">
              <span className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 uppercase tracking-[0.14em]">
                Timer {formatTimer(room.timerMs)}
              </span>
              <button
                type="button"
                onClick={onLeave}
                className="rounded-md border border-slate-600 bg-slate-900/70 px-3 py-1 uppercase tracking-[0.14em]"
              >
                Leave
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr,290px]">
          <div className="relative h-[60vh] min-h-[380px] md:h-[72vh]">
            <GameCanvas room={room} playerId={playerId} />

            <AnimatePresence>
              {room.status === "countdown" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-slate-950/40"
                >
                  <motion.div
                    key={Math.ceil(room.countdownMs / 1000)}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="font-display text-7xl text-white"
                  >
                    {Math.max(1, Math.ceil(room.countdownMs / 1000))}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {room.status === "finished" && (
              <EndGameOverlay room={room} onRematch={onRematch} onReturnLobby={onReturnLobby} />
            )}
          </div>

          <div className="space-y-3">
            <div className="neon-panel rounded-xl p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Players</div>
              <div className="mt-2 space-y-2 text-sm">
                {room.players.map((player) => (
                  <div
                    key={player.id}
                    className={`rounded-md border px-2 py-1 ${
                      player.id === playerId ? "border-cyan-300/70 bg-cyan-500/10" : "border-slate-700 bg-slate-900/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {player.avatar} {player.name}
                        {player.isBot ? " [AI]" : ""}
                      </span>
                      <span className="text-xs uppercase text-slate-300">{player.team}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="neon-panel rounded-xl p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Power-up Indicator</div>
              {activeEffects.length === 0 && <p className="mt-2 text-sm text-slate-400">No active power-up</p>}
              {activeEffects.length > 0 && (
                <div className="mt-2 space-y-2 text-sm">
                  {activeEffects.map((effect) => (
                    <div key={effect.key} className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1">
                      {effect.icon} {effect.label} ({Math.ceil(effect.remaining / 1000)}s)
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isSpectator && (
              <div className="neon-panel rounded-xl p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Rage Meter</div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-900">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                    style={{ width: `${rage}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                  <span>{Math.round(rage)} / 100</span>
                  {localPlayer?.ultimateMs > 0 && (
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-200">
                      Ultimate {Math.ceil(localPlayer.ultimateMs / 1000)}s
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onActivateUltimate}
                  disabled={rage < 100}
                  className="ember-button mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] disabled:opacity-50"
                >
                  Ultimate Smash
                </button>
              </div>
            )}

            {!isSpectator && (
              <ReactionPad
                onSend={(type, value) => {
                  onSendReaction(type, value);
                }}
              />
            )}

            {!isSpectator && (
              <MobileControls
                onDirection={(value) => applyDirection(value)}
                onTargetY={(value) => onSendInput({ targetY: value })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}