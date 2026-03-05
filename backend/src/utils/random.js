const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomChoice(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createRoomCode(existing = new Set()) {
  let attempt = "";
  do {
    attempt = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  } while (existing.has(attempt));
  return attempt;
}

function normalizeName(raw, fallback = "Player") {
  const cleaned = String(raw || "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .slice(0, 18);
  return cleaned || fallback;
}

module.exports = {
  clamp,
  randomInt,
  randomFloat,
  randomChoice,
  uid,
  createRoomCode,
  normalizeName,
};