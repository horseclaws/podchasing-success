import { callMiniMax, stripThinkingTags } from './minimax';

const BASE_V1 = 'https://chorus.ai/api/v1';
const BASE_V3 = 'https://chorus.ai/v3';

function headers() {
  return {
    'Authorization': `Bearer ${process.env.CHORUS_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export interface ChorusCall {
  id: string;
  title: string;
  date: string;
  durationSecs: number;
  participants: string[];
  transcript: string;
}

export interface ChorusInsightsData {
  usage: string[];
  frustrations: string[];
  goals: string[];
  callCount: number;
  latestCallDate: string;
}

// searchChorusAccount is a pass-through — /v3/engagements queries by account_name directly,
// no separate account ID lookup needed.
export async function searchChorusAccount(companyName: string): Promise<string | null> {
  return companyName.trim() || null;
}

export async function fetchRecentCallTranscripts(accountName: string, limit: number): Promise<ChorusCall[]> {
  const params = new URLSearchParams({
    account_name: accountName,
    engagement_type: 'meeting',
    limit: String(limit),
  });
  const data = await chorusGetV3(`/engagements?${params}`);
  const engagements: Array<Record<string, unknown>> = data.engagements ?? data.results ?? [];

  return Promise.all(
    engagements.map(async (e) => fetchEngagement(e, 3000))
  );
}

function engagementBelongsToRep(e: Record<string, unknown>, repEmail: string): boolean {
  const email = repEmail.toLowerCase();

  // Check owner/host fields first
  const owner = String(e.owner_email ?? e.host_email ?? e.created_by_email ?? '').toLowerCase();
  if (owner && owner === email) return true;

  // Check participants array — Chorus may use [{email}, ...] or [string, ...]
  const parts = (e.participants as unknown[]) ?? [];
  return parts.some(p => {
    if (typeof p === 'string') return p.toLowerCase() === email;
    if (typeof p === 'object' && p !== null) {
      const o = p as Record<string, unknown>;
      return String(o.email ?? o.user_email ?? '').toLowerCase() === email;
    }
    return false;
  });
}

async function fetchEngagementsByRep(repEmail: string, limit: number): Promise<Array<Record<string, unknown>>> {
  // Fetch a larger pool (up to 5×) since Chorus ignores email filter params —
  // we filter locally by participant/owner email instead.
  const fetchLimit = Math.min(limit * 5, 100);
  const params = new URLSearchParams({ engagement_type: 'meeting', limit: String(fetchLimit) });
  const data = await chorusGetV3(`/engagements?${params}`);
  const all: Array<Record<string, unknown>> = data.engagements ?? data.results ?? [];

  const filtered = all
    .filter(e => engagementBelongsToRep(e, repEmail))
    .filter(e => !String(e.title ?? e.name ?? e.account_name ?? '').toLowerCase().includes('acast'));
  return filtered.slice(0, limit);
}

/** Returns raw fields from the first engagement — used to identify correct field names for filtering */
export async function debugEngagementFields(): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({ engagement_type: 'meeting', limit: '1' });
  const data = await chorusGetV3(`/engagements?${params}`);
  const all: Array<Record<string, unknown>> = data.engagements ?? data.results ?? [];
  if (all.length === 0) return { _note: 'no engagements returned' };
  const e = all[0];
  // Return all top-level keys and the first participant entry so we can see the shape
  return {
    _topLevelKeys: Object.keys(e),
    owner_email: e.owner_email,
    host_email: e.host_email,
    created_by_email: e.created_by_email,
    user_email: e.user_email,
    participants: Array.isArray(e.participants) ? e.participants.slice(0, 2) : e.participants,
    title: e.title ?? e.name,
  };
}

export interface ChorusCallMeta {
  id: string;
  title: string;
  date: string;
  durationSecs: number;
}

export async function fetchCallListByRep(repEmail: string, limit: number): Promise<ChorusCallMeta[]> {
  const engagements = await fetchEngagementsByRep(repEmail, limit);
  return engagements.map(e => {
    const rawDate = e.date_time ?? e.date ?? e.start_time ?? e.created_at ?? '';
    const dateStr = typeof rawDate === 'number' ? new Date(rawDate * 1000).toISOString() : String(rawDate);
    return {
      id: String(e.engagement_id ?? e.id ?? ''),
      title: String(e.title ?? e.name ?? e.account_name ?? 'Untitled call'),
      date: dateStr,
      durationSecs: Number(e.duration ?? e.duration_secs ?? 0),
    };
  });
}

export async function fetchCallsByRep(repEmail: string, limit: number): Promise<ChorusCall[]> {
  const engagements = await fetchEngagementsByRep(repEmail, limit);
  return Promise.all(engagements.map(async (e) => fetchEngagement(e, 2000)));
}

export async function fetchSingleCallById(callId: string, meta: ChorusCallMeta): Promise<ChorusCall> {
  let transcript = '';
  try {
    const t = await chorusGetV1(`/conversations/${callId}`);
    const utterances: Array<{ snippet?: string }> = t?.data?.attributes?.recording?.utterances ?? [];
    transcript = utterances.map(u => u.snippet ?? '').filter(Boolean).join(' ').slice(0, 6000);
  } catch { /* non-fatal */ }
  return { ...meta, participants: [], transcript };
}

async function fetchEngagement(e: Record<string, unknown>, transcriptLimit: number): Promise<ChorusCall> {
  const engagementId = String(e.engagement_id ?? e.id ?? '');
  let transcript = '';
  try {
    const t = await chorusGetV1(`/conversations/${engagementId}`);
    const utterances: Array<{ snippet?: string }> =
      t?.data?.attributes?.recording?.utterances ?? [];
    transcript = utterances
      .map((u) => u.snippet ?? '')
      .filter(Boolean)
      .join(' ');
  } catch {
    // non-fatal: transcript unavailable for this engagement
  }
  const rawDate = e.date_time ?? e.date ?? e.start_time ?? e.created_at ?? '';
  const dateStr = typeof rawDate === 'number'
    ? new Date(rawDate * 1000).toISOString()
    : String(rawDate);
  return {
    id: engagementId,
    title: String(e.title ?? e.name ?? e.account_name ?? 'Untitled call'),
    date: dateStr,
    durationSecs: Number(e.duration ?? e.duration_secs ?? 0),
    participants: (e.participants as string[] | undefined) ?? [],
    transcript: transcript.slice(0, transcriptLimit),
  };
}

export async function extractChorusInsights(
  transcripts: string,
  callCount: number,
  latestCallDate: string
): Promise<ChorusInsightsData> {
  const prompt = `You are a Client Success analyst reviewing call transcripts between a SaaS vendor and a customer. Extract concrete, specific signals from these transcripts. Do not fabricate or infer beyond what is explicitly stated.

Transcripts:
${transcripts}

Respond using EXACTLY this format — three labeled sections, each with bullet points. No other text.

USAGE:
- [specific feature or workflow the customer mentioned using]
- [another usage signal]

FRUSTRATIONS:
- [specific friction point, complaint, or blocker mentioned]
- [another frustration]

GOALS:
- [specific outcome or objective the customer expressed]
- [another goal]

If a section has no signals, write "- None identified." under that heading. Keep each bullet to one sentence.`;

  const raw = await callMiniMax(prompt);
  const text = stripThinkingTags(raw);
  return parseInsights(text, callCount, latestCallDate);
}

function parseInsights(text: string, callCount: number, latestCallDate: string): ChorusInsightsData {
  const usage: string[] = [];
  const frustrations: string[] = [];
  const goals: string[] = [];
  let current: string[] | null = null;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === 'USAGE:') { current = usage; continue; }
    if (trimmed.toUpperCase() === 'FRUSTRATIONS:') { current = frustrations; continue; }
    if (trimmed.toUpperCase() === 'GOALS:') { current = goals; continue; }
    if (trimmed.startsWith('- ') && current !== null) {
      const bullet = trimmed.slice(2).trim();
      if (bullet && bullet.toLowerCase() !== 'none identified.') {
        current.push(bullet);
      }
    }
  }

  return { usage, frustrations, goals, callCount, latestCallDate };
}

async function chorusGetV3(path: string) {
  if (!process.env.CHORUS_API_KEY) throw new Error('CHORUS_API_KEY is not set');
  const res = await fetch(`${BASE_V3}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Chorus GET ${BASE_V3}${path} failed: ${res.status}`);
  return res.json();
}

async function chorusGetV1(path: string) {
  if (!process.env.CHORUS_API_KEY) throw new Error('CHORUS_API_KEY is not set');
  const res = await fetch(`${BASE_V1}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Chorus GET ${BASE_V1}${path} failed: ${res.status}`);
  return res.json();
}
