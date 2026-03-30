import { PodcastSearchResult, PowerScoreTier, TIER_RANGES } from './types';

export function deduplicate(results: PodcastSearchResult[]): PodcastSearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

export function tierPodcasts(
  results: PodcastSearchResult[]
): Array<{ tier: PowerScoreTier; podcasts: PodcastSearchResult[] }> {
  const buckets = new Map<PowerScoreTier, PodcastSearchResult[]>();

  for (const result of results) {
    for (const { tier, min, max } of TIER_RANGES) {
      if (result.powerScore >= min && result.powerScore <= max) {
        if (!buckets.has(tier)) buckets.set(tier, []);
        buckets.get(tier)!.push(result);
        break;
      }
    }
    // Scores below 20 are excluded (no tier matches)
  }

  // Sort each bucket by powerScore descending
  for (const [, podcasts] of buckets) {
    podcasts.sort((a, b) => b.powerScore - a.powerScore);
  }

  // Return only tiers with >= 2 results, in A → B → C order
  return (['A', 'B', 'C'] as PowerScoreTier[])
    .filter((tier) => (buckets.get(tier)?.length ?? 0) >= 2)
    .map((tier) => ({ tier, podcasts: buckets.get(tier)! }));
}
