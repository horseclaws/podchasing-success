// Podchaser
export interface DailyChartEntry {
  podcastId: string;
  title: string;
  url: string | null;
  rank: number;
}

export interface LeaderboardEntry {
  id: string;
  title: string;
  url: string | null;
  totalScore: number;
  daysAppeared: number;
  bestRank: number;
  leaderboardPosition: number;
}

export interface PodcastSearchResult {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  powerScore: number;
}

export interface EpisodeSummary {
  title: string;
  airDate: string | null;
  description: string | null;
}

// Guest Finder
export type PowerScoreTier = 'A' | 'B' | 'C';

export interface TierRange {
  tier: PowerScoreTier;
  min: number;
  max: number;
}

export const TIER_RANGES: TierRange[] = [
  { tier: 'A', min: 70, max: 100 },
  { tier: 'B', min: 41, max: 69 },
  { tier: 'C', min: 20, max: 40 },
];

export interface GuestFinderCard {
  tier: PowerScoreTier;
  podcastName: string;
  brief: string;
  podcastURL: string | null;
  podcastId: string | null;
}

// Chart categories
export interface ChartCategory {
  id: string;
  displayName: string;
}

export const CHART_CATEGORIES: ChartCategory[] = [
  { id: '', displayName: 'Top Podcasts (All)' },
  { id: 'News', displayName: 'News' },
  { id: 'Comedy', displayName: 'Comedy' },
  { id: 'Business', displayName: 'Business' },
  { id: 'True Crime', displayName: 'True Crime' },
  { id: 'Society & Culture', displayName: 'Society & Culture' },
  { id: 'Sports', displayName: 'Sports' },
  { id: 'Technology', displayName: 'Technology' },
  { id: 'Health & Fitness', displayName: 'Health & Fitness' },
  { id: 'Arts', displayName: 'Arts' },
];
