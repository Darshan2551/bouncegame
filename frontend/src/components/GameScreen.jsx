import { useCallback, useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

import GameCanvas from "./GameCanvas";
import ReactionPad from "./ReactionPad";
import EndGameOverlay from "./EndGameOverlay";
import { POWERUP_BADGES } from "../lib/constants";

function formatTimer(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
  const mobileControlButtonClass =
    "h-16 min-w-[8rem] rounded-xl border border-cyan-200/50 bg-slate-950/85 px-5 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-100 active:scale-[0.98]";
  const keysRef = useRef(Object.create(null));
  const inputStateRef = useRef({
    targetNorm: 0.5,
    lastTargetSentAt: 0,
    lastSentNorm: null,
    lastSentDirection: 0,
  });
  const localControlRef = useRef({
    targetNorm: 0.5,
    authoritativeNorm: 0.5,
    direction: 0,
    inputActive: false,
    lastInputAt: 0,
    nextInputSeq: 1,
    lastAckSeq: 0,
    pendingInputs: [],
  });
  const sendInputRef = useRef(onSendInput);

  const localPlayer = room.players.find((player) => player.id === playerId) || null;
  const rage = localPlayer?.energy || 0;
  const isTouchDevice = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return (
      (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
      navigator.maxTouchPoints > 0 ||
      "ontouchstart" in window
    );
  }, []);
  const predictedSpeedNormPerSec = useMemo(() => {
    const arenaHeight = Number(room?.arena?.height || 0);
    if (!arenaHeight) {
      return 0.75;
    }
    if ((localPlayer?.effects?.freezeMs || 0) > 0) {
      return 0;
    }

    let speed = 540;
    if ((localPlayer?.effects?.speedBoostMs || 0) > 0) {
      speed *= 1.45;
    }
    return speed / arenaHeight;
  }, [localPlayer?.effects?.freezeMs, localPlayer?.effects?.speedBoostMs, room?.arena?.height]);

  useEffect(() => {
    sendInputRef.current = onSendInput;
  }, [onSendInput]);

  useEffect(() => {
    if (!localPlayer || !room?.arena?.height || isSpectator) {
      return;
    }

    const control = localControlRef.current;
    const authoritativeNorm = clamp(localPlayer.paddle.y / room.arena.height, 0, 1);
    control.authoritativeNorm = authoritativeNorm;

    const ackSeq = Number(localPlayer.paddle.inputSeq || 0);
    if (Number.isFinite(ackSeq) && ackSeq >= control.lastAckSeq) {
      control.lastAckSeq = ackSeq;
      if (control.pendingInputs.length > 0) {
        control.pendingInputs = control.pendingInputs.filter((entry) => entry.seq > ackSeq);
      }
    }

    const hasKeyboardInput =
      Boolean(keysRef.current.w || keysRef.current.arrowup) ||
      Boolean(keysRef.current.s || keysRef.current.arrowdown);
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const recentlyActive = control.inputActive || now - control.lastInputAt < 90;
    if (!hasKeyboardInput && control.pendingInputs.length === 0 && !recentlyActive) {
      inputStateRef.current.targetNorm = authoritativeNorm;
      control.targetNorm = authoritativeNorm;
    }
  }, [isSpectator, localPlayer, room?.arena?.height]);

  const refreshInputActivity = useCallback(() => {
    const control = localControlRef.current;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    control.inputActive =
      Boolean(keysRef.current.w || keysRef.current.arrowup) ||
      Boolean(keysRef.current.s || keysRef.current.arrowdown);
    control.lastInputAt = now;
  }, []);

  const handleMobileHoldStart = useCallback(
    (direction, event) => {
      if (isSpectator || !isTouchDevice) {
        return;
      }
      event.preventDefault();
      if (event.currentTarget?.setPointerCapture && typeof event.pointerId === "number") {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Ignore capture errors on browsers that report unsupported pointer capture.
        }
      }
      if (direction < 0) {
        keysRef.current.arrowup = true;
        keysRef.current.arrowdown = false;
      } else {
        keysRef.current.arrowdown = true;
        keysRef.current.arrowup = false;
      }
      refreshInputActivity();
    },
    [isSpectator, isTouchDevice, refreshInputActivity]
  );

  const handleMobileHoldEnd = useCallback(
    (event) => {
      if (isSpectator || !isTouchDevice) {
        return;
      }
      event.preventDefault();
      keysRef.current.arrowup = false;
      keysRef.current.arrowdown = false;
      refreshInputActivity();
    },
    [isSpectator, isTouchDevice, refreshInputActivity]
  );

  const setTargetFromDirection = useCallback((direction, dt) => {
    const state = inputStateRef.current;
    if (direction === 0) {
      return;
    }
    state.targetNorm = clamp(state.targetNorm + direction * predictedSpeedNormPerSec * dt, 0, 1);
  }, [predictedSpeedNormPerSec]);

  const emitInputCommand = useCallback((payload, sentAt) => {
    const control = localControlRef.current;
    const seq = control.nextInputSeq;
    control.nextInputSeq += 1;

    const packet = {
      seq,
      direction: clamp(Number(payload.direction || 0), -1, 1),
      targetY: typeof payload.targetY === "number" ? clamp(payload.targetY, 0, 1) : payload.targetY ?? null,
      clientSentAt: sentAt,
    };

    if (typeof packet.targetY === "number") {
      const pending = control.pendingInputs;
      const last = pending[pending.length - 1] || null;
      if (
        !last ||
        Math.abs(last.targetY - packet.targetY) > 0.0015 ||
        Math.abs(last.direction - packet.direction) > 0.01
      ) {
        pending.push({
          seq,
          targetY: packet.targetY,
          direction: packet.direction,
          sentAt,
        });
        if (pending.length > 160) {
          pending.splice(0, pending.length - 160);
        }
      }
    }

    sendInputRef.current(packet);
  }, []);

  useEffect(() => {
    if (isSpectator) {
      return undefined;
    }

    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") {
        keysRef.current[key] = true;
        event.preventDefault();
      }
      if (key === "s" || key === "arrowdown") {
        keysRef.current[key] = true;
        event.preventDefault();
      }
      if (key === " " || key === "space") {
        event.preventDefault();
        onActivateUltimate();
      }
    };

    const onKeyUp = (event) => {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") {
        keysRef.current[key] = false;
      }
      if (key === "s" || key === "arrowdown") {
        keysRef.current[key] = false;
      }
    };

    const onBlur = () => {
      keysRef.current = Object.create(null);
      const control = localControlRef.current;
      control.direction = 0;
      control.inputActive = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [isSpectator, onActivateUltimate]);

  useEffect(() => {
    if (isSpectator) {
      return undefined;
    }

    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const up = Boolean(keysRef.current.w || keysRef.current.arrowup);
      const down = Boolean(keysRef.current.s || keysRef.current.arrowdown);
      const direction = up === down ? 0 : up ? -1 : 1;

      const state = inputStateRef.current;
      setTargetFromDirection(direction, dt);

      const control = localControlRef.current;
      control.direction = direction;
      control.targetNorm = state.targetNorm;
      control.inputActive = direction !== 0;
      if (control.inputActive) {
        control.lastInputAt = now;
      }

      const directionChanged = direction !== state.lastSentDirection;
      const sendInterval = direction !== 0 ? 50 : 90;
      const elapsedSinceLastSend = now - state.lastTargetSentAt;
      const normDelta =
        state.lastSentNorm === null ? Number.POSITIVE_INFINITY : Math.abs(state.targetNorm - state.lastSentNorm);
      const intervalReached = elapsedSinceLastSend >= sendInterval;
      if (
        state.lastSentNorm === null ||
        directionChanged ||
        (intervalReached && (direction !== 0 || normDelta > 0.01))
      ) {
        state.lastSentNorm = state.targetNorm;
        state.lastSentDirection = direction;
        state.lastTargetSentAt = now;
        emitInputCommand({ direction, targetY: state.targetNorm }, now);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      const state = inputStateRef.current;
      state.lastSentNorm = null;
      state.lastSentDirection = 0;
      state.lastTargetSentAt = 0;
      const control = localControlRef.current;
      control.direction = 0;
      control.inputActive = false;
      control.lastInputAt = 0;
      control.pendingInputs = [];
      emitInputCommand({ direction: 0, targetY: null }, performance.now());
    };
  }, [emitInputCommand, isSpectator, setTargetFromDirection]);

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
    <div className="relative min-h-screen p-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:p-5">
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
          <div
            className="relative h-[64vh] min-h-[300px] select-none sm:min-h-[360px] md:h-[72vh]"
            style={{ touchAction: "auto" }}
          >
            <GameCanvas
              room={room}
              playerId={playerId}
              localControlRef={isSpectator ? null : localControlRef}
            />

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

            {!isSpectator && isTouchDevice && (
              <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3">
                <button
                  type="button"
                  className={mobileControlButtonClass}
                  style={{ touchAction: "none" }}
                  onPointerDown={(event) => handleMobileHoldStart(-1, event)}
                  onPointerUp={handleMobileHoldEnd}
                  onPointerCancel={handleMobileHoldEnd}
                  onLostPointerCapture={handleMobileHoldEnd}
                >
                  Up
                </button>
                <button
                  type="button"
                  className={mobileControlButtonClass}
                  style={{ touchAction: "none" }}
                  onPointerDown={(event) => handleMobileHoldStart(1, event)}
                  onPointerUp={handleMobileHoldEnd}
                  onPointerCancel={handleMobileHoldEnd}
                  onLostPointerCapture={handleMobileHoldEnd}
                >
                  Down
                </button>
              </div>
            )}

            {room.status === "finished" && (
              <EndGameOverlay room={room} onRematch={onRematch} onReturnLobby={onReturnLobby} />
            )}
          </div>

          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:block lg:space-y-3">
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
          </div>
        </div>
      </div>
    </div>
  );
}
