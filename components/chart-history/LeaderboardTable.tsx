'use client';
import { LeaderboardEntry } from '@/lib/types';
import InsightCard from '@/components/ui/InsightCard';

interface Props {
  entries: LeaderboardEntry[];
  onSelect: (entry: LeaderboardEntry) => void;
  selectedId: string | null;
}

export default function LeaderboardTable({ entries, onSelect, selectedId }: Props) {
  return (
    <InsightCard className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-3 py-2 w-10 font-medium text-gray-600">#</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Podcast</th>
            <th className="text-right px-3 py-2 w-20 font-medium text-gray-600">Score</th>
            <th className="text-right px-3 py-2 w-16 font-medium text-gray-600">Days</th>
            <th className="text-right px-3 py-2 w-24 font-medium text-gray-600">Best Rank</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className={`border-b border-gray-100 hover:bg-violet-50 cursor-pointer ${
                selectedId === entry.id ? 'bg-violet-50' : ''
              }`}
              onClick={() => onSelect(entry)}
            >
              <td className="px-3 py-2 tabular-nums text-gray-500">{entry.leaderboardPosition}</td>
              <td className="px-3 py-2 text-brand-purple font-medium">{entry.title}</td>
              <td className="px-3 py-2 tabular-nums text-right">{entry.totalScore}</td>
              <td className="px-3 py-2 tabular-nums text-right">{entry.daysAppeared}</td>
              <td className="px-3 py-2 tabular-nums text-right">#{entry.bestRank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </InsightCard>
  );
}
