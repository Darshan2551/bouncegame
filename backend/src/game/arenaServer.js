
const {
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
} = require("./constants");
const {
  clamp,
  randomInt,
  randomFloat,
  randomChoice,
  uid,
  createRoomCode,
  normalizeName,
} = require("../utils/random");

const DEFAULT_AVATARS = [
  "\u{1F6F8}",
  "\u{1F916}",
  "\u{1F9BE}",
  "\u{1F409}",
  "\u{1F98A}",
  "\u{1F42F}",
  "\u{1F988}",
  "\u{1F9E0}",
];
const AI_DIFFICULTY = {
  easy: { reactMs: 220, errorRange: 130, speedScale: 0.92 },
  medium: { reactMs: 130, errorRange: 64, speedScale: 1.03 },
  hard: { reactMs: 70, errorRange: 22, speedScale: 1.17 },
};

function createBall(direction = randomChoice([-1, 1])) {
  return {
    x: ARENA_WIDTH / 2,
    y: ARENA_HEIGHT / 2,
    vx: INITIAL_BALL_SPEED * direction,
    vy: randomFloat(-150, 150),
    radius: 12,
    lastHitPlayerId: null,
    lastHitTeam: null,
    curveUntil: 0,
    curveStartAt: 0,
    curveAmplitude: 0,
    curvePhase: 0,
  };
}

function circleRectCollision(ball, paddle) {
  const dx = Math.abs(ball.x - paddle.x);
  const dy = Math.abs(ball.y - paddle.y);

  if (dx > paddle.width / 2 + ball.radius) {
    return false;
  }
  if (dy > paddle.height / 2 + ball.radius) {
    return false;
  }
  if (dx <= paddle.width / 2 || dy <= paddle.height / 2) {
    return true;
  }

  const cornerDistanceSq =
    (dx - paddle.width / 2) * (dx - paddle.width / 2) +
    (dy - paddle.height / 2) * (dy - paddle.height / 2);

  return cornerDistanceSq <= ball.radius * ball.radius;
}

function modeFromKey(modeKey) {
  return MODES[modeKey] ? modeKey : "1v1";
}

function teamCapacity(mode, team) {
  return mode[team] || 0;
}

function requiredPlayers(mode) {
  return mode.left + mode.right;
}

function reflectY(value, min, max) {
  let y = value;
  while (y < min || y > max) {
    if (y < min) {
      y = min + (min - y);
    }
    if (y > max) {
      y = max - (y - max);
    }
  }
  return y;
}

class ArenaServer {
  constructor(io, options = {}) {
    this.io = io;
    this.rooms = new Map();
    this.socketIndex = new Map();
    this.matchmakingQueues = new Map();
    this.defaultWinningScore = clamp(
      Number(options.defaultWinningScore || 10),
      MIN_WINNING_SCORE,
      MAX_WINNING_SCORE
    );
    this.leaderboardStore = options.leaderboardStore || null;

    this.tickHandle = null;
    this.cleanupHandle = null;
  }

  start() {
    const tickMs = Math.floor(1000 / TICK_RATE);
    this.tickHandle = setInterval(() => this.tick(), tickMs);
    this.cleanupHandle = setInterval(() => this.cleanupRooms(), 3000);
  }

  stop() {
    clearInterval(this.tickHandle);
    clearInterval(this.cleanupHandle);
  }

  bindSocket(socket) {
    socket.on("create_room", (payload = {}) => this.createRoom(socket, payload));
    socket.on("join_room", (payload = {}) => this.joinRoom(socket, payload));
    socket.on("find_match", (payload = {}) => this.findMatch(socket, payload));
    socket.on("cancel_matchmaking", () => this.cancelMatchmaking(socket));
    socket.on("start_ai_match", (payload = {}) => this.startAIMatch(socket, payload));
    socket.on("resume_session", (payload = {}) => this.resumeSession(socket, payload));
    socket.on("toggle_ready", () => this.toggleReady(socket));
    socket.on("start_game", () => this.startGame(socket));
    socket.on("select_paddle", (payload = {}) => this.selectPaddle(socket, payload));
    socket.on("player_input", (payload = {}) => this.playerInput(socket, payload));
    socket.on("activate_ultimate", () => this.activateUltimate(socket));
    socket.on("send_reaction", (payload = {}) => this.sendReaction(socket, payload));
    socket.on("request_rematch", () => this.requestRematch(socket));
    socket.on("return_to_lobby", () => this.returnToLobby(socket));
    socket.on("voice_offer", (payload = {}) => this.relayVoiceSignal(socket, "voice_offer", payload));
    socket.on("voice_answer", (payload = {}) => this.relayVoiceSignal(socket, "voice_answer", payload));
    socket.on("voice_ice_candidate", (payload = {}) =>
      this.relayVoiceSignal(socket, "voice_ice_candidate", payload)
    );
    socket.on("voice_mute_state", (payload = {}) => this.relayVoiceSignal(socket, "voice_mute_state", payload));
    socket.on("leave_room", () => this.leaveRoom(socket));
    socket.on("disconnect", () => this.handleDisconnect(socket));
  }

  sendError(socket, message) {
    socket.emit("error_msg", { message });
  }

  createRoomState({ modeKey, winningScore }) {
    const mode = MODES[modeKey];
    const roomCode = createRoomCode(new Set(this.rooms.keys()));
    const now = Date.now();
    return {
      code: roomCode,
      modeKey,
      mode,
      winningScore: clamp(Number(winningScore || this.defaultWinningScore), MIN_WINNING_SCORE, MAX_WINNING_SCORE),
      createdAt: now,
      lastActiveAt: now,
      status: "lobby",
      countdownEndAt: 0,
      matchStartAt: 0,
      finishedAt: 0,
      serveLockUntil: 0,
      scores: { left: 0, right: 0 },
      winner: null,
      ball: createBall(),
      powerUps: [],
      nextPowerUpAt: now + randomInt(POWERUP_SPAWN_MIN_MS, POWERUP_SPAWN_MAX_MS),
      players: new Map(),
      spectators: new Map(),
      hostId: null,
      rematchVotes: new Set(),
      matchHistory: [],
      lastImpact: null,
      lastBroadcastAt: 0,
      lastUpdateAt: now,
    };
  }

