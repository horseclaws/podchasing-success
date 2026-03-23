'use client';
import { useState } from 'react';

interface Company { id: string; name: string; domain: string | null }

interface Props {
  onSelect: (company: Company) => void;
}

export default function ClientSearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Company[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setResults(null);
    setLoading(true);
    const res = await fetch('/api/hubspot/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: query }),
    });
    setLoading(false);
    const data = await res.json();

    if (!res.ok || data.length === 0) {
      setError('No matching clients found in HubSpot. Check the name and try again.');
      return;
    }
    if (data.length === 1) {
      onSelect(data[0]);
      return;
    }
    setResults(data);
  }

  return (
    <div>
      <form onSubmit={search} className="flex gap-2 mb-4">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search client by company name…"
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !query}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="text-sm text-gray-500">{error}</p>}

      {results && (
        <div className="border border-gray-200 rounded overflow-hidden">
          <p className="text-xs text-gray-400 px-3 py-2 border-b">Multiple matches — select one:</p>
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0"
            >
              <span className="text-sm text-gray-900">{r.name}</span>
              {r.domain && <span className="text-xs text-gray-400 ml-2">{r.domain}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
