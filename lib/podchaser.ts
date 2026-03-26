import { DailyChartEntry, PodcastSearchResult, EpisodeSummary } from './types';

const ENDPOINT = 'https://api.podchaser.com/graphql';

// Token cache — module-level, persists within serverless instance lifetime
let cachedToken: string | null = null;

async function graphql(query: string, token: string | null): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });

  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (res.status >= 500) throw new Error(`SERVER_ERROR_${res.status}`);
  if (res.status >= 400) throw new Error(`HTTP_ERROR_${res.status}`);

  return res.json();
}

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const clientId = process.env.PODCHASER_CLIENT_ID!;
  const clientSecret = process.env.PODCHASER_CLIENT_SECRET!;

  const query = `
    mutation {
      requestAccessToken(input: {
        grant_type: CLIENT_CREDENTIALS
        client_id: "${clientId}"
        client_secret: "${clientSecret}"
      }) { access_token }
    }
  `;

  const data = (await graphql(query, null)) as {
    data: { requestAccessToken: { access_token: string } };
  };
  cachedToken = data.data.requestAccessToken.access_token;
  return cachedToken;
}

async function authedGraphql(query: string): Promise<unknown> {
  try {
    const token = await getToken();
    return await graphql(query, token);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      cachedToken = null;
      const freshToken = await getToken();
      return await graphql(query, freshToken);
    }
    throw err;
  }
}

export async function fetchChartEntries(
  category: string,
  date: string
): Promise<DailyChartEntry[]> {
  // 100ms delay to respect rate limits across day-by-day scan
  await new Promise((r) => setTimeout(r, 100));

  // Omit category arg entirely for "All" (empty string)
  const categoryArg = category ? `\n    category: "${category}"` : '';

  const query = `
    query {
      charts(
        country: "us"
        platform: APPLE_PODCASTS
        day: "${date}"${categoryArg}
        first: 30
        page: 0
        sort: [{ column: POSITION, order: ASC }]
      ) {
        data {
          position
          podcast { id title url }
        }
      }
    }
  `;

  try {
    const data = (await authedGraphql(query)) as {
      data: {
        charts: {
          data: Array<{
            position: number;
            podcast: { id: string; title: string; url: string | null };
          }>;
        } | null;
      };
    };
    const rawEntries = (data.data.charts?.data ?? []).map((e) => ({
      podcastId: e.podcast.id,
      title: e.podcast.title,
      url: e.podcast.url,
      rank: e.position,
    }));

    // Deduplicate by podcastId, keeping best (lowest) rank.
    // The Podchaser API returns duplicate entries when no category is specified
    // because it combines multiple sub-charts into a single response.
    const deduped = new Map<string, DailyChartEntry>();
    for (const entry of rawEntries) {
      const existing = deduped.get(entry.podcastId);
      if (!existing || entry.rank < existing.rank) {
        deduped.set(entry.podcastId, entry);
      }
    }
    return [...deduped.values()];
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('SERVER_ERROR_')) {
      return []; // Gap day — no chart data
    }
    throw err;
  }
}

export async function searchPodcasts(term: string): Promise<PodcastSearchResult[]> {
  const escaped = term
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ');

  const query = `
    query {
      podcasts(
        searchTerm: "${escaped}"
        first: 100
        filters: { status: ACTIVE hasGuests: true }
      ) {
        data { id title description url powerScore }
      }
    }
  `;

  const data = (await authedGraphql(query)) as {
    data: {
      podcasts: {
        data: Array<{
          id: string;
          title: string;
          description: string | null;
          url: string | null;
          powerScore: number | null;
        }>;
      };
    };
  };

  return data.data.podcasts.data.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    url: p.url,
    powerScore: Math.round(p.powerScore ?? 0),
  }));
}

export async function fetchPodcastProfile(
  podcastId: string
): Promise<{ description: string | null; episodes: EpisodeSummary[] }> {
  const query = `
    query {
      podcast(identifier: { id: "${podcastId}", type: PODCHASER }) {
        description
        episodes(first: 10) {
          data { title airDate description }
        }
      }
    }
  `;

  const data = (await authedGraphql(query)) as {
    data: {
      podcast: {
        description: string | null;
        episodes: {
          data: Array<{
            title: string;
            airDate: string | null;
            description: string | null;
          }>;
        };
      } | null;
    };
  };

  const raw = data.data.podcast;
  if (!raw) return { description: null, episodes: [] };

  const episodes = (raw.episodes.data ?? []).sort((a, b) =>
    (b.airDate ?? '').localeCompare(a.airDate ?? '')
  );

  return { description: raw.description, episodes };
}
