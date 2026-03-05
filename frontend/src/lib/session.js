const SESSION_KEY = "bounce_arena_session";
const ROOM_KEY = "bounce_arena_room";

function randomFallback() {
  return `sess_${Math.random().toString(36).slice(2, 10)}`;
}

export function ensureSessionId() {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) || randomFallback();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function saveRoomCode(code) {
  if (!code) {
    localStorage.removeItem(ROOM_KEY);
    return;
  }
  localStorage.setItem(ROOM_KEY, code);
}

export function getSavedRoomCode() {
  return localStorage.getItem(ROOM_KEY) || "";
}