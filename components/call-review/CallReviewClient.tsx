'use client';
import { useState, useEffect, useCallback } from 'react';
import type { CallReviewSection } from '@/lib/minimax';
import type { ChorusCallMeta } from '@/lib/chorus';

const LIMIT_OPTIONS = [
  { value: 10, label: 'Last 10 calls' },
  { value: 20, label: 'Last 20 calls' },
];

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

function fmtDuration(secs: number) {
  if (!secs) return '';
  const m = Math.round(secs / 60);
  return `${m}m`;
}

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

function ReviewResult({ review, callCount, repName, onBack }: {
  review: CallReviewSection;
  callCount: number;
  repName: string;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Review based on {callCount} call{callCount !== 1 ? 's' : ''} · {repName}
        </p>
        <button onClick={onBack} className="text-xs text-brand-purple hover:underline">← Back</button>
      </div>

      {review.bestMoment && (
        <div className="rounded-2xl p-5 border border-brand-purple/20 bg-gradient-to-br from-violet-50 to-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-3 flex items-center gap-1.5">
            <span>★</span> Best Moment
          </p>
          <blockquote className="text-sm text-gray-800 italic leading-relaxed border-l-2 border-brand-purple pl-3 mb-2">
            &ldquo;{review.bestMoment.quote}&rdquo;
          </blockquote>
          {review.bestMoment.context && (
            <p className="text-xs text-gray-500 mt-2">{review.bestMoment.context}</p>
          )}
        </div>
      )}

      <SectionCard title="Strengths" bullets={review.strengths} color="border-emerald-100 bg-emerald-50/60" icon="✓" />
      <SectionCard title="Areas to Develop" bullets={review.areasToDevlop} color="border-amber-100 bg-amber-50/60" icon="→" />
      <SectionCard title="Focus for Next Call" bullets={review.focusForNext} color="border-violet-100 bg-violet-50/60" icon="◎" />

      {review.overallNote && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-2">Overall Coaching Note</p>
          <p className="text-sm text-gray-700 leading-relaxed">{review.overallNote}</p>
        </div>
      )}
    </div>
  );
}

interface Props {
  repName: string;
  repEmail: string;
}

export default function CallReviewClient({ repName }: Props) {
  const [limit, setLimit] = useState(10);

  // Call list state
  const [callList, setCallList] = useState<ChorusCallMeta[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [emailUsed, setEmailUsed] = useState('');

  // Review state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ review: CallReviewSection; callCount: number } | null>(null);
  const [deepDiveCall, setDeepDiveCall] = useState<ChorusCallMeta | null>(null);

  const loadCallList = useCallback(async (lim: number) => {
    setListLoading(true);
    setCallList(null);
    setResult(null);
    setDeepDiveCall(null);
    setError('');
    try {
      const res = await fetch(`/api/chorus/call-review?mode=list&limit=${lim}`);
      const data = await res.json();
      if (data.debug?.emailUsed) setEmailUsed(data.debug.emailUsed);
      if (!res.ok) throw new Error(data.error || 'Failed to load calls');
      setCallList(data.calls ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { loadCallList(limit); }, [limit, loadCallList]);

  async function reviewAll() {
    setLoading(true);
    setError('');
    setResult(null);
    setDeepDiveCall(null);
    try {
      const res = await fetch(`/api/chorus/call-review?limit=${limit}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate review');
      if (!data.review) { setError('No calls found in Chorus for this account.'); return; }
      setResult({ review: data.review, callCount: data.callCount });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function deepDive(call: ChorusCallMeta) {
    setLoading(true);
    setError('');
    setResult(null);
    setDeepDiveCall(call);
    try {
      const params = new URLSearchParams({
        callId: call.id,
        callTitle: call.title,
        callDate: call.date,
      });
      const res = await fetch(`/api/chorus/call-review?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate review');
      if (!data.review) { setError('No transcript found for this call.'); return; }
      setResult({ review: data.review, callCount: 1 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setResult(null);
    setDeepDiveCall(null);
    setError('');
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
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {LIMIT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setLimit(opt.value)}
              disabled={loading || listLoading}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                limit === opt.value
                  ? 'bg-brand-purple text-white'
                  : 'bg-violet-50 text-brand-purple hover:bg-violet-100'
              } disabled:opacity-50`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {!result && callList && callList.length > 0 && (
          <button
            onClick={reviewAll}
            disabled={loading}
            className="ml-auto text-sm px-4 py-2 rounded-lg bg-brand-purple text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading && !deepDiveCall ? 'Analysing…' : 'Review All'}
          </button>
        )}
      </div>

      {emailUsed && (
        <p className="text-xs text-gray-400">Searching Chorus as: <span className="font-mono">{emailUsed}</span></p>
      )}

      {/* Loading spinner for list */}
      {listLoading && (
        <div className="text-center py-6 text-sm text-gray-400">Loading your calls…</div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Review generating */}
      {loading && (
        <div className="rounded-2xl border border-violet-100 bg-white p-8 text-center space-y-1">
          <p className="text-sm text-gray-500">
            {deepDiveCall
              ? `Analysing ${deepDiveCall.title}…`
              : 'Pulling transcripts and generating coaching feedback…'}
          </p>
          <p className="text-xs text-gray-400">This can take up to 60 seconds.</p>
        </div>
      )}

      {/* Review result */}
      {result && !loading && (
        <ReviewResult
          review={result.review}
          callCount={result.callCount}
          repName={deepDiveCall ? deepDiveCall.title : repName}
          onBack={handleBack}
        />
      )}

      {/* Call list */}
      {!result && !loading && callList && (
        <div className="space-y-1">
          {callList.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No calls found in Chorus for your account.</p>
          ) : (
            callList.map(call => (
              <div
                key={call.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-violet-50 bg-white hover:border-violet-200 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{call.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmtDate(call.date)}{call.durationSecs ? ` · ${fmtDuration(call.durationSecs)}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => deepDive(call)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet-50 text-brand-purple font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-violet-100 shrink-0"
                >
                  Deep Dive →
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
