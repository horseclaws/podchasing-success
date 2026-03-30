import { GuestFinderCard, PowerScoreTier, PodcastSearchResult, EpisodeSummary } from './types';
import type { MixpanelUserActivity } from '@/lib/mixpanel';
import type { EmailDraftContext } from '@/lib/dashboard';

const ENDPOINT = 'https://api.minimax.io/v1/text/chatcompletion_v2';
const MODEL = 'MiniMax-M2.5';
const SYSTEM_PROMPT = 'You are an expert podcast PR agent.';

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

async function chat(userMessage: string): Promise<string | null> {
  try {
    return stripThinkingTags(await callMiniMax(userMessage));
  } catch {
    return null;
  }
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
  contacts: { name: string; email: string; lastLoginDate: string | null }[];
  healthTier?: string | null;
  mixpanel?: MixpanelUserActivity[];
  includesChorus?: boolean;
}): Promise<string> {
  const hasMixpanel = !!data.mixpanel?.length;

  // --- Core context (always present) ---
  const coreContext = `
Company: ${data.companyName}
Deal Stage: ${data.deal.stage}
Contract End: ${data.deal.contractEnd ?? 'unknown'}

Feature Entitlements:
${Object.entries(data.deal.entitlements).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

Pro Users (from HubSpot):
${data.contacts.map(c => `  ${c.name} (${c.email}) — last HubSpot login: ${c.lastLoginDate ?? 'never'}`).join('\n')}
`.trim();

  // --- Health tier line (only when Mixpanel loaded) ---
  const tierLine = data.healthTier
    ? `\nHealth Tier: ${data.healthTier}`
    : '';

  // --- Mixpanel activity section (only when Mixpanel loaded) ---
  const mixpanelSection = hasMixpanel
    ? `\nMixpanel Activity (past 60 days):\n` +
      data.mixpanel!.map(u => {
        const searches = u.topSearches.length
          ? `top searches: ${u.topSearches.slice(0, 5).join(', ')}`
          : 'no searches recorded';
        const signals = u.healthSignals.length
          ? `signals: ${u.healthSignals.join('; ')}`
          : '';
        return `  ${u.email}: events: ${JSON.stringify(u.events)} | ${searches}${signals ? ' | ' + signals : ''}`;
      }).join('\n')
    : '\nMixpanel Activity: not loaded for this summary.';

  // --- Chorus note (only when flagged) ---
  const chorusNote = data.includesChorus
    ? '\nCall recording context (Chorus): reviewed by rep prior to summary generation.'
    : '';

  // --- Instructions adapt to available data ---
  const instruction1 = hasMixpanel
    ? '1. Health tier assessment with reasoning — cite specific user names, login dates, and activity counts'
    : '1. Deal stage and renewal risk assessment based on contract dates and HubSpot contact data';

  const instruction2 = hasMixpanel
    ? '2. Feature adoption gaps — list entitlements that are enabled but show zero Mixpanel usage; highlight top search terms as engagement signals'
    : '2. Feature follow-up opportunities — list entitlements that may need onboarding attention based on deal stage';

  const prompt = `You are a Client Success intelligence assistant for Podchaser. Analyze this client data and write a concise health summary a CS rep can use directly in an engagement email or prep note.
${coreContext}${tierLine}${mixpanelSection}${chorusNote}

Provide:
${instruction1}
${instruction2}
3. 2-3 specific, actionable recommendations — reference actual user names and features where data allows

Rules: Health tiers are Active/Drifting/At Risk only. Never fabricate data. If a data source was not loaded, say so explicitly rather than guessing. No markdown formatting, no emojis.`;

  const raw = await callMiniMax(prompt);
  return stripThinkingTags(raw);
}

export interface CallReviewSection {
  strengths: string[];
  areasToDevlop: string[];
  focusForNext: string[];
  overallNote: string;
  bestMoment: { quote: string; context: string } | null;
}

export async function generateCallReview(
  calls: Array<{ title: string; date: string; transcript: string }>,
  repName: string,
): Promise<CallReviewSection> {
  const callIndex = calls.map((c, i) => {
    const d = c.date ? new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date';
    return `  Call ${i + 1}: ${c.title} (${d})`;
  }).join('\n');

  const callsText = calls
    .map((c, i) => {
      const d = c.date ? new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date';
      return `--- Call ${i + 1}: ${c.title} (${d}) ---\n${c.transcript || '(no transcript available)'}`;
    })
    .join('\n\n');

  const prompt = `You are an expert sales coach specialising in consultative customer success and SaaS onboarding. Review these ${calls.length} call transcripts from ${repName} and provide honest, specific, encouraging coaching feedback.

Call index (use the account name and date when referencing a specific call — never just "Call 8"):
${callIndex}

${callsText}

Evaluate across four dimensions:
1. DISCOVERY QUALITY — Did the rep ask open questions to understand the client's goals before presenting solutions? Did they listen and adapt?
2. CONSULTATIVE DEPTH — Did they connect product capabilities to the client's specific situation, or did they present features generically?
3. COMMITMENT & CLARITY — Did they close with clear next steps, defined ownership, and a measurable success metric?
4. PRODUCT ACTIVATION — Did they secure a specific workflow commitment from the client before the call ended?

Respond using EXACTLY this format. Cite specific moments from the transcripts where possible. Be direct but constructive — this is a coaching tool, not a performance review. Do not use markdown formatting (no asterisks, no bold, no italics).

BEST MOMENT:
QUOTE: [a verbatim or near-verbatim quote from the rep or client that stands out as genuinely great — a moment of real connection, smart question, or strong response]
CONTEXT: [one sentence explaining why this moment matters]

STRENGTHS:
- [specific observed behaviour with a call example]
- [another strength]

AREAS TO DEVELOP:
- [specific, actionable improvement with a suggestion for how to do it differently]
- [another area]

FOCUS FOR NEXT CALL:
- [one concrete technique or question to try on the next call]

OVERALL COACHING NOTE:
[2-3 sentences of honest, encouraging summary that a good coach would actually say]`;

  const raw = await callMiniMax(prompt);
  const text = stripThinkingTags(raw);
  return parseCallReview(text);
}

