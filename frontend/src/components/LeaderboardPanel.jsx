export default function LeaderboardPanel({ leaderboard, onRefresh, onBack, loading }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="neon-panel w-full max-w-3xl rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl uppercase tracking-[0.16em] text-white">Global Leaderboard</h2>
          <div className="flex gap-2">
            <button type="button" onClick={onRefresh} className="neon-button rounded-lg px-3 py-1 text-xs uppercase">
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" onClick={onBack} className="ember-button rounded-lg px-3 py-1 text-xs uppercase">
              Back
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-auto rounded-lg border border-slate-700 bg-slate-950/70">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-900/80 text-slate-300">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Wins</th>
                <th className="px-3 py-2">Losses</th>
                <th className="px-3 py-2">XP</th>
                <th className="px-3 py-2">Streak</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-slate-400" colSpan={6}>
                    No ranked matches yet.
                  </td>
                </tr>
              )}
              {leaderboard.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-800 text-slate-200">
                  <td className="px-3 py-2">{entry.rank}</td>
                  <td className="px-3 py-2 font-semibold text-white">{entry.username}</td>
                  <td className="px-3 py-2">{entry.wins}</td>
                  <td className="px-3 py-2">{entry.losses}</td>
                  <td className="px-3 py-2">{entry.xp}</td>
                  <td className="px-3 py-2">{entry.winStreak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}