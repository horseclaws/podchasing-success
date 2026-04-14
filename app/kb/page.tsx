'use client';
import { useState } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { HeroSection } from '@/components/ui';

const TOPICS = [
  'Pricing & Plans',
  'Power Score',
  'Podcast Database',
  'Transcript Search',
  'YouTube',
  'Brand Safety',
  'Boolean Search',
  'API & Integrations',
  'Audience Data',
  'Political Skew',
  'Alerts & Monitoring',
  'Onboarding & Setup',
  'Exports & Lists',
  'Podcast Coverage',
  'Seats & Users',
  'Contact Info',
  'Similar Shows',
  'Network & Hosting',
  'Competitors',
  'Account & Access',
  'General',
];

const REPS = ['Jon Dispenza', 'Jules Thill', 'Sydney Stern'];

interface KBSource {
  rank: number;
  topic: string;
  rep: string;
  stage: string;
  similarity: number;
  question: string;
  answer: string;
}

interface KBResult {
  answer: string;
  sources: KBSource[];
  match_count: number;
}

function SimilarityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.8
      ? 'bg-brand-mint/20 text-brand-mint'
      : score >= 0.65
        ? 'bg-brand-yellow/20 text-brand-yellow'
        : 'bg-white/10 text-white/50';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {pct}% match
    </span>
  );
}

function TopicPill({ topic }: { topic: string }) {
  return (
    <span
      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ backgroundColor: '#FB0467', color: '#fff' }}
    >
      {topic}
    </span>
  );
}

function SourceCard({ source, index }: { source: KBSource; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs text-white/30 font-mono">#{index + 1}</span>
        <TopicPill topic={source.topic} />
        <SimilarityBadge score={source.similarity} />
        <span className="text-xs text-white/40">{source.rep}</span>
        {source.stage && (
          <span className="text-xs text-white/30 italic">{source.stage}</span>
        )}
      </div>
      <p className="text-sm text-white/80 font-medium mb-1">{source.question}</p>
      <p className={`text-sm text-white/55 leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
        {source.answer}
      </p>
      {source.answer && source.answer.length > 120 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-brand-cyan hover:text-brand-cyan/80"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export default function KBPage() {
  const [question, setQuestion] = useState('');
  const [topic, setTopic] = useState('');
  const [rep, setRep] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<KBResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!question.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      setProgress('Embedding question…');
      await new Promise((r) => setTimeout(r, 400));
      setProgress('Searching call database…');

      const res = await fetch('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          topic:    topic || null,
          rep:      rep || null,
          count:    15,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setResult(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  }

  return (
    <>
      <HeroSection
        badge="CALL KB"
        title="Ask the"
        titleAccent="Knowledge Base"
        subtitle="Semantic search over ~20k real Q&A pairs from Jon, Jules, and Sydney's Chorus calls"
        stats={result ? [{ value: result.match_count, label: 'matches found' }] : undefined}
      />

      <div className="px-8 py-8 max-w-4xl">

        {/* Search form */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="block text-sm font-medium text-white/70 mb-2">
            What do you want to know?
          </label>
          <textarea
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-purple resize-none"
            rows={2}
            placeholder="e.g. how do clients use power score for outreach?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {/* Filters */}
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="flex-1 min-w-36">
              <label className="block text-xs text-white/40 mb-1">Topic filter</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-[#1a0236] px-3 py-2 text-sm text-white/70 focus:outline-none focus:ring-2 focus:ring-brand-purple"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              >
                <option value="">All topics</option>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-36">
              <label className="block text-xs text-white/40 mb-1">Rep filter</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-[#1a0236] px-3 py-2 text-sm text-white/70 focus:outline-none focus:ring-2 focus:ring-brand-purple"
                value={rep}
                onChange={(e) => setRep(e.target.value)}
              >
                <option value="">All reps</option>
                {REPS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={isLoading || !question.trim()}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40"
                style={{ backgroundColor: '#4A027D', color: '#FFEF70' }}
              >
                {isLoading ? 'Searching…' : 'Search KB'}
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && <LoadingSpinner message={progress || 'Synthesizing answer…'} />}

        {/* Error */}
        {error && !isLoading && (
          <p className="text-center text-sm text-red-400 py-6">{error}</p>
        )}

        {/* Results */}
        {!isLoading && result && (
          <div className="space-y-6">

            {/* Synthesized answer */}
            <div
              className="rounded-2xl border border-brand-mint/20 p-6"
              style={{ backgroundColor: 'rgba(43, 218, 159, 0.05)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#2BDA9F', color: '#0a0014' }}
                >
                  SYNTHESIZED ANSWER
                </span>
                <span className="text-xs text-white/30">
                  from {result.match_count} real call matches
                  {topic ? ` · ${topic}` : ''}
                  {rep ? ` · ${rep}` : ''}
                </span>
              </div>
              <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">
                {result.answer}
              </p>
            </div>

            {/* Source Q&As */}
            {result.sources.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">
                  Source Q&As — top {result.sources.length} matches
                </h2>
                <div className="space-y-3">
                  {result.sources.map((source, i) => (
                    <SourceCard key={source.rank} source={source} index={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !result && !error && (
          <div className="text-center py-16 text-white/20 text-sm">
            Search the knowledge base to get started
          </div>
        )}
      </div>
    </>
  );
}
