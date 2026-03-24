import { callMiniMax, stripThinkingTags } from './minimax';

const BASE = 'https://google.serper.dev';

// Internal only — includes snippet for MiniMax context, not sent to the client
interface RawNewsArticle {
  title: string;
  url: string;
  source: string;
  date: string;
  snippet: string;
}

// Exported — what the API route returns and the component renders
export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  date: string;
  relevance: string;
}

export async function fetchCompanyNews(companyName: string, limit: number): Promise<RawNewsArticle[]> {
  try {
    const data = await serperPost('/news', { q: `"${companyName}"`, num: limit });
    const items: Array<Record<string, unknown>> = data.news ?? [];
    return items.map((item) => ({
      title: String(item.title ?? ''),
      url: String(item.link ?? ''),
      source: String(item.source ?? ''),
      date: String(item.date ?? ''),
      snippet: String(item.snippet ?? ''),
    }));
  } catch {
    return [];
  }
}

export async function annotateNewsRelevance(
  articles: RawNewsArticle[],
  companyName: string
): Promise<NewsArticle[]> {
  if (articles.length === 0) return [];

  const articleList = articles
    .map((a, i) => `${i + 1}. ${a.title} — ${a.snippet}`)
    .join('\n');

  const prompt = `You are a Client Success analyst helping CS reps write effective engagement emails to clients.

Here are ${articles.length} recent news articles about ${companyName}:

${articleList}

Respond with ONLY a numbered list in this exact format — no intro, no markdown, no extra text:
1. [one sentence on how a CS rep could reference this news in an engagement email to the client]
2. [one sentence...]
${articles.map((_, i) => `${i + 1}. [...]`).slice(2).join('\n')}`;

  try {
    const raw = await callMiniMax(prompt);
    const text = stripThinkingTags(raw);
    return parseRelevanceNotes(articles, text);
  } catch {
    return articles.map((a) => ({ ...a, relevance: '', snippet: undefined as never }));
  }
}

function parseRelevanceNotes(articles: RawNewsArticle[], text: string): NewsArticle[] {
  const lines = text.split('\n');
  return articles.map((article, i) => {
    const n = i + 1;
    const line = lines.find(
      (l) => l.trim().startsWith(`${n}.`) || l.trim().startsWith(`${n})`)
    );
    let relevance = '';
    if (line) {
      const afterPrefix = line.trim().startsWith(`${n}.`)
        ? line.trim().slice(`${n}.`.length)
        : line.trim().slice(`${n})`.length);
      relevance = afterPrefix.trim();
    }
    return {
      title: article.title,
      url: article.url,
      source: article.source,
      date: article.date,
      relevance,
    };
  });
}

async function serperPost(path: string, body: Record<string, unknown>) {
  if (!process.env.SERPER_API_KEY) throw new Error('SERPER_API_KEY is not set');
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Serper POST ${path} failed: ${res.status}`);
  return res.json();
}
