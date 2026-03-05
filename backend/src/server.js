require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const { MODES, PADDLE_STYLES, POWERUPS, EMOJIS, ROASTS } = require("./game/constants");
const { ArenaServer } = require("./game/arenaServer");
const { LeaderboardStore } = require("./store/leaderboardStore");

const PORT = Number(process.env.PORT || 4000);
const WINNING_SCORE_DEFAULT = Number(process.env.WINNING_SCORE_DEFAULT || 10);
const SERVE_STATIC = String(process.env.SERVE_STATIC || "false").toLowerCase() === "true";

const frontendOrigin = process.env.FRONTEND_ORIGIN || "*";
const allowAllOrigins = frontendOrigin === "*";
const allowedOrigins = allowAllOrigins
  ? []
  : frontendOrigin
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin || allowAllOrigins) {
    return true;
  }
  return allowedOrigins.includes(origin);
}

const app = express();
const leaderboardStore = new LeaderboardStore(path.resolve(__dirname, "../data/users.json"));

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "bounce-arena-backend" });
});

app.get("/api/config", (_req, res) => {
  res.json({
    modes: MODES,
    paddleStyles: PADDLE_STYLES,
    powerUps: POWERUPS,
    emojis: EMOJIS,
    roasts: ROASTS,
    aiLevels: ["easy", "medium", "hard"],
    winningScoreDefault: WINNING_SCORE_DEFAULT,
  });
});

app.get("/api/leaderboard", (req, res) => {
  const limit = Number(req.query.limit || 25);
  res.json({
    updatedAt: Date.now(),
    entries: leaderboardStore.getTop(Math.max(1, Math.min(100, limit))),
  });
});

if (SERVE_STATIC) {
  const distPath = path.resolve(__dirname, "../../frontend/dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

const arena = new ArenaServer(io, {
  defaultWinningScore: WINNING_SCORE_DEFAULT,
  leaderboardStore,
});
arena.start();

io.on("connection", (socket) => {
  arena.bindSocket(socket);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Bounce Arena backend listening on http://localhost:${PORT}`);
});