  createRoom(socket, payload) {
    this.cancelMatchmaking(socket, { silent: true });
    this.leaveRoom(socket, { silent: true });

    const modeKey = modeFromKey(payload.mode);
    const room = this.createRoomState({
      modeKey,
      winningScore: payload.winningScore,
    });

    this.rooms.set(room.code, room);

    const joined = this.addPlayerToRoom(socket, room, {
      name: payload.name,
      paddleStyle: payload.paddleStyle,
      avatar: payload.avatar,
      sessionId: payload.sessionId,
      isHost: true,
    });

    if (!joined) {
      this.rooms.delete(room.code);
      this.sendError(socket, "Unable to create room right now.");
      return;
    }

    socket.emit("room_created", {
      code: room.code,
      playerId: joined.id,
      sessionId: joined.sessionId,
    });

    socket.emit("room_joined", {
      code: room.code,
      playerId: joined.id,
      spectator: false,
      room: this.serializeRoom(room),
    });
  }

  joinRoom(socket, payload) {
    this.cancelMatchmaking(socket, { silent: true });
    this.leaveRoom(socket, { silent: true });

    const roomCode = String(payload.code || "").trim().toUpperCase();
    const room = this.rooms.get(roomCode);
    if (!room) {
      this.sendError(socket, "Room not found.");
      return;
    }

    room.lastActiveAt = Date.now();

    const sessionId = String(payload.sessionId || "").trim();
    const rejoined = this.rejoinPlayerIfPossible(socket, room, sessionId);
    if (rejoined) {
      socket.emit("room_joined", {
        code: room.code,
        playerId: rejoined.id,
        spectator: false,
        room: this.serializeRoom(room),
      });
      this.emitRoomUpdate(room);
      return;
    }

    const canAcceptPlayers = room.status === "lobby";
    const assign = this.findOpenSlot(room);
    const wantsSpectator = Boolean(payload.asSpectator);

    if ((wantsSpectator || !assign || !canAcceptPlayers) && !canAcceptPlayers && !wantsSpectator) {
      this.sendError(socket, "Match already started. Join as spectator.");
      return;
    }

    if (wantsSpectator || !assign || !canAcceptPlayers) {
      const spectator = this.addSpectatorToRoom(socket, room, payload);
      socket.emit("room_joined", {
        code: room.code,
        playerId: spectator.id,
        spectator: true,
        room: this.serializeRoom(room),
      });
      this.emitRoomUpdate(room);
      return;
    }

    const player = this.addPlayerToRoom(socket, room, {
      name: payload.name,
      paddleStyle: payload.paddleStyle,
      avatar: payload.avatar,
      sessionId,
      isHost: room.players.size === 0,
    });

    if (!player) {
      this.sendError(socket, "Unable to join this room.");
      return;
    }

    socket.emit("room_joined", {
      code: room.code,
      playerId: player.id,
      spectator: false,
      room: this.serializeRoom(room),
    });

    this.emitRoomUpdate(room);
  }

  getQueue(modeKey) {
    if (!this.matchmakingQueues.has(modeKey)) {
      this.matchmakingQueues.set(modeKey, []);
    }
    return this.matchmakingQueues.get(modeKey);
  }

  cancelMatchmaking(socket, options = {}) {
    let removed = false;
    for (const [modeKey, queue] of this.matchmakingQueues.entries()) {
      const nextQueue = [];
      for (const entry of queue) {
        if (entry.socketId === socket.id) {
          removed = true;
          clearTimeout(entry.aiTimer);
        } else {
          nextQueue.push(entry);
        }
      }
      this.matchmakingQueues.set(modeKey, nextQueue);
    }

    if (removed && !options.silent) {
      socket.emit("matchmaking_status", { status: "canceled" });
    }
  }

  findMatch(socket, payload) {
    this.cancelMatchmaking(socket, { silent: true });
    this.leaveRoom(socket, { silent: true });

    const modeKey = modeFromKey(payload.mode || "1v1");
    const queue = this.getQueue(modeKey);
    const entry = {
      socketId: socket.id,
      modeKey,
      queuedAt: Date.now(),
      aiFallback: payload.aiFallback !== false,
      aiDifficulty: AI_DIFFICULTY[payload.aiDifficulty] ? payload.aiDifficulty : "medium",
      profile: {
        sessionId: payload.sessionId,
        name: payload.name,
        avatar: payload.avatar,
        paddleStyle: payload.paddleStyle,
        winningScore: payload.winningScore,
      },
      aiTimer: null,
    };

    queue.push(entry);

    socket.emit("matchmaking_status", {
      status: "searching",
      modeKey,
      queuedCount: queue.length,
      queuedAt: entry.queuedAt,
    });

    if (entry.aiFallback && modeKey === "1v1") {
      entry.aiTimer = setTimeout(() => {
        const stillQueued = this.getQueue(modeKey).some((item) => item.socketId === socket.id);
        if (!stillQueued) {
          return;
        }
        this.cancelMatchmaking(socket, { silent: true });
        socket.emit("matchmaking_status", { status: "fallback_ai" });
        this.startAIMatch(socket, {
          ...entry.profile,
          difficulty: entry.aiDifficulty,
          fromMatchmaking: true,
        });
      }, 8000);
    }

    this.tryMatchmake(modeKey);
  }

  tryMatchmake(modeKey) {
    const mode = MODES[modeKey];
    if (!mode) {
      return;
    }

    const needed = requiredPlayers(mode);
    const queue = this.getQueue(modeKey);

    while (queue.length >= needed) {
      const entries = queue.splice(0, needed);
      for (const entry of entries) {
        clearTimeout(entry.aiTimer);
      }
      this.createMatchFromQueue(entries, modeKey);
    }
  }

  createMatchFromQueue(entries, modeKey) {
    const liveEntries = entries.filter((entry) => this.io.sockets.sockets.get(entry.socketId));
    const requiredCount = requiredPlayers(MODES[modeKey]);
    if (liveEntries.length < requiredCount) {
      for (const entry of liveEntries) {
        this.getQueue(modeKey).push(entry);
      }
      return;
    }

    const room = this.createRoomState({
      modeKey,
      winningScore: liveEntries[0]?.profile?.winningScore || this.defaultWinningScore,
    });
    this.rooms.set(room.code, room);

    const joinedPlayers = [];
    for (const entry of liveEntries) {
      const socket = this.io.sockets.sockets.get(entry.socketId);
      if (!socket) {
        continue;
      }
      const player = this.addPlayerToRoom(socket, room, {
        ...entry.profile,
        isHost: joinedPlayers.length === 0,
      });
      if (player) {
        joinedPlayers.push({ socket, player });
      }
    }

    if (joinedPlayers.length < requiredCount) {
      for (const joined of joinedPlayers) {
        this.leaveRoom(joined.socket, { silent: true });
      }
      this.rooms.delete(room.code);
      return;
    }

    joinedPlayers.forEach(({ player }) => {
      player.ready = true;
    });

    this.prepareMatch(room);
    room.status = "countdown";
    room.countdownEndAt = Date.now() + COUNTDOWN_MS;
    room.lastActiveAt = Date.now();

    this.io.to(room.code).emit("countdown_started", { countdownMs: COUNTDOWN_MS });

    for (const joined of joinedPlayers) {
      joined.socket.emit("matchmaking_status", { status: "match_found", roomCode: room.code, modeKey });
      joined.socket.emit("room_joined", {
        code: room.code,
        playerId: joined.player.id,
        spectator: false,
        room: this.serializeRoom(room),
      });
    }
  }

