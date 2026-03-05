import { motion } from "framer-motion";

import AnimatedBackground from "./AnimatedBackground";

export default function LandingPage({ onCreate, onJoin, onHow, onPlayOnline, onPlayAI, onLeaderboard, connection }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <AnimatedBackground />
      <div className="relative mx-auto w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="neon-panel rounded-3xl border px-6 py-10 md:px-12"
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="font-display text-sm uppercase tracking-[0.28em] text-arena-cyan"
          >
            Real-time Esports Arena
          </motion.p>
          <h1 className="mt-3 font-display text-5xl font-extrabold uppercase tracking-wide text-white md:text-7xl">
            Bounce Arena
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-200 md:text-xl">
            Form teams, swing glowing paddles, chain power-ups, and roast your rivals mid-match.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <button
              type="button"
              onClick={onPlayOnline}
              className="neon-button rounded-xl px-4 py-3 text-lg font-semibold uppercase tracking-wide"
            >
              Play Online
            </button>
            <button
              type="button"
              onClick={onPlayAI}
              className="neon-button rounded-xl px-4 py-3 text-lg font-semibold uppercase tracking-wide"
            >
              Play vs AI
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="neon-button rounded-xl px-4 py-3 text-lg font-semibold uppercase tracking-wide"
            >
              Create Game
            </button>
            <button
              type="button"
              onClick={onJoin}
              className="neon-button rounded-xl px-4 py-3 text-lg font-semibold uppercase tracking-wide"
            >
              Join Game
            </button>
            <button
              type="button"
              onClick={onLeaderboard}
              className="neon-button rounded-xl px-4 py-3 text-lg font-semibold uppercase tracking-wide"
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={onHow}
              className="ember-button rounded-xl px-4 py-3 text-lg font-semibold uppercase tracking-wide"
            >
              How to Play
            </button>
          </div>

          <div className="mt-8 rounded-xl border border-cyan-400/30 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
            Server status: <span className="font-semibold text-arena-cyan">{connection}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
