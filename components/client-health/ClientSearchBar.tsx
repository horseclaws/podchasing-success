'use client';
import { useState } from 'react';
import type { RawDealResult } from '@/lib/deal-scoring';

interface Props {
  onResults: (deals: RawDealResult[]) => void;
  disabled?: boolean;
}

export default function ClientSearchBar({ onResults, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/hubspot/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ? `Search error: ${data.error}` : 'Search failed. Try again.');
        return;
      }
      onResults(data.deals ?? []);
    } catch {
      setError('Search failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-3">
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setError(''); }}
          placeholder="Search client by deal name…"
          disabled={disabled || loading}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-white text-foreground border border-gray-200 focus:outline-none focus:border-brand-purple transition-colors disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || loading || !query.trim()}
          className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-brand-pink text-white transition-opacity disabled:opacity-40"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <p className="text-sm mt-2 text-gray-500">{error}</p>}
    </div>
  );
}