  startAIMatch(socket, payload = {}) {
    this.cancelMatchmaking(socket, { silent: true });
    this.leaveRoom(socket, { silent: true });

    const room = this.createRoomState({
      modeKey: "1v1",
      winningScore: payload.winningScore || this.defaultWinningScore,
    });
    this.rooms.set(room.code, room);

    const human = this.addPlayerToRoom(socket, room, {
      sessionId: payload.sessionId,
      name: payload.name,
      avatar: payload.avatar,
      paddleStyle: payload.paddleStyle,
      isHost: true,
    });

    if (!human) {
      this.rooms.delete(room.code);
      this.sendError(socket, "Unable to create AI match.");
      return;
    }

    const difficulty = AI_DIFFICULTY[payload.difficulty] ? payload.difficulty : "medium";
    const bot = this.addBotToRoom(room, { difficulty });
    if (!bot) {
      this.leaveRoom(socket, { silent: true });
      this.rooms.delete(room.code);
      this.sendError(socket, "Unable to initialize AI opponent.");
      return;
    }

    human.ready = true;
    bot.ready = true;
    this.prepareMatch(room);
    room.status = "countdown";
    room.countdownEndAt = Date.now() + COUNTDOWN_MS;
    room.lastActiveAt = Date.now();

    socket.emit("matchmaking_status", {
      status: payload.fromMatchmaking ? "fallback_ready" : "ai_ready",
      roomCode: room.code,
      difficulty,
    });
    socket.emit("room_joined", {
      code: room.code,
      playerId: human.id,
      spectator: false,
      room: this.serializeRoom(room),
    });
    this.io.to(room.code).emit("countdown_started", { countdownMs: COUNTDOWN_MS });
  }

  activateUltimate(socket) {
    const participant = this.socketIndex.get(socket.id);
    if (!participant || participant.role !== "player") {
      return;
    }

    const room = this.rooms.get(participant.roomCode);
    if (!room || room.status !== "live") {
      return;
    }

    const player = room.players.get(participant.id);
    if (!player || player.energy < 100) {
      return;
    }

    player.energy = 0;
    player.ultimateUntil = Date.now() + 3000;
    room.lastActiveAt = Date.now();

    this.io.to(room.code).emit("ultimate_activated", {
      playerId: player.id,
      expiresAt: player.ultimateUntil,
    });
  }

  relayVoiceSignal(socket, eventName, payload) {
    const participant = this.socketIndex.get(socket.id);
    if (!participant) {
      return;
    }
    const room = this.rooms.get(participant.roomCode);
    if (!room) {
      return;
    }

    const packet = { ...payload, fromId: participant.id };
    if (payload && payload.targetId) {
      const targetPlayer = room.players.get(payload.targetId);
      if (targetPlayer?.socketId) {
        this.io.to(targetPlayer.socketId).emit(eventName, packet);
      }
      return;
    }
    socket.to(room.code).emit(eventName, packet);
  }

  resumeSession(socket, payload) {
    const roomCode = String(payload.roomCode || "").trim().toUpperCase();
    const sessionId = String(payload.sessionId || "").trim();

    if (!roomCode || !sessionId) {
      return;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }

    const existingPlayer = this.findPlayerBySession(room, sessionId);
    if (existingPlayer) {
      this.bindPlayerSocket(room, existingPlayer, socket);
      socket.emit("room_joined", {
        code: room.code,
        playerId: existingPlayer.id,
        spectator: false,
        room: this.serializeRoom(room),
      });
      this.emitRoomUpdate(room);
      return;
    }

    const existingSpectator = this.findSpectatorBySession(room, sessionId);
    if (existingSpectator) {
      this.bindSpectatorSocket(room, existingSpectator, socket);
      socket.emit("room_joined", {
        code: room.code,
        playerId: existingSpectator.id,
        spectator: true,
        room: this.serializeRoom(room),
      });
      this.emitRoomUpdate(room);
    }
  }

  toggleReady(socket) {
    const participant = this.socketIndex.get(socket.id);
    if (!participant || participant.role !== "player") {
      return;
    }

    const room = this.rooms.get(participant.roomCode);
    if (!room || room.status !== "lobby") {
      return;
    }

    const player = room.players.get(participant.id);
    if (!player) {
      return;
    }

    player.ready = !player.ready;
    room.lastActiveAt = Date.now();

    if (this.canStartMatch(room)) {
      this.prepareMatch(room);
      room.status = "countdown";
      room.countdownEndAt = Date.now() + COUNTDOWN_MS;
      this.io.to(room.code).emit("countdown_started", { countdownMs: COUNTDOWN_MS });
    }

    this.emitRoomUpdate(room);
  }

  startGame(socket) {
    const participant = this.socketIndex.get(socket.id);
    if (!participant || participant.role !== "player") {
      return;
    }

    const room = this.rooms.get(participant.roomCode);
    if (!room || room.status !== "lobby") {
      return;
    }

    const caller = room.players.get(participant.id);
    if (!caller || !caller.isHost) {
      this.sendError(socket, "Only the host can start the game.");
      return;
    }

    if (!this.canStartMatch(room)) {
      this.sendError(socket, "All player slots must be filled and marked ready.");
      return;
    }

    this.prepareMatch(room);
    room.status = "countdown";
    room.countdownEndAt = Date.now() + COUNTDOWN_MS;
    room.lastActiveAt = Date.now();

    this.io.to(room.code).emit("countdown_started", { countdownMs: COUNTDOWN_MS });
    this.emitRoomUpdate(room);
  }

