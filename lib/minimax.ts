import { GuestFinderCard, PowerScoreTier, PodcastSearchResult, EpisodeSummary } from './types';

const ENDPOINT = 'https://api.minimax.io/v1/text/chatcompletion_v2';
const MODEL = 'MiniMax-M2.5';
const SYSTEM_PROMPT = 'You are an expert podcast PR agent.';

async function chat(userMessage: string): Promise<string | null> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') return null;
  return stripThinkingTags(text);
}

export async function callMiniMax(userMessage: string): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('MiniMax returned no content');
  return text;
}

export function stripThinkingTags(text: string): string {
  let result = text;
  const openTag = '<think>';
  const closeTag = '</think>';
  let start = result.indexOf(openTag);
  while (start !== -1) {
    const end = result.indexOf(closeTag, start + openTag.length);
    if (end === -1) break;
    result = result.slice(0, start) + result.slice(end + closeTag.length);
    start = result.indexOf(openTag);
  }
  return result.trim();
}

export async function extractKeywords(description: string): Promise<string> {
  const prompt = `Extract 3-5 search keywords and relevant personas from the following client description. Return only the keywords as a single space-separated string with no other text or punctuation.\n\nClient description: "${description}"`;
  return (await chat(prompt)) ?? description;
}

export async function generateRecommendations(
  tier: PowerScoreTier,
  podcasts: PodcastSearchResult[],
  clientDescription: string
): Promise<GuestFinderCard[]> {
  const podcastList = podcasts
    .map((p) => `- ${p.title}: ${p.description ?? 'No description'} | URL: ${p.url ?? 'N/A'}`)
    .join('\n');

  const prompt = `You are finding podcast guest opportunities for the following client:\n"${clientDescription}"\n\nReview these podcasts and select the 3 to 5 best matches for this specific client. Respond with ONLY the recommendations. No intro, no commentary, no notes about missing data.\n\nUse this exact format for each recommendation — three lines, nothing else:\nPODCAST: [exact podcast name]\nBRIEF: [one sentence explaining why this is a good fit for this client]\nURL: [podcast URL exactly as given]\n\nPodcast list:\n${podcastList}`;

  const text = await chat(prompt);
  if (!text) return [];
  return parseRecommendations(text, tier, podcasts);
}

function parseRecommendations(
  text: string,
  tier: PowerScoreTier,
  sourcePodcasts: PodcastSearchResult[]
): GuestFinderCard[] {
  const cards: GuestFinderCard[] = [];
  let name: string | null = null;
  let brief: string | null = null;
  let url: string | null = null;

  function flush() {
    if (!name) return;
    const cleanName = name.replace(/\*\*/g, '');
    const resolvedUrl =
      url ??
      sourcePodcasts.find((p) => p.title.toLowerCase() === cleanName.toLowerCase())?.url ??
      null;
    const matchedId =
      sourcePodcasts.find((p) => p.title.toLowerCase() === cleanName.toLowerCase())?.id ?? null;
    cards.push({
      tier,
      podcastName: cleanName,
      brief: (brief ?? '').replace(/\*\*/g, ''),
      podcastURL: resolvedUrl,
      podcastId: matchedId,
    });
    name = null;
    brief = null;
    url = null;
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase().startsWith('PODCAST:')) {
      flush();
      name = trimmed.slice('PODCAST:'.length).trim();
    } else if (trimmed.toUpperCase().startsWith('BRIEF:')) {
      brief = trimmed.slice('BRIEF:'.length).trim();
    } else if (trimmed.toUpperCase().startsWith('URL:')) {
      const raw = trimmed.slice('URL:'.length).trim();
      url = raw.startsWith('http') ? raw : null;
    }
  }
  flush();

  if (cards.length === 0) {
    cards.push({ tier, podcastName: 'AI Recommendations', brief: text, podcastURL: null, podcastId: null });
  }
  return cards;
}

export async function generateGuestPatternSummary(
  podcastName: string,
  podcastDescription: string | null,
  episodes: EpisodeSummary[]
): Promise<string> {
  const episodeContext =
    episodes.length === 0
      ? 'No recent episodes found.'
      : episodes
          .map((e) => `- ${e.title}${e.description ? ': ' + e.description : ''}`)
          .join('\n');

  const prompt = `Analyze the following podcast and its recent episodes. Write a single paragraph of ~100 words describing the type of guests this show typically interviews and the topics it covers. Be specific and professional.\n\nPodcast: ${podcastName}\nDescription: ${podcastDescription ?? 'Not available'}\n\nRecent episodes:\n${episodeContext}`;

  const result = await chat(prompt);
  return (result ?? '').replace(/\*\*/g, '');
}

export async function generateClientSummary(data: {
  companyName: string;
  deal: {
    stage: string;
    contractEnd: string | null;
    entitlements: Record<string, unknown>;
  };
  healthTier: string;
  contacts: { name: string; email: string; lastLoginDate: string | null }[];
  mixpanel: { email: string; events: Record<string, number>; topSearches: string[]; healthSignals: string[] }[];
}): Promise<string> {
  const prompt = `You are a Client Success intelligence assistant for Podchaser. Analyze this client data and provide a concise health summary.

Company: ${data.companyName}
Health Tier: ${data.healthTier}
Deal Stage: ${data.deal.stage}
Contract End: ${data.deal.contractEnd ?? 'unknown'}

Feature Entitlements:
${Object.entries(data.deal.entitlements).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

Pro Users:
${data.contacts.map(c => `  ${c.name} (${c.email}) — last login: ${c.lastLoginDate ?? 'never'}`).join('\n')}

Mixpanel Activity (60 days):
${data.mixpanel.map(u => `  ${u.email}: ${JSON.stringify(u.events)} | searches: ${u.topSearches.join(', ')} | signals: ${u.healthSignals.join(', ')}`).join('\n')}

Provide:
1. Health tier confirmation with reasoning (cite specific user names and dates)
2. Feature adoption gaps (entitlement enabled but usage = 0)
3. 2-3 specific, actionable recommendations (reference actual user names and features)

Rules: Health tiers are Active/Drifting/At Risk only. Never fabricate data. If data is missing, say so explicitly. No markdown formatting, no emojis.`;

  const raw = await callMiniMax(prompt);
  return stripThinkingTags(raw);
}
