const VOLUME_KEY = "bounce_arena_sound_volume";
const MUTED_KEY = "bounce_arena_sound_muted";

const SOUND_FILES = {
  paddleHit: "/sounds/paddle-hit.wav",
  wallBounce: "/sounds/wall-bounce.wav",
  score: "/sounds/score.wav",
  gameStart: "/sounds/game-start.wav",
  victory: "/sounds/victory.wav",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readStoredVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return 0.72;
    }
    return clamp(parsed, 0, 1);
  } catch (_error) {
    return 0.72;
  }
}

function readStoredMuted() {
  try {
    return localStorage.getItem(MUTED_KEY) === "true";
  } catch (_error) {
    return false;
  }
}

class SoundManager {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.buffers = new Map();
    this.preloadPromise = null;
    this.volume = readStoredVolume();
    this.muted = readStoredMuted();
  }

  ensureContext() {
    if (typeof window === "undefined") {
      return null;
    }
    if (this.context) {
      return this.context;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    let context = null;
    try {
      context = new AudioContextCtor();
    } catch (_error) {
      return null;
    }
    const masterGain = context.createGain();
    masterGain.gain.value = this.muted ? 0 : this.volume;
    masterGain.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    return context;
  }

  async preload() {
    const context = this.ensureContext();
    if (!context) {
      return;
    }
    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = Promise.all(
      Object.entries(SOUND_FILES).map(async ([key, url]) => {
        try {
          const response = await fetch(url, { cache: "force-cache" });
          if (!response.ok) {
            throw new Error(`Failed to fetch ${url}`);
          }
          const encoded = await response.arrayBuffer();
          const decoded = await context.decodeAudioData(encoded.slice(0));
          this.buffers.set(key, decoded);
        } catch (_error) {
          // Keep gameplay stable even if an asset fails to decode.
        }
      })
    );

    return this.preloadPromise;
  }

  async unlock() {
    const context = this.ensureContext();
    if (!context) {
      return false;
    }

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch (_error) {
        return false;
      }
    }

    if (!this.preloadPromise) {
      void this.preload();
    }

    return context.state === "running";
  }

  setVolume(value) {
    this.volume = clamp(Number(value) || 0, 0, 1);
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
    try {
      localStorage.setItem(VOLUME_KEY, String(this.volume));
    } catch (_error) {
      // Ignore storage errors in private mode.
    }
  }

  getVolume() {
    return this.volume;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
    try {
      localStorage.setItem(MUTED_KEY, this.muted ? "true" : "false");
    } catch (_error) {
      // Ignore storage errors in private mode.
    }
  }

  isMuted() {
    return this.muted;
  }

  play(name, options = {}) {
    const context = this.ensureContext();
    if (!context || !this.masterGain || this.muted) {
      return;
    }
    if (context.state !== "running") {
      return;
    }

    const buffer = this.buffers.get(name);
    if (!buffer) {
      if (!this.preloadPromise) {
        void this.preload();
      }
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;

    if (Number.isFinite(options.playbackRate)) {
      source.playbackRate.value = clamp(Number(options.playbackRate), 0.5, 2);
    }

    const gainNode = context.createGain();
    gainNode.gain.value = Number.isFinite(options.gain) ? clamp(Number(options.gain), 0, 2) : 1;

    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    source.start(0);
  }

  playPaddleHit(options) {
    this.play("paddleHit", options);
  }

  playWallBounce(options) {
    this.play("wallBounce", options);
  }

  playScore(options) {
    this.play("score", options);
  }

  playGameStart(options) {
    this.play("gameStart", options);
  }

  playVictory(options) {
    this.play("victory", options);
  }
}

export const soundManager = new SoundManager();
