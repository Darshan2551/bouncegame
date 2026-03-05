export const MODES = [
  { key: "1v1", label: "1 vs 1", description: "Pure duel mode" },
  { key: "2v1", label: "2 vs 1", description: "Outnumbered showdown" },
  { key: "2v2", label: "2 vs 2", description: "Team battle" },
];

export const PADDLE_STYLES = {
  "Neon Paddle": { primary: "#4ff6ff", accent: "#1be7a6" },
  "Cyber Blade": { primary: "#ff6b6b", accent: "#ffb347" },
  "Plasma Board": { primary: "#6fffb0", accent: "#2af4ff" },
  "Classic Paddle": { primary: "#d9e8ff", accent: "#8cb5ff" },
};

export const EMOJIS = ["\u{1F602}", "\u{1F60E}", "\u{1F525}", "\u{1F480}", "\u{1F921}", "\u{1F631}"];
export const ROASTS = ["Too slow!", "Nice try!", "Skill issue!", "Get rekt!"];

export const POWERUP_BADGES = {
  speedBoost: { icon: "\u26A1", label: "Speed Boost", color: "#6fffb0" },
  powerSmash: { icon: "\u{1F525}", label: "Power Smash", color: "#ff8a65" },
  shield: { icon: "\u{1F6E1}", label: "Shield", color: "#7cc5ff" },
  curveBall: { icon: "\u{1F300}", label: "Curve Ball", color: "#d69bff" },
  freezeOpponent: { icon: "\u2744", label: "Freeze Opponent", color: "#9edbff" },
};

export const AVATARS = [
  "\u{1F6F8}",
  "\u{1F916}",
  "\u{1F9BE}",
  "\u{1F409}",
  "\u{1F98A}",
  "\u{1F42F}",
  "\u{1F988}",
  "\u{1F9E0}",
];

export const AI_LEVELS = [
  { key: "easy", label: "Easy", description: "Relaxed reactions and larger errors" },
  { key: "medium", label: "Medium", description: "Balanced tracking and pace" },
  { key: "hard", label: "Hard", description: "Prediction-heavy fast reaction bot" },
];