  selectPaddle(socket, payload) {
    const participant = this.socketIndex.get(socket.id);
    if (!participant || participant.role !== "player") {
      return;
    }

    const room = this.rooms.get(participant.roomCode);
    if (!room) {
      return;
    }

    const player = room.players.get(participant.id);
    if (!player) {
      return;
    }

    const style = PADDLE_STYLES[payload.paddleStyle] ? payload.paddleStyle : "Neon Paddle";
    player.paddleStyle = style;

    room.lastActiveAt = Date.now();
    this.emitRoomUpdate(room);
  }

  playerInput(socket, payload) {
    const participant = this.socketIndex.get(socket.id);
    if (!participant || participant.role !== "player") {
      return;
    }

    const room = this.rooms.get(participant.roomCode);
    if (!room || (room.status !== "live" && room.status !== "countdown")) {
      return;
    }

    const player = room.players.get(participant.id);
    if (!player) {
      return;
    }

    player.paddle.inputDir = clamp(Number(payload.direction || 0), -1, 1);

    if (typeof payload.targetY === "number" && Number.isFinite(payload.targetY)) {
      player.paddle.targetY = clamp(payload.targetY, 0, 1);
      player.paddle.lastInputAt = Date.now();
    }

    if (payload.targetY === null) {
      player.paddle.targetY = null;
    }
  }

  sendReaction(socket, payload) {
    const participant = this.socketIndex.get(socket.id);
    if (!participant || participant.role !== "player") {
      return;
    }

    const room = this.rooms.get(participant.roomCode);
    if (!room || (room.status !== "live" && room.status !== "countdown")) {
      return;
    }

    const player = room.players.get(participant.id);
    if (!player) {
      return;
    }

    const type = payload.type === "roast" ? "roast" : "emoji";
    const value = String(payload.value || "").trim();
    const allowed = type === "emoji" ? EMOJIS : ROASTS;
    if (!allowed.includes(value)) {
      return;
    }

    player.reaction = {
      type,
      value,
      expiresAt: Date.now() + REACTION_TTL_MS,
    };
    player.stats.reactions += 1;
    room.lastActiveAt = Date.now();

    this.emitRoomUpdate(room);
  }

  requestRematch(socket) {
    const participant = this.socketIndex.get(socket.id);
    if (!participant || participant.role !== "player") {
      return;
    }

    const room = this.rooms.get(participant.roomCode);
    if (!room || room.status !== "finished") {
      return;
    }

    room.rematchVotes.add(participant.id);
    room.lastActiveAt = Date.now();

    if (room.rematchVotes.size >= room.players.size && room.players.size > 0) {
      this.resetToLobby(room);
      this.emitRoomUpdate(room);
      return;
    }

    this.emitRoomUpdate(room);
  }

  returnToLobby(socket) {
    const participant = this.socketIndex.get(socket.id);
    if (!participant || participant.role !== "player") {
      return;
    }

    const room = this.rooms.get(participant.roomCode);
    if (!room || room.status !== "finished") {
      return;
    }

    const player = room.players.get(participant.id);
    if (!player || !player.isHost) {
      this.sendError(socket, "Only the host can return to lobby.");
      return;
    }

    this.resetToLobby(room);
    this.emitRoomUpdate(room);
  }

  leaveRoom(socket, options = {}) {
    this.cancelMatchmaking(socket, { silent: true });
    const participant = this.socketIndex.get(socket.id);
    if (!participant) {
      return;
    }

    const room = this.rooms.get(participant.roomCode);
    if (!room) {
      this.socketIndex.delete(socket.id);
      return;
    }

    if (participant.role === "player") {
      room.players.delete(participant.id);
      this.reassignHost(room);
    } else {
      room.spectators.delete(participant.id);
    }

    socket.leave(room.code);
    this.socketIndex.delete(socket.id);
    room.lastActiveAt = Date.now();

    if (!this.hasHumanPlayers(room) && room.spectators.size === 0) {
      this.rooms.delete(room.code);
      return;
    }

    if (!options.silent) {
      this.emitRoomUpdate(room);
    }
  }

  handleDisconnect(socket) {
    this.cancelMatchmaking(socket, { silent: true });
    const participant = this.socketIndex.get(socket.id);
    if (!participant) {
      return;
    }

    const room = this.rooms.get(participant.roomCode);
    if (!room) {
      this.socketIndex.delete(socket.id);
      return;
    }

    if (participant.role === "player") {
      const player = room.players.get(participant.id);
      if (player) {
        player.connected = false;
        player.disconnectedAt = Date.now();
        player.socketId = null;
        player.ready = false;
        player.paddle.inputDir = 0;
        player.paddle.targetY = null;
      }
      this.reassignHost(room);
    } else {
      room.spectators.delete(participant.id);
    }

    this.socketIndex.delete(socket.id);
    room.lastActiveAt = Date.now();

    if (room.status === "lobby") {
      this.emitRoomUpdate(room);
    }
  }

  tick() {
    const now = Date.now();
    const broadcastInterval = 1000 / BROADCAST_RATE;

    for (const room of this.rooms.values()) {
      const dt = clamp((now - room.lastUpdateAt) / 1000, 0.001, 0.05);
      room.lastUpdateAt = now;

      this.updateRoom(room, now, dt);

      if (now - room.lastBroadcastAt >= broadcastInterval) {
        if (room.status === "lobby") {
          continue;
        }
        room.lastBroadcastAt = now;
        this.io.to(room.code).emit("game_state", this.serializeRoom(room, now));
      }
    }
  }

  updateRoom(room, now, dt) {
    if (room.status === "countdown" && now >= room.countdownEndAt) {
      room.status = "live";
      room.matchStartAt = now;
      room.serveLockUntil = now + SERVE_LOCK_MS;
      room.nextPowerUpAt = now + randomInt(POWERUP_SPAWN_MIN_MS, POWERUP_SPAWN_MAX_MS);
      room.lastActiveAt = now;
      this.emitRoomUpdate(room);
    }

    for (const player of room.players.values()) {
      if (player.reaction && player.reaction.expiresAt <= now) {
        player.reaction = null;
      }

      if (player.isBot) {
        this.updateBotControl(room, player, now);
      }

      this.updatePaddle(player, room, now, dt);
    }

    if (room.status !== "live") {
      room.powerUps = room.powerUps.filter((item) => item.expiresAt > now);
      return;
    }

    room.powerUps = room.powerUps.filter((item) => item.expiresAt > now);

    if (now >= room.nextPowerUpAt) {
      this.spawnPowerUp(room, now);
    }

    if (now < room.serveLockUntil) {
      return;
    }

    this.updateBall(room, now, dt);
  }

