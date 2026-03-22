import { DailyChartEntry, LeaderboardEntry } from './types';

export function rankBonus(rank: number): number {
  if (rank >= 1 && rank <= 10) return 11 - rank;
  return 0;
}

export function computeLeaderboard(dailyCharts: DailyChartEntry[][]): LeaderboardEntry[] {
  const scores = new Map<string, LeaderboardEntry>();

  for (const day of dailyCharts) {
    for (const entry of day) {
      const bonus = rankBonus(entry.rank);
      const points = 1 + bonus;
      const existing = scores.get(entry.podcastId);
      if (existing) {
        existing.totalScore += points;
        existing.daysAppeared += 1;
        if (entry.rank < existing.bestRank) existing.bestRank = entry.rank;
      } else {
        scores.set(entry.podcastId, {
          id: entry.podcastId,
          title: entry.title,
          url: entry.url,
          totalScore: points,
          daysAppeared: 1,
          bestRank: entry.rank,
          leaderboardPosition: 0,
        });
      }
    }
  }

  const sorted = [...scores.values()]
    .sort((a, b) => {
      if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
      return b.daysAppeared - a.daysAppeared;
    })
    .slice(0, 25);

  return sorted.map((entry, index) => ({ ...entry, leaderboardPosition: index + 1 }));
}

export function dateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
