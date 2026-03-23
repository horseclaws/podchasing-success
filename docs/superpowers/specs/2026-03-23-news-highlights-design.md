# News Highlights Integration Design

**Goal:** Surface recent news about a client's company in the Client Health report, with AI-generated relevance notes explaining how each article could inform a CS engagement email.

**Architecture:** Client-side lazy load — the health report loads at full speed, then `NewsHighlights` self-fetches from `/api/news` and backfills when ready. Same pattern as the Chorus integration.

**Tech Stack:** Serper API (Google News search), MiniMax AI (existing `callMiniMax` pattern), Next.js API route, React client component.

---

## Data Flow

1. `HealthReportView` renders with `company.name`.
2. `NewsHighlights` mounts and fires `GET /api/news?company=<name>`.
3. API route calls `lib/serper.ts`:
   - `fetchCompanyNews(companyName, limit=5)` → searches Serper for `"{companyName}" news`, last 30 days
   - Returns `NewsArticle[]`: `{ title, url, source, date, snippet }`
4. Articles passed to MiniMax via `annotateNewsRelevance()` (defined in `lib/serper.ts`) in a single batch call.
5. MiniMax returns a relevance note per article — one sentence explaining how a CS rep could reference this in an engagement email.
6. Response is `{ articles: NewsArticle[] }` where each article includes the `relevance` field.
7. `NewsHighlights` renders a list: headline (linked), source + date, relevance note.

---

## lib/serper.ts

Module-level constants at the top, typed helpers, exported async functions, private HTTP helper at the bottom — matching the structure of `lib/chorus.ts` and `lib/hubspot.ts`.

**Type definitions:**
```ts
export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  date: string;
  relevance: string;
}
```

**`fetchCompanyNews(companyName: string, limit: number): Promise<NewsArticle[]>`**
- Calls Serper `POST /search` with `{ q: '"<companyName>" news', num: limit, tbs: 'qdr:m', type: 'news' }`
- Uses `SERPER_API_KEY` from env via `X-API-KEY` header
- Maps response `news[]` items to `{ title, url, source: source.name, date: date, relevance: '' }`
- Returns empty array if no results or API error (non-throwing)

**`annotateNewsRelevance(articles: NewsArticle[], companyName: string): Promise<NewsArticle[]>`**
- Calls `callMiniMax()` from `lib/minimax.ts` with a fully self-contained user prompt
- Prompt includes article title + snippet for each article, asks for a numbered relevance note per article (one sentence each): how a CS rep could reference this news in an engagement email to the client
- Parses numbered output (1. / 2. / 3. ...) into per-article `relevance` strings
- Returns articles with `relevance` filled in; falls back to `''` for any unparseable lines
- If MiniMax call fails, returns articles with empty `relevance` (non-fatal)

---

## app/api/news/route.ts

`GET /api/news?company=<name>`

- `export const maxDuration = 60` — required; this route calls Serper plus MiniMax
- Auth-gated via `auth()` (same pattern as all other routes)
- If no company param: returns `{ articles: null }` with status 200
- Calls `fetchCompanyNews(company, 5)` → if empty, returns `{ articles: null }`
- Calls `annotateNewsRelevance(articles, company)`
- Returns `{ articles: NewsArticle[] }` on success
- All failures return `{ articles: null }` with status 200 — never a 5xx

---

## components/client-health/NewsHighlights.tsx

Self-fetching client component. Must include `'use client'` at the top.

**Props:** `{ companyName: string }`

**States:**
- **Loading:** "Loading recent news…"
- **No data** (`articles === null`): "No recent news found for this company." — quiet, not styled as an error
- **Loaded:** List of articles, each showing:
  - Headline as a clickable external link (opens in new tab)
  - Source name + date on the same line, muted text
  - Relevance note below in muted/italic text (omitted if empty)

---

## components/client-health/HealthReportView.tsx changes

Add `<NewsHighlights companyName={company.name} />` in the report body, positioned near `<ChorusInsights>`. No other changes.

---

## Error Handling

All failures (Serper unavailable, no results, MiniMax failure) are non-fatal and return `{ articles: null }`. The component renders "No recent news found" in all null cases. Matches the Chorus and Mixpanel failure patterns.

---

## Environment

- `SERPER_API_KEY` already defined in `.env.example`
- No new npm dependencies required