  updatePaddle(player, room, now, dt) {
    if (room.status !== "live" && room.status !== "countdown") {
      return;
    }

    if (now < player.freezeUntil) {
      return;
    }

    let speed = PADDLE_BASE_SPEED;
    if (now < player.speedBoostUntil) {
      speed *= 1.45;
    }
    if (player.isBot && player.ai) {
      speed *= AI_DIFFICULTY[player.ai.difficulty]?.speedScale || 1;
    }

    if (player.paddle.targetY !== null && now - player.paddle.lastInputAt <= 140) {
      const target = player.paddle.targetY * ARENA_HEIGHT;
      const delta = target - player.paddle.y;
      const step = clamp(delta, -speed * dt, speed * dt);
      player.paddle.y += step;
    } else {
      player.paddle.y += player.paddle.inputDir * speed * dt;
    }

    const limitTop = player.paddle.height / 2;
    const limitBottom = ARENA_HEIGHT - player.paddle.height / 2;
    player.paddle.y = clamp(player.paddle.y, limitTop, limitBottom);
  }

  updateBotControl(room, bot, now) {
    if (!bot.ai || room.status === "finished") {
      return;
    }

    if ((bot.energy || 0) >= 100 && now > (bot.ultimateUntil || 0) + 200) {
      bot.energy = 0;
      bot.ultimateUntil = now + 3000;
    }

    const config = AI_DIFFICULTY[bot.ai.difficulty] || AI_DIFFICULTY.medium;
    if (now - bot.ai.lastThinkAt < config.reactMs) {
      return;
    }

    bot.ai.lastThinkAt = now;
    const ball = room.ball;
    const headingTowardBot = bot.team === "left" ? ball.vx < 0 : ball.vx > 0;
    let targetY = ARENA_HEIGHT / 2;

    if (headingTowardBot && Math.abs(ball.vx) > 1) {
      const t = Math.abs((bot.paddle.x - ball.x) / ball.vx);
      const projected = ball.y + ball.vy * t;
      targetY = reflectY(projected, ball.radius, ARENA_HEIGHT - ball.radius);
    } else {
      targetY = ARENA_HEIGHT / 2 + Math.sin(now / 900) * 50;
    }

    const error = randomFloat(-config.errorRange, config.errorRange);
    targetY = clamp(targetY + error, bot.paddle.height / 2, ARENA_HEIGHT - bot.paddle.height / 2);
    bot.paddle.targetY = targetY / ARENA_HEIGHT;
    bot.paddle.lastInputAt = now;
  }

  updateBall(room, now, dt) {
    const ball = room.ball;

    if (now < ball.curveUntil) {
      const t = (now - ball.curveStartAt) / 1000;
      const curve = Math.sin(t * 8 + ball.curvePhase) * ball.curveAmplitude;
      ball.vy += curve * dt;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    }

    if (ball.y + ball.radius >= ARENA_HEIGHT) {
      ball.y = ARENA_HEIGHT - ball.radius;
      ball.vy = -Math.abs(ball.vy);
    }

    const players = [...room.players.values()];
    players.sort((a, b) => Math.abs(a.paddle.x - ball.x) - Math.abs(b.paddle.x - ball.x));

    for (const player of players) {
      const towardPaddle = player.team === "left" ? ball.vx < 0 : ball.vx > 0;
      if (!towardPaddle) {
        continue;
      }

      if (!circleRectCollision(ball, player.paddle)) {
        continue;
      }

      const contact = clamp((ball.y - player.paddle.y) / (player.paddle.height / 2), -1, 1);
      const bounceAngle = contact * MAX_BOUNCE_ANGLE;
      let speed = Math.min(MAX_BALL_SPEED, Math.hypot(ball.vx, ball.vy) * 1.035 + 16);

      if (now < player.powerSmashUntil) {
        speed = Math.min(MAX_BALL_SPEED + 200, speed + 190);
        player.powerSmashUntil = 0;
      }
      if (now < player.ultimateUntil) {
        speed = Math.min(MAX_BALL_SPEED + 260, speed + 260);
      }

      const direction = player.team === "left" ? 1 : -1;
      ball.vx = direction * speed * Math.cos(bounceAngle);
      ball.vy = speed * Math.sin(bounceAngle) + player.paddle.inputDir * 100;

      if (Math.abs(ball.vx) < 280) {
        ball.vx = direction * 280;
      }

      if (player.team === "left") {
        ball.x = player.paddle.x + player.paddle.width / 2 + ball.radius + 0.6;
      } else {
        ball.x = player.paddle.x - player.paddle.width / 2 - ball.radius - 0.6;
      }

      player.stats.hits += 1;
      player.energy = Math.min(100, (player.energy || 0) + 5);
      ball.lastHitPlayerId = player.id;
      ball.lastHitTeam = player.team;
      room.lastImpact = {
        id: uid("impact"),
        x: ball.x,
        y: ball.y,
        team: player.team,
        at: now,
      };
      break;
    }

    this.handlePowerUpPickup(room, now);

    if (ball.x < -ball.radius) {
      this.resolveGoal(room, "left", now);
      return;
    }

    if (ball.x > ARENA_WIDTH + ball.radius) {
      this.resolveGoal(room, "right", now);
    }
  }

  resolveGoal(room, concededTeam, now) {
    const ball = room.ball;

    const shieldOwner = [...room.players.values()].find(
      (player) => player.team === concededTeam && player.shieldCharges > 0
    );

    if (shieldOwner) {
      shieldOwner.shieldCharges -= 1;
      shieldOwner.stats.saves += 1;

      ball.x = concededTeam === "left" ? ball.radius + 22 : ARENA_WIDTH - ball.radius - 22;
      ball.vx = concededTeam === "left" ? Math.abs(ball.vx) + 140 : -Math.abs(ball.vx) - 140;
      ball.vy *= 0.9;

      room.lastImpact = {
        id: uid("shield"),
        x: ball.x,
        y: ball.y,
        team: concededTeam,
        at: now,
      };
      return;
    }

    const scoringTeam = concededTeam === "left" ? "right" : "left";
    room.scores[scoringTeam] += 1;

    const defender = this.closestDefender(room, concededTeam, ball.y);
    if (defender) {
      defender.stats.misses += 1;
    }

    this.io.to(room.code).emit("score_event", {
      scoringTeam,
      scores: room.scores,
    });

    if (room.scores[scoringTeam] >= room.winningScore) {
      this.endMatch(room, scoringTeam, now);
      return;
    }

    this.resetBall(room, concededTeam === "left" ? -1 : 1);
    room.serveLockUntil = now + SERVE_LOCK_MS;
    room.nextPowerUpAt = now + randomInt(POWERUP_SPAWN_MIN_MS, POWERUP_SPAWN_MAX_MS);
  }

