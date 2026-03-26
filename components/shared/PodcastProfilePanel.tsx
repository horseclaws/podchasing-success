'use client';
import { useEffect, useState } from 'react';
import { EpisodeSummary } from '@/lib/types';
import InsightCard from '@/components/ui/InsightCard';

interface Props {
  podcastId: string;
  podcastName: string;
  podcastUrl: string | null;
  onClose: () => void;
}

export default function PodcastProfilePanel({ podcastId, podcastName, podcastUrl, onClose }: Props) {
  const [description, setDescription] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingProfile(true);
      setDescription(null);
      setEpisodes([]);
      setSummary(null);
      setError(null);

      try {
        const profileRes = await fetch('/api/podchaser/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ podcastId }),
        });

        if (!profileRes.ok) throw new Error('Failed to fetch profile');
        const profile = await profileRes.json();
        if (cancelled) return;

        setDescription(profile.description);
        setEpisodes(profile.episodes);
        setLoadingProfile(false);

        setLoadingSummary(true);
        const summaryRes = await fetch('/api/minimax/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            podcastName,
            podcastDescription: profile.description,
            episodes: profile.episodes,
          }),
        });

        if (!summaryRes.ok) throw new Error('Failed to fetch summary');
        const { summary: aiSummary } = await summaryRes.json();
        if (!cancelled) setSummary(aiSummary);
      } catch {
        if (!cancelled) setError('Failed to load podcast profile.');
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
          setLoadingSummary(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [podcastId, podcastName]);

  return (
    <InsightCard className="flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground text-sm leading-tight">{podcastName}</h2>
          {podcastUrl && (
            <a
              href={podcastUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-cyan hover:underline"
            >
              View on Podchaser
            </a>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0">×</button>
      </div>

      {loadingProfile ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          Loading profile…
        </div>
      ) : error ? (
        <p className="text-sm text-brand-pink">{error}</p>
      ) : (
        <>
          {description && (
            <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
          )}

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Guest Pattern
            </h3>
            {loadingSummary ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-3 h-3 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
                Analyzing…
              </div>
            ) : summary ? (
              <p className="text-xs text-gray-700 leading-relaxed">{summary}</p>
            ) : null}
          </div>

          {episodes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Recent Episodes
              </h3>
              <ul className="space-y-2">
                {episodes.map((ep, i) => (
                  <li key={i} className="text-xs">
                    <p className="font-medium text-gray-800 leading-snug">{ep.title}</p>
                    {ep.airDate && <p className="text-gray-400">{ep.airDate}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </InsightCard>
  );
}
