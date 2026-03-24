# News Highlights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface recent news about a client's company in the Client Health report, with AI-generated relevance notes explaining how each article could inform a CS engagement email.

**Architecture:** Client-side lazy load — `RecentNews` self-fetches `/api/news?company=<name>` after mount, backfilling without blocking the main report. `lib/serper.ts` handles Serper news search and MiniMax annotation in a single module, following the `lib/chorus.ts` pattern exactly.

**Tech Stack:** Serper API (Google News), MiniMax AI (`callMiniMax`/`stripThinkingTags` from `lib/minimax.ts`), Next.js App Router API route, React client component.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/serper.ts` | Create | Serper news fetch + MiniMax relevance annotation |
| `app/api/news/route.ts` | Create | `GET /api/news?company=<name>` endpoint |
| `components/client-health/RecentNews.tsx` | Rewrite | Self-fetching client component |
| `components/client-health/HealthReportView.tsx` | Modify (1 line) | Update call site prop |

---

## Context for implementers

Read these files before starting — they are the patterns you must follow:

- `lib/chorus.ts` — structural pattern for `lib/serper.ts` (imports, module layout, error handling)
- `app/api/chorus/route.ts` — pattern for `app/api/news/route.ts` (auth, maxDuration, null responses)
- `components/client-health/ChorusInsights.tsx` — pattern for `RecentNews.tsx` (three-value state, fetch chain)

The project has no test runner. Verification is `npx tsc --noEmit` (type check) plus manual browser testing.

**Important:** `callMiniMax` in `lib/minimax.ts` uses a hardcoded system prompt (`"You are an expert podcast PR agent."`). The user prompt passed to it must be fully self-contained with all framing inline — the system prompt will be ignored for our purposes but cannot be changed.

---

## Task 1: Create `lib/serper.ts`

**Files:**
- Create: `lib/serper.ts`

- [ ] **Step 1: Write `lib/serper.ts` with the complete implementation**

```typescript
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors in `lib/serper.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/serper.ts
git commit -m "feat: add lib/serper.ts — news fetch and MiniMax relevance annotation"
```

---

## Task 2: Create `app/api/news/route.ts`

**Files:**
- Create: `app/api/news/route.ts`

- [ ] **Step 1: Create the directory and write the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchCompanyNews, annotateNewsRelevance } from '@/lib/serper';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const company = new URL(req.url).searchParams.get('company');
  if (!company) return NextResponse.json({ articles: null });

  try {
    const raw = await fetchCompanyNews(company, 5);
    if (raw.length === 0) return NextResponse.json({ articles: null });

    const articles = await annotateNewsRelevance(raw, company);
    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json({ articles: null });
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors in `app/api/news/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/news/route.ts
git commit -m "feat: add GET /api/news route — Serper search + MiniMax annotation"
```

---

## Task 3: Rewrite `components/client-health/RecentNews.tsx`

**Files:**
- Modify: `components/client-health/RecentNews.tsx` (full rewrite)

The existing file is a placeholder with `{ data: null }` props and no `'use client'` directive. Replace it entirely.

- [ ] **Step 1: Rewrite the file**

```typescript
'use client';
import { useEffect, useState } from 'react';
import type { NewsArticle } from '@/lib/serper';

interface Props {
  companyName: string;
}

export default function RecentNews({ companyName }: Props) {
  const [articles, setArticles] = useState<NewsArticle[] | null | undefined>(undefined);

  useEffect(() => {
    if (!companyName) return;
    fetch(`/api/news?company=${encodeURIComponent(companyName)}`)
      .then(r => {
        if (!r.ok) { setArticles(null); return; }
        return r.json();
      })
      .then(data => {
        if (data !== undefined) setArticles(data.articles ?? null);
      })
      .catch(() => setArticles(null));
  }, [companyName]);

  if (articles === undefined) {
    return (
      <div className="border border-gray-200 rounded p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Recent News</h3>
        <p className="text-xs text-gray-400">Loading recent news…</p>
      </div>
    );
  }

  if (articles === null) {
    return (
      <div className="border border-gray-200 rounded p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Recent News</h3>
        <p className="text-xs text-gray-400">No recent news found for this company.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent News</h3>
      <ul className="space-y-4">
        {articles.map((article, i) => (
          <li key={i}>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {article.title}
            </a>
            <p className="text-xs text-gray-400 mt-0.5">
              {article.source}{article.date ? ` · ${article.date}` : ''}
            </p>
            {article.relevance && (
              <p className="text-xs text-gray-500 italic mt-0.5">{article.relevance}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. The old `{ data: null }` prop type is gone — if `HealthReportView` still passes `data={null}`, you'll see a TypeScript error pointing you to Task 4.

- [ ] **Step 3: Commit**

```bash
git add components/client-health/RecentNews.tsx
git commit -m "feat: rewrite RecentNews as self-fetching client component"
```

---

## Task 4: Update call site in `HealthReportView.tsx`

**Files:**
- Modify: `components/client-health/HealthReportView.tsx` (line 78)

- [ ] **Step 1: Update the call site**

In `components/client-health/HealthReportView.tsx`, change line 78 from:

```tsx
<RecentNews data={null} />
```

to:

```tsx
<RecentNews companyName={company.name} />
```

The import on line 7 (`import RecentNews from './RecentNews'`) stays unchanged. The `company` variable is already in scope on line 42: `const company = report.company as Record<string, string>`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors across all files.

- [ ] **Step 3: Smoke test in browser**

Start the dev server:
```bash
npm run dev
```

1. Navigate to the Client Health page
2. Search for a company that exists in HubSpot (e.g. one with a recent deal)
3. Wait for the report to load — "Recent News" section should show "Loading recent news…" initially
4. After a few seconds, it should backfill with article headlines, sources, dates, and relevance notes
5. Click a headline — should open in a new tab
6. Test a company with no news results — section should show "No recent news found for this company."

- [ ] **Step 4: Commit**

```bash
git add components/client-health/HealthReportView.tsx
git commit -m "feat: wire RecentNews with companyName prop in HealthReportView"
```
