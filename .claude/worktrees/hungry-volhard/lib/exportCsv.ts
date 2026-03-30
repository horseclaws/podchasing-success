import { LeaderboardEntry, GuestFinderCard } from './types';

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportLeaderboard(entries: LeaderboardEntry[], label: string): void {
  const header = ['#', 'Podcast', 'Score', 'Days on Chart', 'Best Rank', 'URL'];
  const rows = entries.map((e) => [
    String(e.leaderboardPosition),
    e.title,
    String(e.totalScore),
    String(e.daysAppeared),
    String(e.bestRank),
    e.url ?? '',
  ]);
  downloadCsv(`chart-history-${label}.csv`, [header, ...rows]);
}

export function exportGuestFinderCards(cards: GuestFinderCard[], clientDescription: string): void {
  const header = ['Tier', 'Podcast', 'Why It Fits', 'URL'];
  const rows = cards.map((c) => [
    `Tier ${c.tier}`,
    c.podcastName,
    c.brief,
    c.podcastURL ?? '',
  ]);
  // Sanitize client description for filename
  const slug = clientDescription.slice(0, 30).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadCsv(`guest-finder-${slug}.csv`, [header, ...rows]);
}
