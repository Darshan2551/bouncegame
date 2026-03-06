const VOLUME_KEY = "bounce_arena_sound_volume";
const MUTED_KEY = "bounce_arena_sound_muted";
const MUSIC_VOLUME_KEY = "bounce_arena_music_volume";

const SOUND_FILES = {
  paddleHit: "/sounds/paddle-hit.wav",
  wallBounce: "/sounds/wall-bounce.wav",
  score: "/sounds/score.wav",
  gameStart: "/sounds/game-start.wav",
  victory: "/sounds/victory.wav",
  bgmLoop: "/sounds/bgm-loop.wav",
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

function readStoredMusicVolume() {
  try {
    const raw = localStorage.getItem(MUSIC_VOLUME_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return 0.58;
    }
    return clamp(parsed, 0, 1);
  } catch (_error) {
    return 0.58;
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
    this.effectsBusGain = null;
    this.musicBusGain = null;

    this.buffers = new Map();
    this.preloadPromise = null;

    this.volume = readStoredVolume();
    this.musicVolume = readStoredMusicVolume();
    this.muted = readStoredMuted();

    this.bgmSource = null;
    this.bgmGainNode = null;
    this.bgmBaseGain = 0.62;
    this.bgmPlaybackRate = 1;
    this.bgmWanted = false;
    this.bgmMood = "idle";
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
    const effectsBusGain = context.createGain();
    const musicBusGain = context.createGain();

    effectsBusGain.gain.value = 1;
    musicBusGain.gain.value = this.musicVolume;
    masterGain.gain.value = this.muted ? 0 : this.volume;

    effectsBusGain.connect(masterGain);
    musicBusGain.connect(masterGain);
    masterGain.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    this.effectsBusGain = effectsBusGain;
    this.musicBusGain = musicBusGain;

    return context;
  }

  _rampParam(param, value, rampSec = 0.05) {
    const context = this.context;
    if (!context || !param) {
      return;
    }
    const now = context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + Math.max(0.01, rampSec));
  }

  _applyMasterVolume() {
    if (!this.masterGain) {
      return;
    }
    const target = this.muted ? 0 : this.volume;
    this._rampParam(this.masterGain.gain, target, 0.05);
  }

  _applyMusicVolume() {
    if (!this.musicBusGain) {
      return;
    }
    this._rampParam(this.musicBusGain.gain, this.musicVolume, 0.06);
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

    if (this.bgmWanted) {
      this._ensureBgmPlaying();
    }

    return context.state === "running";
  }

  setVolume(value) {
    this.volume = clamp(Number(value) || 0, 0, 1);
    this._applyMasterVolume();
    try {
      localStorage.setItem(VOLUME_KEY, String(this.volume));
    } catch (_error) {
      // Ignore storage errors in private mode.
    }
  }

  getVolume() {
    return this.volume;
  }

  setMusicVolume(value) {
    this.musicVolume = clamp(Number(value) || 0, 0, 1);
    this._applyMusicVolume();
    try {
      localStorage.setItem(MUSIC_VOLUME_KEY, String(this.musicVolume));
    } catch (_error) {
      // Ignore storage errors in private mode.
    }
  }

  getMusicVolume() {
    return this.musicVolume;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this._applyMasterVolume();
    try {
      localStorage.setItem(MUTED_KEY, this.muted ? "true" : "false");
    } catch (_error) {
      // Ignore storage errors in private mode.
    }
  }

  isMuted() {
    return this.muted;
  }

  _setBgmParams({ baseGain, playbackRate, rampSec = 0.3 }) {
    if (Number.isFinite(baseGain)) {
      this.bgmBaseGain = clamp(baseGain, 0, 1.5);
    }
    if (Number.isFinite(playbackRate)) {
      this.bgmPlaybackRate = clamp(playbackRate, 0.65, 1.4);
    }

    if (!this.context || !this.bgmSource || !this.bgmGainNode) {
      return;
    }

    const now = this.context.currentTime;
    this.bgmSource.playbackRate.cancelScheduledValues(now);
    this.bgmSource.playbackRate.setValueAtTime(this.bgmSource.playbackRate.value, now);
    this.bgmSource.playbackRate.linearRampToValueAtTime(this.bgmPlaybackRate, now + rampSec);

    this.bgmGainNode.gain.cancelScheduledValues(now);
    this.bgmGainNode.gain.setValueAtTime(this.bgmGainNode.gain.value, now);
    this.bgmGainNode.gain.linearRampToValueAtTime(this.bgmBaseGain, now + rampSec);
  }

  _ensureBgmPlaying() {
    const context = this.ensureContext();
    if (!context || !this.musicBusGain || !this.bgmWanted) {
      return;
    }
    if (context.state !== "running") {
      return;
    }
    if (this.bgmSource) {
      return;
    }

    const buffer = this.buffers.get("bgmLoop");
    if (!buffer) {
      if (!this.preloadPromise) {
        void this.preload();
      }
      return;
    }

    const source = context.createBufferSource();
    const bgmGainNode = context.createGain();

    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = this.bgmPlaybackRate;
    bgmGainNode.gain.value = this.bgmBaseGain;

    source.connect(bgmGainNode);
    bgmGainNode.connect(this.musicBusGain);
    source.start(0);

    source.onended = () => {
      if (this.bgmSource === source) {
        this.bgmSource = null;
        this.bgmGainNode = null;
      }
      if (this.bgmWanted) {
        this._ensureBgmPlaying();
      }
    };

    this.bgmSource = source;
    this.bgmGainNode = bgmGainNode;
  }

  startBgm(options = {}) {
    this.bgmWanted = true;
    if (options.mood) {
      this.setBgmMood(options.mood);
    }
    this._ensureBgmPlaying();
  }

  stopBgm(options = {}) {
    this.bgmWanted = false;
    if (!this.context || !this.bgmSource || !this.bgmGainNode) {
      return;
    }

    const fadeMs = clamp(Number(options.fadeMs) || 180, 60, 2400);
    const now = this.context.currentTime;
    const fadeSec = fadeMs / 1000;

    this.bgmGainNode.gain.cancelScheduledValues(now);
    this.bgmGainNode.gain.setValueAtTime(this.bgmGainNode.gain.value, now);
    this.bgmGainNode.gain.linearRampToValueAtTime(0, now + fadeSec);

    const source = this.bgmSource;
    const node = this.bgmGainNode;

    this.bgmSource = null;
    this.bgmGainNode = null;

    setTimeout(() => {
      try {
        source.stop();
      } catch (_error) {
        // no-op
      }
      try {
        source.disconnect();
      } catch (_error) {
        // no-op
      }
      try {
        node.disconnect();
      } catch (_error) {
        // no-op
      }
    }, fadeMs + 40);
  }

  setBgmMood(mood) {
    this.bgmMood = String(mood || "live");

    switch (this.bgmMood) {
      case "countdown":
        this._setBgmParams({ playbackRate: 0.96, baseGain: 0.55, rampSec: 0.2 });
        break;
      case "live":
        this._setBgmParams({ playbackRate: 1.02, baseGain: 0.62, rampSec: 0.24 });
        break;
      case "clutch":
        this._setBgmParams({ playbackRate: 1.11, baseGain: 0.78, rampSec: 0.22 });
        break;
      case "finished":
        this._setBgmParams({ playbackRate: 0.89, baseGain: 0.4, rampSec: 0.35 });
        break;
      default:
        this._setBgmParams({ playbackRate: 0.94, baseGain: 0.48, rampSec: 0.3 });
        break;
    }
  }

  duckBgm(options = {}) {
    if (!this.context || !this.bgmGainNode) {
      return;
    }

    const amount = clamp(Number(options.amount) || 0.42, 0.1, 0.85);
    const recoverMs = clamp(Number(options.recoverMs) || 260, 80, 1600);

    const now = this.context.currentTime;
    const lowTarget = this.bgmBaseGain * (1 - amount);

    this.bgmGainNode.gain.cancelScheduledValues(now);
    this.bgmGainNode.gain.setValueAtTime(this.bgmGainNode.gain.value, now);
    this.bgmGainNode.gain.linearRampToValueAtTime(lowTarget, now + 0.025);
    this.bgmGainNode.gain.linearRampToValueAtTime(this.bgmBaseGain, now + recoverMs / 1000);
  }

  play(name, options = {}) {
    const context = this.ensureContext();
    if (!context || !this.effectsBusGain || this.muted) {
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
    gainNode.connect(this.effectsBusGain);
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
