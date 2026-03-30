'use client';
import { GuestFinderCard, PowerScoreTier } from '@/lib/types';

const TIER_LABELS: Record<PowerScoreTier, string> = {
  A: 'Tier A — High Power Score (70–100)',
  B: 'Tier B — Mid Power Score (41–69)',
  C: 'Tier C — Emerging (20–40)',
};

interface Props {
  cards: GuestFinderCard[];
  onSelectPodcast: (card: GuestFinderCard) => void;
  selectedId: string | null;
}

export default function GuestFinderResults({ cards, onSelectPodcast, selectedId }: Props) {
  const tiers: PowerScoreTier[] = ['A', 'B', 'C'];

  return (
    <div className="flex flex-col gap-6">
      {tiers.map((tier) => {
        const tierCards = cards.filter((c) => c.tier === tier);
        if (tierCards.length === 0) return null;
        return (
          <div key={tier}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {TIER_LABELS[tier]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tierCards.map((card, i) => (
                <button
                  key={i}
                  onClick={() => card.podcastId && onSelectPodcast(card)}
                  className={`text-left p-4 rounded-lg border transition-colors ${
                    selectedId && selectedId === card.podcastId
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <p className="font-medium text-gray-900 text-sm mb-1">{card.podcastName}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{card.brief}</p>
                  {card.podcastURL && (
                    <a
                      href={card.podcastURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-block mt-2 text-xs text-blue-600 hover:underline"
                    >
                      View on Podchaser →
                    </a>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
