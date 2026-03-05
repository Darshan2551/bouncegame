# Bounce Arena

Real-time multiplayer web game where teams use glowing paddles to bounce a ball, collect power-ups, and score until the winning limit.

## Stack

- Frontend: React + TailwindCSS + Framer Motion + HTML5 Canvas
- Backend: Node.js + Express
- Realtime: Socket.io rooms (server-authoritative physics)

## Project Structure

- `frontend/` React client, lobby + canvas game rendering, mobile controls
- `backend/` Express + Socket.io server, lobby state, room/game engine

## Features

- Dark futuristic landing page with animated background
- Create/Join flow with room codes
- Mode selection: `1v1`, `2v1`, `2v2`
- Lobby with player slots, ready state, host start
- Paddle customization: Neon/Cyber/Plasma/Classic
- Server-authoritative gameplay physics (anti-cheat)
- Scoreboard, timer, avatars, countdown, victory overlay
- Power-ups every 20-30s: speed, smash, shield, curve, freeze
- Global matchmaking queue (`Play Online`) with optional AI fallback
- Global leaderboard persistence (`wins/losses/xp/streak/rank`)
- AI opponent modes (`Easy`, `Medium`, `Hard`)
- Rage meter and `Ultimate Smash`
- Emoji + roast reactions as floating paddle bubbles
- Reconnection via persisted client session
- Spectator join support
- Match history preview in lobby

## Run Locally

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Build

```bash
npm run build
npm run start
```

To serve the frontend from backend in production, set `SERVE_STATIC=true` and ensure `frontend/dist` exists.

## Backend Env

Copy `backend/.env.example` to `backend/.env` and adjust values.
