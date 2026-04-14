import { NextRequest, NextResponse } from 'next/server';
import { callMiniMax, stripThinkingTags } from '@/lib/minimax';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://swglpaakqmaqnqsrshrh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY!;
const VOYAGE_KEY   = process.env.VOYAGE_API_KEY!;

const VOYAGE_MODEL = 'voyage-3';

// ── Voyage AI: embed the query ────────────────────────────────────────────────

async function embedQuery(question: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${VOYAGE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: [question], model: VOYAGE_MODEL, input_type: 'query' }),
  });
  if (!res.ok) throw new Error(`Voyage AI error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data[0].embedding;
}

// ── Supabase: vector similarity search ───────────────────────────────────────

async function searchQA(
  queryVec: number[],
  matchCount: number,
  filterTopic: string | null,
  filterRep: string | null,
) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_qa`, {
    method: 'POST',
    headers: {
      apikey:          SUPABASE_KEY,
      Authorization:   `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      query_embedding: queryVec,
      match_count:     matchCount,
      filter_topic:    filterTopic,
      filter_rep:      filterRep,
    }),
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<Record<string, unknown>[]>;
}

// ── MiniMax: synthesize an answer ─────────────────────────────────────────────

async function synthesize(question: string, results: Record<string, unknown>[]): Promise<string> {
  if (!results.length) return 'No relevant Q&A pairs found for that question.';

  const qaBlock = results
    .map(
      (r, i) =>
        `\n[${i + 1}] Topic: ${r.topic ?? '?'} | Rep: ${r.rep ?? '?'} | Stage: ${r.stage ?? '?'} | Similarity: ${Number(r.similarity ?? 0).toFixed(2)}\nQ: ${r.normalized_question ?? ''}\nA: ${r.recommended_answer ?? ''}\n`,
    )
    .join('');

  const prompt = `You are a Podchaser Pro customer success assistant. Answer using ONLY the information in the Q&A pairs below — do not add any details, features, or instructions that are not explicitly stated in those Q&As. If the Q&As don't cover something, leave it out entirely rather than filling in from general knowledge.

A rep has asked: "${question}"

Q&A pairs from real Podchaser client calls:
${qaBlock}

Write a clear, confident response the rep can use or adapt. Rules:
- Use only facts explicitly stated in the Q&As above — nothing else
- Lead with the direct answer
- Synthesize repeated points (don't list them separately)
- Note any variation between reps if present
- Under 200 words
- Plain text only — no markdown, no bullet points, no bold, no headers`;

  const raw = await callMiniMax(prompt);
  return stripThinkingTags(raw);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { question, topic, rep, count = 15 } = await req.json();

  if (!question?.trim()) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  try {
    const vec     = await embedQuery(question);
    const results = await searchQA(vec, count, topic ?? null, rep ?? null);
    const answer  = await synthesize(question, results);

    const sources = results.map((r, i) => ({
      rank:       i + 1,
      topic:      r.topic,
      rep:        r.rep,
      stage:      r.stage,
      similarity: Math.round(Number(r.similarity ?? 0) * 100) / 100,
      question:   r.normalized_question,
      answer:     r.recommended_answer,
    }));

    return NextResponse.json({ answer, sources, match_count: results.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