  endMatch(room, winnerTeam, now) {
    room.status = "finished";
    room.winner = winnerTeam;
    room.finishedAt = now;
    room.countdownEndAt = 0;
    room.serveLockUntil = 0;
    room.rematchVotes.clear();

    const durationMs = room.matchStartAt ? now - room.matchStartAt : 0;
    room.matchHistory.unshift({
      id: uid("match"),
      at: now,
      winner: winnerTeam,
      scores: { ...room.scores },
      mode: room.modeKey,
      durationMs,
    });
    room.matchHistory = room.matchHistory.slice(0, 10);

    for (const player of room.players.values()) {
      player.ready = player.isBot ? true : false;
      player.paddle.inputDir = 0;
      player.paddle.targetY = null;
    }

    if (this.leaderboardStore) {
      this.leaderboardStore.recordMatch({
        winnerTeam,
        players: [...room.players.values()].map((player) => ({
          name: player.name,
          team: player.team,
          isBot: Boolean(player.isBot),
          isAi: Boolean(player.isAi),
        })),
      });
      this.io.emit("leaderboard_update", {
        updatedAt: now,
        entries: this.leaderboardStore.getTop(20),
      });
    }

    this.io.to(room.code).emit("game_over", this.serializeRoom(room, now));
    this.emitRoomUpdate(room);
  }

  resetBall(room, direction = randomChoice([-1, 1])) {
    room.ball = createBall(direction);
    room.ball.y = randomFloat(ARENA_HEIGHT * 0.28, ARENA_HEIGHT * 0.72);
  }

  prepareMatch(room) {
    room.scores = { left: 0, right: 0 };
    room.winner = null;
    room.finishedAt = 0;
    room.matchStartAt = 0;
    room.serveLockUntil = 0;
    room.powerUps = [];
    room.rematchVotes.clear();
    room.lastImpact = null;

    this.resetBall(room);

    const teamSlotCounts = {
      left: teamCapacity(room.mode, "left"),
      right: teamCapacity(room.mode, "right"),
    };

    for (const player of room.players.values()) {
      player.ready = true;
      player.shieldCharges = 0;
      player.energy = 0;
      player.ultimateUntil = 0;
      player.freezeUntil = 0;
      player.speedBoostUntil = 0;
      player.powerSmashUntil = 0;
      player.reaction = null;
      player.stats = {
        hits: 0,
        misses: 0,
        powerUps: 0,
        saves: 0,
        reactions: 0,
      };

      player.paddle.x = this.paddleX(player.team, player.slot, teamSlotCounts[player.team]);
      player.paddle.y = this.paddleSpawnY(player.slot, teamSlotCounts[player.team]);
      player.paddle.inputDir = 0;
      player.paddle.targetY = null;
      player.paddle.lastInputAt = 0;
      if (player.ai) {
        player.ai.lastThinkAt = 0;
      }
    }
  }

  resetToLobby(room) {
    room.status = "lobby";
    room.winner = null;
    room.finishedAt = 0;
    room.countdownEndAt = 0;
    room.matchStartAt = 0;
    room.scores = { left: 0, right: 0 };
    room.powerUps = [];
    room.rematchVotes.clear();
    room.lastImpact = null;
    room.serveLockUntil = 0;

    this.resetBall(room);

    const teamSlotCounts = {
      left: teamCapacity(room.mode, "left"),
      right: teamCapacity(room.mode, "right"),
    };

    for (const player of room.players.values()) {
      player.ready = player.isBot ? true : false;
      player.shieldCharges = 0;
      player.energy = 0;
      player.ultimateUntil = 0;
      player.freezeUntil = 0;
      player.speedBoostUntil = 0;
      player.powerSmashUntil = 0;
      player.reaction = null;
      player.paddle.inputDir = 0;
      player.paddle.targetY = null;
      player.paddle.x = this.paddleX(player.team, player.slot, teamSlotCounts[player.team]);
      player.paddle.y = this.paddleSpawnY(player.slot, teamSlotCounts[player.team]);
      if (player.ai) {
        player.ai.lastThinkAt = 0;
      }
    }
  }

  spawnPowerUp(room, now) {
    const type = randomChoice(Object.keys(POWERUPS));
    room.powerUps.push({
      id: uid("pow"),
      type,
      x: randomFloat(ARENA_WIDTH * 0.28, ARENA_WIDTH * 0.72),
      y: randomFloat(ARENA_HEIGHT * 0.16, ARENA_HEIGHT * 0.84),
      radius: 20,
      expiresAt: now + POWERUP_TTL_MS,
      spawnedAt: now,
    });

    room.nextPowerUpAt = now + randomInt(POWERUP_SPAWN_MIN_MS, POWERUP_SPAWN_MAX_MS);
  }

  handlePowerUpPickup(room, now) {
    const ball = room.ball;
    const remaining = [];

    for (const item of room.powerUps) {
      const dx = ball.x - item.x;
      const dy = ball.y - item.y;
      const collide = dx * dx + dy * dy <= (ball.radius + item.radius) * (ball.radius + item.radius);

      if (!collide) {
        remaining.push(item);
        continue;
      }

      const collector =
        room.players.get(ball.lastHitPlayerId) || randomChoice([...room.players.values()]) || null;
      if (!collector) {
        continue;
      }

      this.applyPowerUp(room, collector, item.type, now);

      this.io.to(room.code).emit("powerup_activated", {
        powerUp: item.type,
        byPlayerId: collector.id,
      });
    }

    room.powerUps = remaining;
  }

  applyPowerUp(room, collector, type, now) {
    const definition = POWERUPS[type];
    if (!definition) {
      return;
    }

    collector.stats.powerUps += 1;

    if (type === "speedBoost") {
      collector.speedBoostUntil = Math.max(collector.speedBoostUntil, now + definition.durationMs);
      return;
    }

    if (type === "powerSmash") {
      collector.powerSmashUntil = Math.max(collector.powerSmashUntil, now + definition.durationMs);
      return;
    }

    if (type === "shield") {
      collector.shieldCharges = Math.min(2, collector.shieldCharges + 1);
      return;
    }

    if (type === "curveBall") {
      room.ball.curveUntil = now + definition.durationMs;
      room.ball.curveStartAt = now;
      room.ball.curveAmplitude = 220;
      room.ball.curvePhase = Math.random() * Math.PI * 2;
      return;
    }

    if (type === "freezeOpponent") {
      const opponents = [...room.players.values()].filter((player) => player.team !== collector.team);
      if (opponents.length === 0) {
        return;
      }
      const target = randomChoice(opponents);
      target.freezeUntil = Math.max(target.freezeUntil, now + definition.durationMs);
    }
  }