function stripMd(s: string): string {
  return s.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').trim();
}

function parseCallReview(text: string): CallReviewSection {
  const strengths: string[] = [];
  const areasToDevlop: string[] = [];
  const focusForNext: string[] = [];
  let overallNote = '';
  let bestQuote = '';
  let bestContext = '';
  let current: string[] | 'overall' | 'best' | null = null;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (/^BEST MOMENT:/i.test(trimmed)) { current = 'best'; continue; }
    if (/^STRENGTHS:/i.test(trimmed)) { current = strengths; continue; }
    if (/^AREAS TO DEVELOP:/i.test(trimmed)) { current = areasToDevlop; continue; }
    if (/^FOCUS FOR NEXT CALL:/i.test(trimmed)) { current = focusForNext; continue; }
    if (/^OVERALL COACHING NOTE:/i.test(trimmed)) { current = 'overall'; continue; }

    if (current === 'best') {
      if (/^QUOTE:/i.test(trimmed)) bestQuote = stripMd(trimmed.replace(/^QUOTE:\s*/i, ''));
      else if (/^CONTEXT:/i.test(trimmed)) bestContext = stripMd(trimmed.replace(/^CONTEXT:\s*/i, ''));
    } else if (current === 'overall') {
      if (trimmed) overallNote += (overallNote ? ' ' : '') + stripMd(trimmed);
    } else if (Array.isArray(current) && trimmed.startsWith('- ')) {
      const bullet = stripMd(trimmed.slice(2));
      if (bullet) current.push(bullet);
    }
  }

  return {
    strengths,
    areasToDevlop,
    focusForNext,
    overallNote,
    bestMoment: bestQuote ? { quote: bestQuote, context: bestContext } : null,
  };
}

export async function generateEmailDraft(ctx: EmailDraftContext): Promise<string> {
  const { type, deal, contact, mixpanel } = ctx;

  const dealCtx = [
    `Company: ${deal.company}`,
    `Deal Stage: ${deal.stage}`,
    deal.amount != null ? `Contract Value: $${deal.amount.toLocaleString()}` : null,
    deal.renewalDate ? `Renewal Date: ${deal.renewalDate}` : null,
  ].filter(Boolean).join('\n');

  const contactCtx = [
    `Contact: ${contact.name}${contact.title ? ` (${contact.title})` : ''}`,
    `Last Login: ${contact.lastLogin ?? 'never'}`,
    `Engagement Tier: ${contact.tier}`,
  ].join('\n');

  const mixpanelCtx = mixpanel
    ? `\nProduct activity (60 days): logins=${mixpanel.events['loginSuccess'] ?? 0}, exports=${mixpanel.events['exportButtonClicked'] ?? 0}, searches=${mixpanel.events['TopSearchSubmit'] ?? 0}` +
      (mixpanel.healthSignals.length ? `\nSignals: ${mixpanel.healthSignals.join('; ')}` : '')
    : '';

  const instructions: Record<EmailDraftContext['type'], string> = {
    inactive_user: `Write a short, casual re-engagement email to ${contact.name} at ${deal.company}. They haven't been active on Podchaser recently. Skip the pleasantries — get straight to the point. The goal is to get them back in the product. Offer a quick check-in or call to help. Under 80 words.`,
    open_seats: `Write a short, direct email to ${contact.name} at ${deal.company}. Their account has open seats that aren't being used. Ask if anyone else on their team should have access. No opener pleasantries — keep it brief and helpful. Under 80 words.`,
    renewal: `Write a professional renewal discussion email to ${contact.name} at ${deal.company}. Contract renews${deal.renewalDate ? ` on ${deal.renewalDate}` : ' soon'}. Express appreciation, summarise value, and open a renewal conversation. Under 150 words.`,
  };

  const prompt = `You are a Customer Success manager at Podchaser. ${instructions[type]}

${dealCtx}
${contactCtx}${mixpanelCtx}

Rules: Casual and human — write like a real person, not a marketing template. No filler openers ("I hope you're doing well", "Hope this finds you", etc). No markdown. No subject line — email body only. Never fabricate data not provided above.`;

  const raw = await callMiniMax(prompt);
  return stripThinkingTags(raw);
}
