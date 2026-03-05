const ARENA_WIDTH = 1280;
const ARENA_HEIGHT = 720;

const TICK_RATE = 60;
const BROADCAST_RATE = 30;

const PADDLE_WIDTH = 20;
const PADDLE_HEIGHT = 150;
const PADDLE_BASE_SPEED = 540;

const INITIAL_BALL_SPEED = 520;
const MAX_BALL_SPEED = 1550;
const MAX_BOUNCE_ANGLE = Math.PI / 3;

const COUNTDOWN_MS = 3000;
const SERVE_LOCK_MS = 1200;
const DISCONNECT_GRACE_MS = 45000;

const POWERUP_SPAWN_MIN_MS = 20000;
const POWERUP_SPAWN_MAX_MS = 30000;
const POWERUP_TTL_MS = 12000;

const REACTION_TTL_MS = 2600;
const MAX_WINNING_SCORE = 25;
const MIN_WINNING_SCORE = 3;

const MODES = {
  "1v1": { left: 1, right: 1 },
  "2v1": { left: 2, right: 1 },
  "2v2": { left: 2, right: 2 },
};

const TEAM_ORDER = ["left", "right"];

const PADDLE_STYLES = {
  "Neon Paddle": { primary: "#4ff6ff", accent: "#1be7a6" },
  "Cyber Blade": { primary: "#ff6b6b", accent: "#ffb347" },
  "Plasma Board": { primary: "#6fffb0", accent: "#2af4ff" },
  "Classic Paddle": { primary: "#d9e8ff", accent: "#8cb5ff" },
};

const EMOJIS = ["\u{1F602}", "\u{1F60E}", "\u{1F525}", "\u{1F480}", "\u{1F921}", "\u{1F631}"];
const ROASTS = ["Too slow!", "Nice try!", "Skill issue!", "Get rekt!"];

const POWERUPS = {
  speedBoost: {
    label: "Speed Boost",
    durationMs: 6000,
    color: "#6fffb0",
    icon: "\u26A1",
  },
  powerSmash: {
    label: "Power Smash",
    durationMs: 4500,
    color: "#ff8a65",
    icon: "\u{1F525}",
  },
  shield: {
    label: "Shield",
    durationMs: 0,
    color: "#7cc5ff",
    icon: "\u{1F6E1}",
  },
  curveBall: {
    label: "Curve Ball",
    durationMs: 6000,
    color: "#d69bff",
    icon: "\u{1F300}",
  },
  freezeOpponent: {
    label: "Freeze Opponent",
    durationMs: 2500,
    color: "#9edbff",
    icon: "\u2744",
  },
};

module.exports = {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  TICK_RATE,
  BROADCAST_RATE,
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_BASE_SPEED,
  INITIAL_BALL_SPEED,
  MAX_BALL_SPEED,
  MAX_BOUNCE_ANGLE,
  COUNTDOWN_MS,
  SERVE_LOCK_MS,
  DISCONNECT_GRACE_MS,
  POWERUP_SPAWN_MIN_MS,
  POWERUP_SPAWN_MAX_MS,
  POWERUP_TTL_MS,
  REACTION_TTL_MS,
  MIN_WINNING_SCORE,
  MAX_WINNING_SCORE,
  MODES,
  TEAM_ORDER,
  PADDLE_STYLES,
  POWERUPS,
  EMOJIS,
  ROASTS,
};
