'use client';
import { useState } from 'react';
import { GuestFinderCard, PodcastSearchResult } from '@/lib/types';
import { deduplicate, tierPodcasts } from '@/lib/guestFinder';
import ClientDescriptionForm from '@/components/guest-finder/ClientDescriptionForm';
import GuestFinderResults from '@/components/guest-finder/GuestFinderResults';
import PodcastProfilePanel from '@/components/shared/PodcastProfilePanel';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

export default function GuestFinderPage() {
  const [description, setDescription] = useState('');
  const [cards, setCards] = useState<GuestFinderCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<GuestFinderCard | null>(null);

  async function findPodcasts() {
    setIsLoading(true);
    setCards([]);
    setError(null);
    setSelectedCard(null);

    try {
      // 1. Extract keywords
      setProgress('Extracting keywords…');
      const kwRes = await fetch('/api/minimax/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const { keywords } = await kwRes.json();

      // 2. Search Podchaser
      setProgress('Searching podcasts…');
      const searchRes = await fetch('/api/podchaser/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: keywords }),
      });
      const allResults: PodcastSearchResult[] = await searchRes.json();

      // 3. Deduplicate and tier
      const deduped = deduplicate(allResults);
      const tiered = tierPodcasts(deduped);

      if (tiered.length === 0) {
        setError('No matching podcasts found. Try a different description.');
        return;
      }

      // 4. MiniMax recommendations per tier
      const allCards: GuestFinderCard[] = [];
      for (const { tier, podcasts } of tiered) {
        setProgress(`Generating Tier ${tier} recommendations…`);
        const top10 = podcasts.slice(0, 10);
        const recRes = await fetch('/api/minimax/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier, podcasts: top10, clientDescription: description }),
        });
        const tierCards: GuestFinderCard[] = await recRes.json();
        allCards.push(...tierCards);
      }

      setCards(allCards);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Guest Finder</h1>

        <div className="mb-6">
          <ClientDescriptionForm
            value={description}
            onChange={setDescription}
            onSubmit={findPodcasts}
            isLoading={isLoading}
          />
        </div>

        {isLoading && <LoadingSpinner message={progress || 'Working…'} />}

        {error && !isLoading && (
          <p className="text-gray-500 py-8 text-center">{error}</p>
        )}

        {!isLoading && cards.length > 0 && (
          <GuestFinderResults
            cards={cards}
            onSelectPodcast={setSelectedCard}
            selectedId={selectedCard?.podcastId ?? null}
          />
        )}
      </div>

      {selectedCard && selectedCard.podcastId && (
        <div className="w-80 shrink-0">
          <PodcastProfilePanel
            podcastId={selectedCard.podcastId}
            podcastName={selectedCard.podcastName}
            podcastUrl={selectedCard.podcastURL}
            onClose={() => setSelectedCard(null)}
          />
        </div>
      )}
    </div>
  );
}
