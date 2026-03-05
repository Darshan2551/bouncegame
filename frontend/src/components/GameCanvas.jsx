import { useEffect, useRef } from "react";

import { PADDLE_STYLES, POWERUP_BADGES } from "../lib/constants";
const INTERPOLATION_DELAY_MS = 100;
const SNAPSHOT_TTL_MS = 2000;
const MAX_SNAPSHOTS = 80;

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function lerp(from, to, alpha) {
  return from + (to - from) * alpha;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sampleSnapshot(buffer, renderTime) {
  if (!buffer || buffer.length === 0) {
    return null;
  }
  if (renderTime <= buffer[0].time) {
    return buffer[0];
  }
  for (let index = 1; index < buffer.length; index += 1) {
    const current = buffer[index];
    if (current.time >= renderTime) {
      const previous = buffer[index - 1];
      const span = Math.max(1, current.time - previous.time);
      const alpha = clamp((renderTime - previous.time) / span, 0, 1);
      return {
        x: lerp(previous.x, current.x, alpha),
        y: lerp(previous.y, current.y, alpha),
      };
    }
  }
  return buffer[buffer.length - 1];
}

export default function GameCanvas({ room, playerId, localControlRef = null }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(room);
  const snapshotBufferRef = useRef(new Map());
  const clockOffsetRef = useRef(0);
  const hasClockSyncRef = useRef(false);
  const particlesRef = useRef([]);
  const impactIdRef = useRef(null);
  const shakeRef = useRef({ magnitude: 0 });
  const lastFrameRef = useRef(performance.now());
  const renderStateRef = useRef({
    initialized: false,
    ball: { x: 0, y: 0 },
    players: new Map(),
  });

  useEffect(() => {
    stateRef.current = room;
    const snapshotTime = Number(room?.serverTime || Date.now());
    const nowLocal = Date.now();

    if (!hasClockSyncRef.current) {
      hasClockSyncRef.current = true;
      clockOffsetRef.current = nowLocal - snapshotTime;
    } else {
      clockOffsetRef.current = lerp(clockOffsetRef.current, nowLocal - snapshotTime, 0.08);
    }

    const buffers = snapshotBufferRef.current;
    const activeIds = new Set(room.players.map((player) => player.id));
    for (const id of buffers.keys()) {
      if (!activeIds.has(id)) {
        buffers.delete(id);
      }
    }

    for (const player of room.players) {
      const buffer = buffers.get(player.id) || [];
      const entry = {
        time: snapshotTime,
        x: player.paddle.x,
        y: player.paddle.y,
      };
      const tail = buffer[buffer.length - 1] || null;
      if (tail && tail.time === entry.time) {
        tail.x = entry.x;
        tail.y = entry.y;
      } else if (!tail || tail.time < entry.time) {
        buffer.push(entry);
      }

      const cutoff = snapshotTime - SNAPSHOT_TTL_MS;
      while (buffer.length > 0 && buffer[0].time < cutoff) {
        buffer.shift();
      }
      if (buffer.length > MAX_SNAPSHOTS) {
        buffer.splice(0, buffer.length - MAX_SNAPSHOTS);
      }
      buffers.set(player.id, buffer);
    }
  }, [room]);

  useEffect(() => {
    const impact = room?.lastImpact;
    if (!impact || !impact.id || impact.id === impactIdRef.current) {
      return;
    }

    impactIdRef.current = impact.id;
    for (let i = 0; i < 18; i += 1) {
      const angle = (Math.PI * 2 * i) / 18;
      particlesRef.current.push({
        x: impact.x,
        y: impact.y,
        vx: Math.cos(angle) * (80 + Math.random() * 130),
        vy: Math.sin(angle) * (80 + Math.random() * 130),
        life: 0.7 + Math.random() * 0.4,
      });
    }
    shakeRef.current.magnitude = Math.max(shakeRef.current.magnitude, 3);
  }, [room?.lastImpact]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext("2d");
    let rafId = 0;

    const draw = (frameTs) => {
      const state = stateRef.current;
      if (!state) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      const arena = state.arena;
      const containerWidth = canvas.clientWidth;
      const containerHeight = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      const wantedWidth = Math.floor(containerWidth * dpr);
      const wantedHeight = Math.floor(containerHeight * dpr);
      if (canvas.width !== wantedWidth || canvas.height !== wantedHeight) {
        canvas.width = wantedWidth;
        canvas.height = wantedHeight;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const scaleX = containerWidth / arena.width;
      const scaleY = containerHeight / arena.height;
      const toX = (value) => value * scaleX;
      const toY = (value) => value * scaleY;

      const dt = Math.min(0.05, Math.max(0.001, (frameTs - lastFrameRef.current) / 1000));
      lastFrameRef.current = frameTs;
      const paddleAlpha = Math.min(1, dt * 17);
      const ballAlpha = Math.min(1, dt * 20);
      const renderServerTime = Date.now() - clockOffsetRef.current - INTERPOLATION_DELAY_MS;

      const renderState = renderStateRef.current;
      if (!renderState.initialized) {
        renderState.initialized = true;
        renderState.ball.x = state.ball.x;
        renderState.ball.y = state.ball.y;
        renderState.players = new Map(
          state.players.map((player) => [
            player.id,
            { x: player.paddle.x, y: player.paddle.y, targetY: player.paddle.y },
          ])
        );
      } else {
        const nextPlayers = new Map();
        for (const player of state.players) {
          const prev = renderState.players.get(player.id) || {
            x: player.paddle.x,
            y: player.paddle.y,
            targetY: player.paddle.y,
          };
          const isLocal = player.id === playerId && localControlRef?.current && !player.isBot;
          const jumped =
            Math.abs(prev.x - player.paddle.x) > 260 || Math.abs(prev.y - player.paddle.y) > 260;
          const halfHeight = player.paddle.height / 2;
          const limitTop = halfHeight;
          const limitBottom = arena.height - halfHeight;
          const authoritativeY = clamp(player.paddle.y, limitTop, limitBottom);
          const snapshots = snapshotBufferRef.current.get(player.id);
          const sampled = !isLocal ? sampleSnapshot(snapshots, renderServerTime) : null;

          if (jumped) {
            prev.x = player.paddle.x;
            prev.y = authoritativeY;
            prev.targetY = authoritativeY;
          } else {
            let desiredTargetY = authoritativeY;
            let desiredTargetX = player.paddle.x;

            if (isLocal && (state.status === "live" || state.status === "countdown")) {
              const localNorm = Number(localControlRef.current.targetNorm);
              if (Number.isFinite(localNorm)) {
                desiredTargetY = clamp(localNorm, 0, 1) * arena.height;
                desiredTargetY = clamp(desiredTargetY, limitTop, limitBottom);
              }
            } else if (sampled) {
              desiredTargetY = clamp(sampled.y, limitTop, limitBottom);
              desiredTargetX = sampled.x;
            }

            const targetAlpha = Math.min(1, dt * 24);
            const moveAlpha = isLocal ? Math.min(1, dt * 20) : Math.min(1, dt * 16);
            prev.targetY = lerp(prev.targetY, desiredTargetY, targetAlpha);
            prev.y = lerp(prev.y, prev.targetY, moveAlpha);
            prev.x = lerp(prev.x, desiredTargetX, paddleAlpha);

            const pendingInputs = isLocal ? localControlRef.current.pendingInputs.length : 0;
            const correctionAlpha = isLocal
              ? pendingInputs > 0
                ? Math.min(1, dt * 4)
                : Math.min(1, dt * 9)
              : Math.min(1, dt * 8);
            const correctionGap = authoritativeY - prev.y;
            if (Math.abs(correctionGap) > 130) {
              prev.y = authoritativeY;
              prev.targetY = authoritativeY;
            } else {
              prev.y += correctionGap * correctionAlpha;
            }

            prev.y = clamp(prev.y, limitTop, limitBottom);
            prev.targetY = clamp(prev.targetY, limitTop, limitBottom);
          }
          nextPlayers.set(player.id, prev);
        }
        renderState.players = nextPlayers;

        if (
          Math.abs(renderState.ball.x - state.ball.x) > 340 ||
          Math.abs(renderState.ball.y - state.ball.y) > 220
        ) {
          renderState.ball.x = state.ball.x;
          renderState.ball.y = state.ball.y;
        } else {
          const projectedX = state.ball.x + state.ball.vx * dt * 0.45;
          const projectedY = state.ball.y + state.ball.vy * dt * 0.45;
          renderState.ball.x = lerp(renderState.ball.x, projectedX, ballAlpha);
          renderState.ball.y = lerp(renderState.ball.y, projectedY, ballAlpha);
        }
      }

      const shake = shakeRef.current;
      const shakeAmount = shake.magnitude;
      if (shakeAmount > 0.01) {
        shake.magnitude *= Math.max(0, 1 - dt * 11);
      }
      const shakeX = (Math.random() - 0.5) * shake.magnitude;
      const shakeY = (Math.random() - 0.5) * shake.magnitude;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      const bg = ctx.createLinearGradient(0, 0, containerWidth, containerHeight);
      bg.addColorStop(0, "#030912");
      bg.addColorStop(1, "#09182a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, containerWidth, containerHeight);

      ctx.save();
      ctx.globalAlpha = 0.22;
      const time = frameTs / 1000;
      for (let i = 0; i < 48; i += 1) {
        const x = ((i * 94 + time * 25) % (containerWidth + 120)) - 60;
        const y = (i * 57) % (containerHeight + 40);
        ctx.fillStyle = i % 2 === 0 ? "#1be7a6" : "#3cf3ff";
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();

      ctx.strokeStyle = "rgba(60,243,255,0.36)";
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 14]);
      ctx.beginPath();
      ctx.moveTo(containerWidth / 2, 0);
      ctx.lineTo(containerWidth / 2, containerHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const item of state.powerUps) {
        const meta = POWERUP_BADGES[item.type] || POWERUP_BADGES.speedBoost;
        const pulse = 0.8 + Math.sin(frameTs / 220) * 0.2;
        const x = toX(item.x);
        const y = toY(item.y);
        const radius = item.radius * ((scaleX + scaleY) / 2) * pulse;

        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = meta.color;
        ctx.fillStyle = meta.color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.fillStyle = "#051021";
        ctx.font = `${Math.max(12, radius)}px Rajdhani`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(meta.icon, x, y + 1);
        ctx.restore();
      }

      for (const player of state.players) {
        const style = PADDLE_STYLES[player.paddleStyle] || PADDLE_STYLES["Neon Paddle"];
        const smoothed = renderState.players.get(player.id) || player.paddle;
        const px = toX(smoothed.x - player.paddle.width / 2);
        const py = toY(smoothed.y - player.paddle.height / 2);
        const pw = toX(player.paddle.width);
        const ph = toY(player.paddle.height);

        ctx.save();
        ctx.globalAlpha = player.connected ? 1 : 0.45;
        ctx.shadowBlur = 18;
        ctx.shadowColor = style.primary;
        const gradient = ctx.createLinearGradient(px, py, px + pw, py + ph);
        gradient.addColorStop(0, style.primary);
        gradient.addColorStop(1, style.accent);
        ctx.fillStyle = gradient;

        roundedRect(ctx, px, py, pw, ph, 6);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.42)";
        ctx.lineWidth = 1.1;
        ctx.stroke();

        if (player.effects.freezeMs > 0) {
          ctx.strokeStyle = "rgba(166,219,255,0.75)";
          ctx.lineWidth = 2;
          ctx.strokeRect(px - 2, py - 2, pw + 4, ph + 4);
        }

        if (player.shieldCharges > 0) {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(124,197,255,0.85)";
          ctx.lineWidth = 2;
          const shieldRadius = Math.max(pw, ph) / 1.2;
          ctx.arc(px + pw / 2, py + ph / 2, shieldRadius, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (player.ultimateMs > 0) {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(255,166,88,0.92)";
          ctx.lineWidth = 2.5;
          ctx.arc(px + pw / 2, py + ph / 2, Math.max(pw, ph) / 1.05, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (player.id === playerId) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.font = "12px Rajdhani";
          ctx.textAlign = "center";
          ctx.fillText("YOU", px + pw / 2, py - 8);
        }

        if (player.reaction) {
          const text = player.reaction.value;
          ctx.font = "15px Rajdhani";
          const bubbleW = ctx.measureText(text).width + 20;
          const bubbleH = 26;
          const bx = player.team === "left" ? px + pw + 14 : px - bubbleW - 14;
          const by = py - 4;

          ctx.fillStyle = "rgba(6,14,30,0.92)";
          ctx.strokeStyle = "rgba(60,243,255,0.72)";
          roundedRect(ctx, bx, by, bubbleW, bubbleH, 8);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#dbedff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, bx + bubbleW / 2, by + bubbleH / 2 + 1);
        }

        ctx.restore();
      }

      const ball = state.ball;
      const bx = toX(renderState.ball.x);
      const by = toY(renderState.ball.y);
      const br = ball.radius * ((scaleX + scaleY) / 2);

      ctx.save();
      ctx.shadowBlur = 24;
      ctx.shadowColor = "#f5feff";
      ctx.fillStyle = "#f1faff";
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.life -= dt;
        if (particle.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.97;
        particle.vy *= 0.97;

        ctx.fillStyle = `rgba(60,243,255,${Math.max(0, particle.life)})`;
        ctx.beginPath();
        ctx.arc(toX(particle.x), toY(particle.y), 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [localControlRef, playerId]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none rounded-2xl border border-cyan-300/20 bg-slate-950"
    />
  );
}