  closestDefender(room, team, y) {
    const defenders = [...room.players.values()].filter((player) => player.team === team);
    if (defenders.length === 0) {
      return null;
    }

    defenders.sort((a, b) => Math.abs(a.paddle.y - y) - Math.abs(b.paddle.y - y));
    return defenders[0];
  }

  addPlayerToRoom(socket, room, payload) {
    const assignment = this.findOpenSlot(room);
    if (!assignment) {
      return null;
    }

    const sessionId = String(payload.sessionId || uid("session")).slice(0, 48);
    const existing = this.findPlayerBySession(room, sessionId);
    if (existing && existing.connected) {
      return null;
    }

    const teamSlots = teamCapacity(room.mode, assignment.team);
    const player = {
      id: uid("player"),
      sessionId,
      socketId: socket.id,
      name: normalizeName(payload.name, `Player ${room.players.size + 1}`),
      team: assignment.team,
      slot: assignment.slot,
      avatar: String(payload.avatar || randomChoice(DEFAULT_AVATARS)).slice(0, 3),
      paddleStyle: PADDLE_STYLES[payload.paddleStyle] ? payload.paddleStyle : "Neon Paddle",
      isHost: Boolean(payload.isHost),
      ready: false,
      connected: true,
      disconnectedAt: null,
      shieldCharges: 0,
      energy: 0,
      ultimateUntil: 0,
      freezeUntil: 0,
      speedBoostUntil: 0,
      powerSmashUntil: 0,
      isBot: false,
      isAi: false,
      ai: null,
      reaction: null,
      stats: {
        hits: 0,
        misses: 0,
        powerUps: 0,
        saves: 0,
        reactions: 0,
      },
      paddle: {
        x: this.paddleX(assignment.team, assignment.slot, teamSlots),
        y: this.paddleSpawnY(assignment.slot, teamSlots),
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
        inputDir: 0,
        targetY: null,
        lastInputAt: 0,
      },
    };

    room.players.set(player.id, player);
    socket.join(room.code);
    this.socketIndex.set(socket.id, {
      roomCode: room.code,
      role: "player",
      id: player.id,
    });

    if (!room.hostId || player.isHost) {
      room.hostId = player.id;
    }

    this.reassignHost(room);
    room.lastActiveAt = Date.now();

    return player;
  }

  addBotToRoom(room, options = {}) {
    const assignment = this.findOpenSlot(room);
    if (!assignment) {
      return null;
    }

    const difficulty = AI_DIFFICULTY[options.difficulty] ? options.difficulty : "medium";
    const teamSlots = teamCapacity(room.mode, assignment.team);
    const styleNames = Object.keys(PADDLE_STYLES);

    const bot = {
      id: uid("bot"),
      sessionId: uid("bot_session"),
      socketId: null,
      name: `AI ${difficulty[0].toUpperCase()}${difficulty.slice(1)}`,
      team: assignment.team,
      slot: assignment.slot,
      avatar: "\u{1F916}",
      paddleStyle: randomChoice(styleNames),
      isHost: false,
      ready: true,
      connected: true,
      disconnectedAt: null,
      shieldCharges: 0,
      energy: 0,
      ultimateUntil: 0,
      freezeUntil: 0,
      speedBoostUntil: 0,
      powerSmashUntil: 0,
      isBot: true,
      isAi: true,
      reaction: null,
      ai: {
        difficulty,
        lastThinkAt: 0,
      },
      stats: {
        hits: 0,
        misses: 0,
        powerUps: 0,
        saves: 0,
        reactions: 0,
      },
      paddle: {
        x: this.paddleX(assignment.team, assignment.slot, teamSlots),
        y: this.paddleSpawnY(assignment.slot, teamSlots),
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
        inputDir: 0,
        targetY: null,
        lastInputAt: 0,
      },
    };

    room.players.set(bot.id, bot);
    room.lastActiveAt = Date.now();
    return bot;
  }

  addSpectatorToRoom(socket, room, payload) {
    const sessionId = String(payload.sessionId || uid("session")).slice(0, 48);
    const existing = this.findSpectatorBySession(room, sessionId);
    if (existing) {
      this.bindSpectatorSocket(room, existing, socket);
      return existing;
    }

    const spectator = {
      id: uid("spec"),
      sessionId,
      name: normalizeName(payload.name, `Spectator ${room.spectators.size + 1}`),
      socketId: socket.id,
      connected: true,
    };

    room.spectators.set(spectator.id, spectator);
    this.bindSpectatorSocket(room, spectator, socket);
    room.lastActiveAt = Date.now();

    return spectator;
  }

  rejoinPlayerIfPossible(socket, room, sessionId) {
    if (!sessionId) {
      return null;
    }

    const player = this.findPlayerBySession(room, sessionId);
    if (!player) {
      return null;
    }

    if (player.connected && player.socketId && player.socketId !== socket.id) {
      return null;
    }

    this.bindPlayerSocket(room, player, socket);
    return player;
  }

  bindPlayerSocket(room, player, socket) {
    if (player.socketId && player.socketId !== socket.id) {
      const oldSocket = this.io.sockets.sockets.get(player.socketId);
      if (oldSocket) {
        oldSocket.leave(room.code);
        this.socketIndex.delete(oldSocket.id);
      }
    }

    player.socketId = socket.id;
    player.connected = true;
    player.disconnectedAt = null;

    socket.join(room.code);
    this.socketIndex.set(socket.id, {
      roomCode: room.code,
      role: "player",
      id: player.id,
    });

    room.lastActiveAt = Date.now();
    this.reassignHost(room);
  }

  bindSpectatorSocket(room, spectator, socket) {
    spectator.socketId = socket.id;
    spectator.connected = true;

    socket.join(room.code);
    this.socketIndex.set(socket.id, {
      roomCode: room.code,
      role: "spectator",
      id: spectator.id,
    });

    room.lastActiveAt = Date.now();
  }

  findOpenSlot(room) {
    const candidates = TEAM_ORDER.map((team) => {
      const cap = teamCapacity(room.mode, team);
      const current = [...room.players.values()].filter((player) => player.team === team).length;
      return {
        team,
        cap,
        current,
      };
    }).filter((entry) => entry.current < entry.cap);

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => {
      const ratioA = a.current / a.cap;
      const ratioB = b.current / b.cap;
      if (ratioA !== ratioB) {
        return ratioA - ratioB;
      }
      return TEAM_ORDER.indexOf(a.team) - TEAM_ORDER.indexOf(b.team);
    });

