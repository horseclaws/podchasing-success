# News Highlights Integration Design

**Goal:** Surface recent news about a client's company in the Client Health report, with AI-generated relevance notes explaining how each article could inform a CS engagement email.

**Architecture:** Client-side lazy load — the health report loads at full speed, then `RecentNews` self-fetches from `/api/news` and backfills when ready. Same pattern as the Chorus integration.

**Tech Stack:** Serper API (Google News search), MiniMax AI (existing `callMiniMax` pattern), Next.js API route, React client component.

---

## Data Flow

1. `HealthReportView` renders with `company.name`.
2. `RecentNews` mounts and fires `GET /api/news?company=<name>`.
3. API route calls `lib/serper.ts`:
   - `fetchCompanyNews(companyName, limit=5)` → searches Serper for `"{companyName}" news`, last 30 days
   - Returns `NewsArticle[]`: `{ title, url, source, date, snippet }`
4. Articles passed to MiniMax via `annotateNewsRelevance()` (defined in `lib/serper.ts`) in a single batch call.
5. MiniMax returns a relevance note per article — one sentence explaining how a CS rep could reference this in an engagement email.
6. Response is `{ articles: NewsArticle[] }` where each article includes the `relevance` field.
7. `RecentNews` renders a list: headline (linked), source + date, relevance note.

---

## lib/serper.ts

Module-level constants at the top, typed helpers, exported async functions, private HTTP helper at the bottom — matching the structure of `lib/chorus.ts` and `lib/hubspot.ts`.

Imports `callMiniMax` and `stripThinkingTags` from `./minimax` (same as `lib/chorus.ts`).

**Type definitions:**
```ts
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
```

**`fetchCompanyNews(companyName: string, limit: number): Promise<RawNewsArticle[]>`**
- Calls Serper `POST https://google.serper.dev/news` with body `{ q: '"<companyName>"', num: limit }` and header `X-API-KEY: <SERPER_API_KEY>`
- Note: Serper's `/news` endpoint returns recent results by default; no date filter parameter is needed or supported
- Maps response `news[]` items to `RawNewsArticle`: `{ title, link → url, source, date, snippet }`
- The `SERPER_API_KEY` guard lives only in the private HTTP helper (throws if absent). `fetchCompanyNews` wraps the entire call in try/catch and returns `[]` on any error — the thrown missing-key error is caught here and treated the same as any API failure. The exported function is always non-throwing.

**`annotateNewsRelevance(articles: RawNewsArticle[], companyName: string): Promise<NewsArticle[]>`**
- Calls `callMiniMax()` from `lib/minimax.ts` with a fully self-contained user prompt — note: `callMiniMax` uses a hardcoded podcast PR system prompt, so the user prompt must be fully self-contained with CS analyst framing inline (same pattern as `extractChorusInsights`)
- Prompt structure: list articles as `1. <title> — <snippet>`, `2. ...` etc., then instruct: "Respond with ONLY a numbered list in this exact format — no intro, no markdown, no extra text:\n1. [one sentence on how a CS rep could reference this in an engagement email to the client]\n2. [...]"
- Call `stripThinkingTags(raw)` on the raw MiniMax output before parsing
- Parses numbered output using **string prefix matching** (not regex): for each article at index N (1-based), find the first line where `line.trim().startsWith('N.')` or `line.trim().startsWith('N)')`. Extract the content after the prefix. Articles with no matching line get `relevance: ''`. Lines where content after the prefix is blank or whitespace-only also produce `relevance: ''`. Note: single-digit prefix matching is unambiguous here because `limit` is always 5 (max 9 articles).
- Returns `NewsArticle[]` (snippet dropped, relevance filled in)
- If MiniMax call fails entirely, returns articles with `relevance: ''` for all (non-fatal)

---

## app/api/news/route.ts

`GET /api/news?company=<name>`

- `export const maxDuration = 60` — required; this route calls Serper plus MiniMax
- Auth-gated via `auth()` — returns `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` when session is missing (same pattern as all other routes)
- If no company param: returns `{ articles: null }` with status 200
- Calls `fetchCompanyNews(company, 5)` → if empty array, returns `{ articles: null }`
- Calls `annotateNewsRelevance(articles, company)` → result always has the same length as input with `relevance: ''` for unparseable entries; no additional empty check needed
- Returns `{ articles: NewsArticle[] }` on success
- All non-auth failures return `{ articles: null }` with status 200 — never a 5xx

---

## components/client-health/RecentNews.tsx

Rewrite the existing placeholder in place. Must include `'use client'` at the top — the current placeholder does not have it, and the rewrite requires `useEffect`/`fetch`.

**Props:** `{ companyName: string }`

**Imports:** `import type { NewsArticle } from '@/lib/serper'`

**State:** `useState<NewsArticle[] | null | undefined>(undefined)` — `undefined` = loading, `null` = no data, array = loaded. Replace the old `{ data: null }` prop entirely; the new component has no `data` prop.

**Fetch:** Use the exact `.then`-chain pattern from `ChorusInsights` to avoid state races:
```ts
fetch(`/api/news?company=${encodeURIComponent(companyName)}`)
  .then(r => {
    if (!r.ok) { setArticles(null); return; }
    return r.json();
  })
  .then(data => {
    if (data !== undefined) setArticles(data.articles ?? null);
  })
  .catch(() => setArticles(null));
```
The `if (data !== undefined)` guard prevents overwriting `null` (set on the `!r.ok` path) with `undefined` from the void return. `encodeURIComponent` is required — company names frequently contain spaces and special characters.

**States:**
- **Loading** (`articles === undefined`): "Loading recent news…"
- **No data** (`articles === null`): "No recent news found for this company." — quiet, not styled as an error
- **Loaded** (`articles` is array): List of articles, each showing:
  - Headline as a clickable external link (opens in new tab)
  - Source name + date on the same line, muted text — render the `date` string as-is from Serper (raw pass-through; no normalization)
  - Relevance note below in muted/italic text (omitted if empty)

---

## components/client-health/HealthReportView.tsx changes

Two changes:
1. Update the `RecentNews` call site from `<RecentNews data={null} />` to `<RecentNews companyName={company.name} />`
2. The import line stays the same (`import RecentNews from './RecentNews'`) — no rename needed

---

## Error Handling

All failures (Serper unavailable, no results, MiniMax failure) are non-fatal and return `{ articles: null }`. The component renders "No recent news found" in all null cases. Matches the Chorus and Mixpanel failure patterns.

---

## Environment

- `SERPER_API_KEY` already defined in `.env.example`
- No new npm dependencies required
