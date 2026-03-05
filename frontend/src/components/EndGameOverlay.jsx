import { motion } from "framer-motion";

export default function EndGameOverlay({ room, onRematch, onReturnLobby }) {
  const winnerLabel = room.winner ? `${room.winner.toUpperCase()} TEAM` : "NO WINNER";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/82 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="neon-panel w-full max-w-2xl rounded-2xl p-6"
      >
        <h2 className="font-display text-4xl uppercase tracking-[0.16em] text-white">Victory</h2>
        <p className="mt-1 text-2xl font-semibold text-arena-cyan">{winnerLabel}</p>

        <div className="mt-4 overflow-auto rounded-lg border border-slate-700 bg-slate-950/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/90 text-slate-300">
              <tr>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Hits</th>
                <th className="px-3 py-2">Misses</th>
                <th className="px-3 py-2">Power-ups</th>
                <th className="px-3 py-2">Saves</th>
              </tr>
            </thead>
            <tbody>
              {room.players.map((player) => (
                <tr key={player.id} className="border-t border-slate-800 text-slate-200">
                  <td className="px-3 py-2">
                    {player.avatar} {player.name}
                    {player.isBot ? " [AI]" : ""}
                  </td>
                  <td className="px-3 py-2">{player.stats.hits}</td>
                  <td className="px-3 py-2">{player.stats.misses}</td>
                  <td className="px-3 py-2">{player.stats.powerUps}</td>
                  <td className="px-3 py-2">{player.stats.saves}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" className="neon-button rounded-lg px-4 py-3 text-sm font-semibold uppercase" onClick={onRematch}>
            Rematch Vote
          </button>
          <button type="button" className="ember-button rounded-lg px-4 py-3 text-sm font-semibold uppercase" onClick={onReturnLobby}>
            Return to Lobby
          </button>
        </div>
      </motion.div>
    </div>
  );
}
