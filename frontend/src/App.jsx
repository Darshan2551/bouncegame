import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import LandingPage from "./components/LandingPage";
import ModeSelection from "./components/ModeSelection";
import JoinPanel from "./components/JoinPanel";
import HowToPanel from "./components/HowToPanel";
import LobbyScreen from "./components/LobbyScreen";
import GameScreen from "./components/GameScreen";
import MatchmakingPanel from "./components/MatchmakingPanel";
import AISetupPanel from "./components/AISetupPanel";
import LeaderboardPanel from "./components/LeaderboardPanel";

import { createSocket } from "./lib/socket";
import { ensureSessionId, getSavedRoomCode, saveRoomCode } from "./lib/session";
import { AVATARS } from "./lib/constants";
import { soundManager } from "./lib/soundManager";

const initialProfile = {
  name: "Player",
  avatar: AVATARS[0],
  paddleStyle: "Neon Paddle",
  winningScore: 10,
};

export default function App() {
  const [view, setView] = useState("landing");
  const [profile, setProfile] = useState(initialProfile);
  const [joinCode, setJoinCode] = useState(getSavedRoomCode());

  const [connection, setConnection] = useState("Connecting...");
  const [errorMessage, setErrorMessage] = useState("");

  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState("");
  const [isSpectator, setIsSpectator] = useState(false);
  const [queueMode, setQueueMode] = useState("1v1");
  const [fallbackToAI, setFallbackToAI] = useState(true);
  const [aiLevel, setAiLevel] = useState("medium");
  const [matchmakingStatus, setMatchmakingStatus] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const socketRef = useRef(null);
  const roomRef = useRef(null);
  const sessionId = useMemo(() => ensureSessionId(), []);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    let removed = false;

    const tryUnlock = () => {
      void soundManager.unlock().then((unlocked) => {
        if (unlocked) {
          removeUnlockListeners();
        }
      });
    };

    const removeUnlockListeners = () => {
      if (removed) {
        return;
      }
      removed = true;
      window.removeEventListener("pointerdown", tryUnlock);
      window.removeEventListener("touchstart", tryUnlock);
      window.removeEventListener("click", tryUnlock);
      window.removeEventListener("keydown", tryUnlock);
    };

    void soundManager.preload();
    window.addEventListener("pointerdown", tryUnlock);
    window.addEventListener("touchstart", tryUnlock);
    window.addEventListener("click", tryUnlock);
    window.addEventListener("keydown", tryUnlock);

    return () => {
      removeUnlockListeners();
    };
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const response = await fetch("/api/leaderboard?limit=30");
      const payload = await response.json();
      setLeaderboard(Array.isArray(payload.entries) ? payload.entries : []);
    } catch (_error) {
      setErrorMessage("Unable to load leaderboard right now.");
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnection("Online");
      const roomCode = roomRef.current?.code || getSavedRoomCode();
      if (roomCode) {
        socket.emit("resume_session", { roomCode, sessionId });
      }
    });

    socket.on("disconnect", () => {
      setConnection("Reconnecting...");
    });

    socket.on("room_joined", (payload) => {
      setRoom(payload.room);
      setPlayerId(payload.playerId);
      setIsSpectator(Boolean(payload.spectator));
      saveRoomCode(payload.code);
      setJoinCode(payload.code);
      setView("room");
      setMatchmakingStatus(null);
      setErrorMessage("");
    });

    socket.on("room_update", (payload) => {
      setRoom((current) => {
        if (
          current &&
          current.status !== "lobby" &&
          payload &&
          payload.status !== "lobby" &&
          payload.status !== "finished"
        ) {
          return current;
        }
        return payload;
      });
    });

    socket.on("game_state", (payload) => {
      setRoom(payload);
    });

    socket.on("game_over", (payload) => {
      setRoom(payload);
    });

    socket.on("matchmaking_status", (payload) => {
      setMatchmakingStatus(payload || null);
    });

    socket.on("leaderboard_update", (payload) => {
      if (Array.isArray(payload?.entries)) {
        setLeaderboard(payload.entries);
      }
    });

    socket.on("error_msg", ({ message }) => {
      setErrorMessage(message || "Something went wrong.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!errorMessage) {
      return undefined;
    }
    const timer = setTimeout(() => setErrorMessage(""), 3200);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  const emit = useCallback((event, payload) => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }
    socket.emit(event, payload);
  }, []);

  const createRoom = useCallback(
    (mode) => {
      emit("create_room", {
        mode,
        sessionId,
        name: profile.name,
        avatar: profile.avatar,
        paddleStyle: profile.paddleStyle,
        winningScore: profile.winningScore,
      });
    },
    [emit, profile, sessionId]
  );

  const joinRoom = useCallback(
    (asSpectator) => {
      const code = joinCode.trim().toUpperCase();
      if (!code) {
        setErrorMessage("Enter a room code.");
        return;
      }
      emit("join_room", {
        code,
        asSpectator,
        sessionId,
        name: profile.name,
        avatar: profile.avatar,
        paddleStyle: profile.paddleStyle,
      });
    },
    [emit, joinCode, profile, sessionId]
  );

  const findOnlineMatch = useCallback(() => {
    setMatchmakingStatus({ status: "searching", modeKey: queueMode });
    emit("find_match", {
      mode: queueMode,
      aiFallback: fallbackToAI,
      aiDifficulty: aiLevel,
      sessionId,
      name: profile.name,
      avatar: profile.avatar,
      paddleStyle: profile.paddleStyle,
      winningScore: profile.winningScore,
    });
  }, [aiLevel, emit, fallbackToAI, profile, queueMode, sessionId]);

  const cancelQueue = useCallback(() => {
    emit("cancel_matchmaking");
    setMatchmakingStatus({ status: "canceled" });
  }, [emit]);

  const startAIMatch = useCallback(() => {
    emit("start_ai_match", {
      difficulty: aiLevel,
      sessionId,
      name: profile.name,
      avatar: profile.avatar,
      paddleStyle: profile.paddleStyle,
      winningScore: profile.winningScore,
    });
  }, [aiLevel, emit, profile, sessionId]);

  const activateUltimate = useCallback(() => {
    emit("activate_ultimate");
  }, [emit]);

  const leaveRoom = useCallback(() => {
    emit("leave_room");
    emit("cancel_matchmaking");
    saveRoomCode("");
    setRoom(null);
    roomRef.current = null;
    setPlayerId("");
    setIsSpectator(false);
    setMatchmakingStatus(null);
    setView("landing");
  }, [emit]);

  const showError = Boolean(errorMessage);

  if (room && room.status !== "lobby") {
    return (
      <div>
        {showError && (
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border border-rose-300/50 bg-rose-900/70 px-4 py-2 text-sm text-rose-100">
            {errorMessage}
          </div>
        )}
        <GameScreen
          room={room}
          playerId={playerId}
          isSpectator={isSpectator}
          onSendInput={(payload) => emit("player_input", payload)}
          onSendReaction={(type, value) => emit("send_reaction", { type, value })}
          onActivateUltimate={activateUltimate}
          onRematch={() => emit("request_rematch")}
          onReturnLobby={() => emit("return_to_lobby")}
          onLeave={leaveRoom}
        />
      </div>
    );
  }

  if (room && room.status === "lobby") {
    return (
      <div>
        {showError && (
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border border-rose-300/50 bg-rose-900/70 px-4 py-2 text-sm text-rose-100">
            {errorMessage}
          </div>
        )}
        <LobbyScreen
          room={room}
          playerId={playerId}
          isSpectator={isSpectator}
          onToggleReady={() => emit("toggle_ready")}
          onStart={() => emit("start_game")}
          onSelectPaddle={(paddleStyle) => emit("select_paddle", { paddleStyle })}
          onLeave={leaveRoom}
        />
      </div>
    );
  }

  return (
    <div>
      {showError && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border border-rose-300/50 bg-rose-900/70 px-4 py-2 text-sm text-rose-100">
          {errorMessage}
        </div>
      )}

      {view === "landing" && (
        <LandingPage
          onPlayOnline={() => setView("matchmaking")}
          onPlayAI={() => setView("ai")}
          onCreate={() => setView("mode")}
          onJoin={() => setView("join")}
          onLeaderboard={() => {
            setView("leaderboard");
            fetchLeaderboard();
          }}
          onHow={() => setView("how")}
          connection={connection}
        />
      )}

      {view === "mode" && (
        <ModeSelection
          profile={profile}
          onProfileChange={setProfile}
          onSelectMode={createRoom}
          onBack={() => setView("landing")}
        />
      )}

      {view === "join" && (
        <JoinPanel
          profile={profile}
          onProfileChange={setProfile}
          roomCode={joinCode}
          onRoomCodeChange={setJoinCode}
          onJoin={joinRoom}
          onBack={() => setView("landing")}
        />
      )}

      {view === "matchmaking" && (
        <MatchmakingPanel
          profile={profile}
          onProfileChange={setProfile}
          queueMode={queueMode}
          onModeChange={setQueueMode}
          fallbackToAI={fallbackToAI}
          onFallbackChange={setFallbackToAI}
          status={matchmakingStatus}
          onFindMatch={findOnlineMatch}
          onCancel={cancelQueue}
          onBack={() => {
            cancelQueue();
            setView("landing");
          }}
        />
      )}

      {view === "ai" && (
        <AISetupPanel
          profile={profile}
          onProfileChange={setProfile}
          aiLevel={aiLevel}
          onLevelChange={setAiLevel}
          onStart={startAIMatch}
          onBack={() => setView("landing")}
        />
      )}

      {view === "leaderboard" && (
        <LeaderboardPanel
          leaderboard={leaderboard}
          loading={leaderboardLoading}
          onRefresh={fetchLeaderboard}
          onBack={() => setView("landing")}
        />
      )}

      {view === "how" && <HowToPanel onClose={() => setView("landing")} />}
    </div>
  );
}
