'use client';
import { useState } from 'react';
import type { CallReviewSection } from '@/lib/minimax';

const LIMIT_OPTIONS = [
  { value: 10, label: 'Last 10 calls' },
  { value: 20, label: 'Last 20 calls' },
];

interface SectionCardProps {
  title: string;
  bullets: string[];
  color: string;
  icon: string;
}

function SectionCard({ title, bullets, color, icon }: SectionCardProps) {
  if (bullets.length === 0) return null;
  return (
    <div className={`rounded-2xl p-5 border ${color}`}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <span>{icon}</span>{title}
      </p>
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
            <span className="mt-1 shrink-0 text-gray-300">—</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  repName: string;
  repEmail: string;
}

export default function CallReviewClient({ repName }: Props) {
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailUsed, setEmailUsed] = useState('');
  const [result, setResult] = useState<{ review: CallReviewSection; callCount: number } | null>(null);

  async function generate() {
    setLoading(true);
    setError('');
    setResult(null);
    setEmailUsed('');
    try {
      const res = await fetch(`/api/chorus/call-review?limit=${limit}`);
      const data = await res.json();
      if (data.debug?.emailUsed) setEmailUsed(data.debug.emailUsed);
      if (!res.ok) throw new Error(data.error || 'Failed to generate review');
      if (!data.review) {
        setError('No calls found in Chorus for this account.');
        return;
      }
      setResult({ review: data.review, callCount: data.callCount });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Call Review</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          AI coaching feedback on your recent Chorus calls — based on consultative CS principles.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {LIMIT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setLimit(opt.value); setResult(null); }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                limit === opt.value
                  ? 'bg-brand-purple text-white'
                  : 'bg-violet-50 text-brand-purple hover:bg-violet-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="ml-auto text-sm px-4 py-2 rounded-lg bg-brand-purple text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Analysing calls…' : 'Generate Review'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-violet-100 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">Pulling transcripts and generating coaching feedback…</p>
          <p className="text-xs text-gray-400 mt-1">This can take up to 60 seconds for 20 calls.</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Results */}
      {emailUsed && !loading && (
        <p className="text-xs text-gray-400">Searching Chorus as: <span className="font-mono">{emailUsed}</span></p>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            Review based on {result.callCount} call{result.callCount !== 1 ? 's' : ''} · {repName}
          </p>

          <SectionCard
            title="Strengths"
            bullets={result.review.strengths}
            color="border-emerald-100 bg-emerald-50/60"
            icon="✓"
          />
          <SectionCard
            title="Areas to Develop"
            bullets={result.review.areasToDevlop}
            color="border-amber-100 bg-amber-50/60"
            icon="→"
          />
          <SectionCard
            title="Focus for Next Call"
            bullets={result.review.focusForNext}
            color="border-violet-100 bg-violet-50/60"
            icon="◎"
          />

          {result.review.overallNote && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-2">Overall Coaching Note</p>
              <p className="text-sm text-gray-700 leading-relaxed">{result.review.overallNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
