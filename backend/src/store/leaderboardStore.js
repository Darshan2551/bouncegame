const fs = require("fs");

function toUserId(username) {
  return String(username || "player")
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 24);
}

class LeaderboardStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.users = new Map();
    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify({ users: [] }, null, 2));
      }
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      const users = Array.isArray(parsed.users) ? parsed.users : [];
      this.users = new Map(users.map((user) => [user.id, user]));
    } catch (_error) {
      this.users = new Map();
    }
  }

  persist() {
    const allUsers = this.getSortedUsers();
    fs.writeFileSync(this.filePath, JSON.stringify({ users: allUsers }, null, 2));
  }

  ensureUser(username) {
    const normalizedName = String(username || "Player").trim().slice(0, 18) || "Player";
    const id = toUserId(normalizedName) || `player_${Math.random().toString(36).slice(2, 9)}`;

    if (!this.users.has(id)) {
      this.users.set(id, {
        id,
        username: normalizedName,
        wins: 0,
        losses: 0,
        xp: 0,
        rank: 0,
        winStreak: 0,
        maxWinStreak: 0,
        matchesPlayed: 0,
        lastPlayedAt: Date.now(),
      });
    }

    const user = this.users.get(id);
    user.username = normalizedName;
    return user;
  }

  recordMatch({ winnerTeam, players }) {
    if (!winnerTeam || !Array.isArray(players)) {
      return;
    }

    for (const player of players) {
      if (player.isBot || player.isAi) {
        continue;
      }

      const user = this.ensureUser(player.name);
      user.matchesPlayed += 1;
      user.lastPlayedAt = Date.now();

      const isWinner = player.team === winnerTeam;
      if (isWinner) {
        user.wins += 1;
        user.winStreak += 1;
        user.maxWinStreak = Math.max(user.maxWinStreak, user.winStreak);
        user.xp += 20;
        if (user.winStreak > 1) {
          user.xp += 10;
        }
      } else {
        user.losses += 1;
        user.winStreak = 0;
        user.xp += 5;
      }
    }

    this.refreshRanks();
    this.persist();
  }

  refreshRanks() {
    const sorted = this.getSortedUsers();
    sorted.forEach((user, index) => {
      user.rank = index + 1;
      this.users.set(user.id, user);
    });
  }

  getSortedUsers() {
    return [...this.users.values()].sort((a, b) => {
      if (b.xp !== a.xp) {
        return b.xp - a.xp;
      }
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      return a.losses - b.losses;
    });
  }

  getTop(limit = 25) {
    this.refreshRanks();
    return this.getSortedUsers().slice(0, limit);
  }
}

module.exports = {
  LeaderboardStore,
};