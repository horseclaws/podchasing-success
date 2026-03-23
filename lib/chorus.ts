import { callMiniMax, stripThinkingTags } from './minimax';

const BASE = 'https://chorus.ai/api/v1';

function headers() {
  return {
    'Authorization': `Bearer ${process.env.CHORUS_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export interface ChorusCall {
  id: string;
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

export async function searchChorusAccount(companyName: string): Promise<string | null> {
  try {
    const data = await chorusGet(`/accounts?name=${encodeURIComponent(companyName)}`);
    const accounts: Array<Record<string, unknown>> = data.accounts ?? data.results ?? data.data ?? [];
    if (accounts.length === 0) return null;
    const id = accounts[0].id ?? accounts[0].account_id;
    return id != null ? String(id) : null;
  } catch {
    return null;
  }
}

export async function fetchRecentCallTranscripts(accountId: string, limit: number): Promise<ChorusCall[]> {
  // Chorus uses /conversations (not /calls) as the primary recording endpoint
  const data = await chorusGet(`/conversations?account_id=${accountId}&limit=${limit}&sort=date_desc`);
  const calls: Array<Record<string, unknown>> = data.conversations ?? data.calls ?? data.results ?? [];

  return Promise.all(
    calls.map(async (c) => {
      let transcript = '';
      try {
        const t = await chorusGet(`/conversations/${c.id}/transcript`);
        if (Array.isArray(t.transcript)) {
          transcript = t.transcript
            .map((u: { text?: string; content?: string }) => u.text ?? u.content ?? '')
            .join(' ');
        } else {
          transcript = String(t.transcript ?? t.text ?? '');
        }
      } catch {
        // non-fatal: transcript unavailable for this call
      }
      return {
        id: String(c.id),
        date: String(c.date ?? c.created_at ?? c.start_time ?? ''),
        durationSecs: Number(c.duration ?? c.duration_secs ?? 0),
        participants: (c.participants as string[] | undefined) ?? [],
        transcript: transcript.slice(0, 3000),
      };
    })
  );
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

async function chorusGet(path: string) {
  if (!process.env.CHORUS_API_KEY) throw new Error('CHORUS_API_KEY is not set');
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Chorus GET ${path} failed: ${res.status}`);
  return res.json();
}
