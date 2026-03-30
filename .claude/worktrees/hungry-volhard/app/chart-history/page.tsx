'use client';
import { useState, useRef } from 'react';
import { LeaderboardEntry, DailyChartEntry, CHART_CATEGORIES } from '@/lib/types';
import { computeLeaderboard, dateRange, formatDate } from '@/lib/scoring';
import { exportLeaderboard } from '@/lib/exportCsv';
import MonthYearPicker from '@/components/chart-history/MonthYearPicker';
import LeaderboardTable from '@/components/chart-history/LeaderboardTable';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PodcastProfilePanel from '@/components/shared/PodcastProfilePanel';

export default function ChartHistoryPage() {
  const [categoryId, setCategoryId] = useState('');
  const [startYear, setStartYear] = useState(2025);
  const [startMonth, setStartMonth] = useState(1);
  const [endYear, setEndYear] = useState(2025);
  const [endMonth, setEndMonth] = useState(3);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);

  const abortRef = useRef(false);

  const isRangeValid =
    startYear < endYear || (startYear === endYear && startMonth <= endMonth);

  async function run() {
    abortRef.current = false;
    setIsLoading(true);
    setError(null);
    setLeaderboard([]);
    setSelectedEntry(null);

    const start = new Date(startYear, startMonth - 1, 1);
    const end = new Date(endYear, endMonth, 0); // last day of endMonth
    const dates = dateRange(start, end);
    const allDailyCharts: DailyChartEntry[][] = [];

    try {
      for (let i = 0; i < dates.length; i++) {
        if (abortRef.current) break;
        const dateStr = formatDate(dates[i]);
        setProgress(`Fetching ${dateStr} (${i + 1}/${dates.length})`);

        const res = await fetch('/api/podchaser/chart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: categoryId, date: dateStr }),
        });

        if (!res.ok) continue; // Skip bad days

        const entries: DailyChartEntry[] = await res.json();
        if (entries.length > 0) {
          allDailyCharts.push(entries);
          setLeaderboard(computeLeaderboard(allDailyCharts));
        }
      }
    } catch {
      if (!abortRef.current) {
        setError('Failed to load chart data. Check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  }

  function cancel() {
    abortRef.current = true;
    setIsLoading(false);
    setProgress('');
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Chart History</h1>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5"
          >
            {CHART_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>

          <MonthYearPicker
            label="From"
            year={startYear}
            month={startMonth}
            onChange={(y, m) => { setStartYear(y); setStartMonth(m); }}
          />
          <MonthYearPicker
            label="To"
            year={endYear}
            month={endMonth}
            onChange={(y, m) => { setEndYear(y); setEndMonth(m); }}
          />

          {isLoading ? (
            <button
              onClick={cancel}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-100"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={run}
              disabled={!isRangeValid}
              className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Run
            </button>
          )}
        </div>

        {!isRangeValid && (
          <p className="text-xs text-red-500 mb-3">End month must be after start month.</p>
        )}

        {isLoading && <LoadingSpinner message={progress || 'Fetching chart data…'} />}

        {error && !isLoading && (
          <p className="text-gray-500 py-8 text-center">{error}</p>
        )}

        {!isLoading && !error && leaderboard.length === 0 && (
          <p className="text-gray-400 py-8 text-center">
            Select a category and date range, then click Run.
          </p>
        )}

        {leaderboard.length > 0 && (
          <>
            <div className="flex justify-end mb-2">
              <button
                onClick={() => exportLeaderboard(leaderboard, CHART_CATEGORIES.find(c => c.id === categoryId)?.displayName ?? 'all')}
                className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 text-gray-600"
              >
                Export CSV
              </button>
            </div>
            <LeaderboardTable
              entries={leaderboard}
              onSelect={setSelectedEntry}
              selectedId={selectedEntry?.id ?? null}
            />
          </>
        )}
      </div>

      {selectedEntry && (
        <div className="w-80 shrink-0">
          <PodcastProfilePanel
            podcastId={selectedEntry.id}
            podcastName={selectedEntry.title}
            podcastUrl={selectedEntry.url}
            onClose={() => setSelectedEntry(null)}
          />
        </div>
      )}
    </div>
  );
}
