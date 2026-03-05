import { useEffect, useRef } from "react";

import { PADDLE_STYLES, POWERUP_BADGES } from "../lib/constants";
const BASE_PADDLE_SPEED = 540;

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

export default function GameCanvas({ room, playerId, localControlRef = null }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(room);
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
    shakeRef.current.magnitude = Math.max(shakeRef.current.magnitude, 6.5);
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

      const renderState = renderStateRef.current;
      if (!renderState.initialized) {
        renderState.initialized = true;
        renderState.ball.x = state.ball.x;
        renderState.ball.y = state.ball.y;
        renderState.players = new Map(
          state.players.map((player) => [player.id, { x: player.paddle.x, y: player.paddle.y, vy: 0 }])
        );
      } else {
        const nextPlayers = new Map();
        for (const player of state.players) {
          const prev = renderState.players.get(player.id) || {
            x: player.paddle.x,
            y: player.paddle.y,
            vy: 0,
          };
          const isLocal = player.id === playerId && localControlRef?.current && !player.isBot;
          const jumped =
            Math.abs(prev.x - player.paddle.x) > 260 || Math.abs(prev.y - player.paddle.y) > 260;

          if (jumped) {
            prev.x = player.paddle.x;
            prev.y = player.paddle.y;
            prev.vy = 0;
          } else if (isLocal && (state.status === "live" || state.status === "countdown")) {
            const input = localControlRef.current;
            const speedBoosted = (player.effects?.speedBoostMs || 0) > 0;
            const frozen = (player.effects?.freezeMs || 0) > 0;
            let speed = BASE_PADDLE_SPEED;
            if (speedBoosted) {
              speed *= 1.45;
            }

            if (frozen) {
              prev.vy = lerp(prev.vy || 0, 0, Math.min(1, dt * 26));
            } else {
              const targetVy = clamp(Number(input.direction || 0), -1, 1) * speed;
              prev.vy = lerp(prev.vy || 0, targetVy, Math.min(1, dt * 28));
              prev.y += prev.vy * dt;

              if (typeof input.touchTarget === "number") {
                const touchTargetY = clamp(input.touchTarget, 0, 1) * arena.height;
                prev.y = lerp(prev.y, touchTargetY, Math.min(1, dt * 22));
              }
            }

            const halfHeight = player.paddle.height / 2;
            prev.y = clamp(prev.y, halfHeight, arena.height - halfHeight);
            prev.x = lerp(prev.x, player.paddle.x, paddleAlpha);

            const reconciliation = Math.abs(player.paddle.y - prev.y);
            if (reconciliation > 120) {
              prev.y = player.paddle.y;
              prev.vy = 0;
            } else {
              prev.y = lerp(prev.y, player.paddle.y, Math.min(1, dt * 10));
            }
          } else {
            prev.x = lerp(prev.x, player.paddle.x, paddleAlpha);
            prev.y = lerp(prev.y, player.paddle.y, paddleAlpha);
            prev.vy = 0;
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