    const selected = candidates[0];
    const usedSlots = new Set(
      [...room.players.values()]
        .filter((player) => player.team === selected.team)
        .map((player) => player.slot)
    );

    let slot = 0;
    while (usedSlots.has(slot)) {
      slot += 1;
    }

    return {
      team: selected.team,
      slot,
    };
  }

  findPlayerBySession(room, sessionId) {
    if (!sessionId) {
      return null;
    }

    for (const player of room.players.values()) {
      if (player.sessionId === sessionId) {
        return player;
      }
    }

    return null;
  }

  findSpectatorBySession(room, sessionId) {
    if (!sessionId) {
      return null;
    }

    for (const spectator of room.spectators.values()) {
      if (spectator.sessionId === sessionId) {
        return spectator;
      }
    }

    return null;
  }

  paddleX(team, slot, slotsOnTeam) {
    const anchor = team === "left" ? 86 : ARENA_WIDTH - 86;
    const centeredSlot = slot - (slotsOnTeam - 1) / 2;
    const spacing = 42;
    return team === "left" ? anchor + centeredSlot * spacing : anchor - centeredSlot * spacing;
  }

  paddleSpawnY(slot, slotsOnTeam) {
    return (ARENA_HEIGHT * (slot + 1)) / (slotsOnTeam + 1);
  }

  hasHumanPlayers(room) {
    return [...room.players.values()].some((player) => !player.isBot);
  }

  canStartMatch(room) {
    if (room.status !== "lobby") {
      return false;
    }

    const required = requiredPlayers(room.mode);
    if (room.players.size !== required) {
      return false;
    }

    for (const player of room.players.values()) {
      if (!player.ready || !player.connected) {
        return false;
      }
    }

    return true;
  }

  reassignHost(room) {
    if (room.players.size === 0) {
      room.hostId = null;
      return;
    }

    let host = room.hostId ? room.players.get(room.hostId) : null;
    if (!host || !host.connected) {
      host = [...room.players.values()].find((player) => player.connected) || [...room.players.values()][0];
      room.hostId = host.id;
    }

    for (const player of room.players.values()) {
      player.isHost = player.id === room.hostId;
    }
  }

  emitRoomUpdate(room) {
    this.io.to(room.code).emit("room_update", this.serializeRoom(room));
  }

  serializeRoom(room, now = Date.now()) {
    const players = [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      slot: player.slot,
      avatar: player.avatar,
      paddleStyle: player.paddleStyle,
      ready: player.ready,
      connected: player.connected,
      isHost: player.isHost,
      isBot: Boolean(player.isBot),
      isAi: Boolean(player.isAi),
      aiDifficulty: player.ai?.difficulty || null,
      shieldCharges: player.shieldCharges,
      energy: player.energy || 0,
      ultimateMs: Math.max(0, (player.ultimateUntil || 0) - now),
      reaction:
        player.reaction && player.reaction.expiresAt > now
          ? {
              type: player.reaction.type,
              value: player.reaction.value,
              expiresAt: player.reaction.expiresAt,
            }
          : null,
      effects: {
        speedBoostMs: Math.max(0, player.speedBoostUntil - now),
        powerSmashMs: Math.max(0, player.powerSmashUntil - now),
        freezeMs: Math.max(0, player.freezeUntil - now),
      },
      stats: { ...player.stats },
      paddle: {
        x: player.paddle.x,
        y: player.paddle.y,
        width: player.paddle.width,
        height: player.paddle.height,
      },
    }));

    const spectators = [...room.spectators.values()].map((spectator) => ({
      id: spectator.id,
      name: spectator.name,
      connected: spectator.connected,
    }));

    return {
      code: room.code,
      modeKey: room.modeKey,
      mode: room.mode,
      status: room.status,
      winningScore: room.winningScore,
      scores: { ...room.scores },
      winner: room.winner,
      requiredPlayers: requiredPlayers(room.mode),
      canStart: this.canStartMatch(room),
      rematchVotes: room.rematchVotes.size,
      players,
      spectators,
      ball: {
        x: room.ball.x,
        y: room.ball.y,
        vx: room.ball.vx,
        vy: room.ball.vy,
        radius: room.ball.radius,
        curveMs: Math.max(0, room.ball.curveUntil - now),
      },
      powerUps: room.powerUps.map((item) => ({
        id: item.id,
        type: item.type,
        x: item.x,
        y: item.y,
        radius: item.radius,
        expiresAt: item.expiresAt,
      })),
      nextPowerUpInMs: Math.max(0, room.nextPowerUpAt - now),
      countdownMs: room.status === "countdown" ? Math.max(0, room.countdownEndAt - now) : 0,
      timerMs: room.status === "live" ? Math.max(0, now - room.matchStartAt) : 0,
      serveLockMs: room.status === "live" ? Math.max(0, room.serveLockUntil - now) : 0,
      arena: {
        width: ARENA_WIDTH,
        height: ARENA_HEIGHT,
      },
      paddleStyles: PADDLE_STYLES,
      powerUpDefs: POWERUPS,
      emojis: EMOJIS,
      roasts: ROASTS,
      lastImpact: room.lastImpact,
      hostId: room.hostId,
      matchHistory: room.matchHistory,
    };
  }

  cleanupRooms() {
    const now = Date.now();

    for (const [code, room] of this.rooms.entries()) {
      let removedPlayer = false;

      for (const [playerId, player] of room.players.entries()) {
        if (!player.connected && player.disconnectedAt && now - player.disconnectedAt > DISCONNECT_GRACE_MS) {
          room.players.delete(playerId);
          removedPlayer = true;
        }
      }

      if (removedPlayer) {
        this.reassignHost(room);
        this.emitRoomUpdate(room);
      }

      if (room.status === "live") {
        const leftCount = [...room.players.values()].filter((player) => player.team === "left").length;
        const rightCount = [...room.players.values()].filter((player) => player.team === "right").length;

        if (leftCount === 0 || rightCount === 0) {
          const winner = leftCount > 0 ? "left" : "right";
          this.endMatch(room, winner, now);
        }
      }

      if (
        (!this.hasHumanPlayers(room) || room.players.size === 0) &&
        room.spectators.size === 0 &&
        now - room.lastActiveAt > DISCONNECT_GRACE_MS
      ) {
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = {
  ArenaServer,
};
