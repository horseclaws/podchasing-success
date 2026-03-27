# Dashboard Improvements — Design Spec
**Date:** 2026-03-27
**Status:** In Review

---

## Overview

Three groups of improvements to the CS Dashboard built in the previous sprint.

- **Group A** — Bug fixes: seats property name, HubSpot pagination, quote status mapping, Mixpanel timeframe label
- **Group B** — Interaction redesign: outreach side panel, overview business-type drill-down
- **Group C** — Email prompt redesign: new draft types, Serper-powered engagement email, renewal disabled

These groups are independent and can be planned and implemented separately. Group A has no dependencies. Group B depends on Group A's pagination fix being in place. Group C is fully independent.

---

## Group A — Bug Fixes

### A1: Fix `seats` property name

`DASHBOARD_PROPS` in `lib/hubspot.ts` currently requests `'seats'`. The actual HubSpot custom deal property is `number_of_seats`. Change every reference:

- `DASHBOARD_PROPS` array: `'seats'` → `'number_of_seats'`
- `mapDealToDashboard`: `p.seats` → `p.number_of_seats`

No other files need changing — `DashboardDeal.seats` field name stays the same; only the HubSpot property key changes.

### A2: HubSpot cursor pagination

All four dashboard query functions (`fetchDealsForDashboard`, `fetchRenewingDeals`, `fetchOutreachDeals`, and the existing `pollDeals`) are capped at 100 results. HubSpot's search API returns a `paging.next.after` cursor when more results exist.

Replace the single-request pattern with a loop:

```
results = []
after = undefined
loop:
  response = hubspotPost(endpoint, { ...body, limit: 100, after })
  results.push(...response.results)
  if response.paging.next.after exists:
    after = response.paging.next.after
  else:
    break
return results
```

Apply to all four functions. The `limit: 100` per page stays — it is the maximum HubSpot allows per request.

**Important:** HubSpot search enforces a hard cap of 10,000 results total. Add a safety limit: if accumulated results exceed 10,000 break the loop and log a warning. In practice the CS book of business is well under this limit.

### A3: Quote status mapping

`fetchDealQuotes` in `lib/hubspot.ts` checks for lowercase `'draft'`, `'sent'`, `'accepted'` but HubSpot returns uppercase values. Map them as follows:

| HubSpot `hs_quote_status` | Display status |
|---|---|
| `DRAFT`, `PENDING_APPROVAL`, `REJECTED`, `APPROVAL_NOT_NEEDED` | `draft` |
| `PUBLISHED` | `sent` |
| `SIGNED`, `COUNTERSIGNED` | `accepted` |
| Any unrecognised value | `draft` (safe fallback) |

The comparison must be case-insensitive (`raw.toUpperCase()`).

### A4: Mixpanel timeframe label

In `components/dashboard/UserSidePanel.tsx`, add a small label "Last 60 days" above the Mixpanel event counts section. It renders only when `mixpanel` state is non-null (i.e., after the pull succeeds). A single line of grey text, e.g.:

```tsx
<p className="text-xs text-gray-400 mb-1">Last 60 days</p>
```

---

## Group B — Interaction Redesign

### B1: Outreach tab — contacts + side panel

**Problem:** Clicking a deal currently navigates away to Client Health. The rep loses dashboard context and can't generate an email without going back.

**New behaviour:**
- The outreach API route fetches contacts per deal (same as the seats route) and returns `DealWithContacts[]` instead of `DashboardDeal[]`
- The outreach tab renders expandable deal rows. Each row shows: company name, owner (when `showOwnerColumn` is true), last contacted date, days-since label
- Clicking a deal row expands it to reveal contact chips (color-coded by tier, same as `ContactChip`)
- Clicking a contact chip opens `UserSidePanel`
- The link to `/client-health` is removed

**API change (`app/api/dashboard/outreach/route.ts`):**

Add contact fetching after `fetchOutreachDeals`:

```ts
const contactArrays = await Promise.all(
  deals.map(d => fetchContactsForDeal(d.id).catch(() => []))
);
const result: DealWithContacts[] = deals.map((deal, i) => ({
  ...deal,
  contacts: enrichContacts(contactArrays[i]),
}));
return NextResponse.json(result);
```

**Component change (`components/dashboard/OutreachTab.tsx`):**

- Change data type from `DashboardDeal[]` to `DealWithContacts[]`
- Add `onContactClick` prop (same signature as Seats/Renewals tabs)
- Add local `expanded: Set<string>` state for row expansion
- Deal rows become `<button>` that toggles expansion; contact chips render inside the expanded section
- Pass `DashboardClient`'s existing `openPanel` handler down via a new `onContactClick` prop

**`DashboardClient.tsx` change:**

Pass `onContactClick={openPanel}` to `OutreachTab` (same as Seats/Renewals).

**Cache:** The outreach cache keys remain the same (`dashboard:outreach:{ownerId}:{days}`). The cached shape changes to `DealWithContacts[]` — bust outreach cache entries on deploy by incrementing a cache version or accepting that stale entries will be evicted naturally after 4 hours.

### B2: Overview — business-type drill-down

**Problem:** The business type distribution bar chart shows counts only. Reps want to drill into a type to see which specific deals it contains and take action.

**New behaviour:**
- Each bar in the "By Business Type" distribution tile is clickable
- Clicking opens an inline panel below the distribution tiles: "[Business Type] — N deals"
- The panel shows deal cards. Each card displays: company name, deal stage, contract value, renewal date (if set), and contact chips (color-coded by tier)
- Clicking a contact chip opens `UserSidePanel`
- Clicking the same bar again, or an ✕ close button, collapses the panel

**Data:** The summary API route already fetches contacts for each deal (to compute tier counts). Include the deal+contact list in the response. Add a `deals` field to `SummaryData`:

```ts
// types/dashboard.ts — add to SummaryData
deals: Array<{
  id: string;
  name: string;
  stage: string;
  amount: number | null;
  contractEndDate: string | null;
  businessType: string | null;
  contacts: DashboardContact[];
}>;
```

The summary route already has all this data in scope — include it in the `data` object before returning.

**Component changes:**

`DistributionTile` in `OverviewTab.tsx` becomes a controlled component. Change its signature to accept `onSelect: (label: string) => void`. Each bar row becomes a `<button>`.

`OverviewTab` gains:
- `selectedBusinessType: string | null` state
- `onNavigateToSeats` already exists; no new prop needed for side panel since `onContactClick` is passed down
- A new `onContactClick` prop: `(contact: DashboardContact, deal: ...) => void` — wired to `DashboardClient`'s `openPanel`

The drill-down panel renders below the distribution tiles when `selectedBusinessType` is set, showing filtered deal cards from `data.deals`.

`DashboardClient.tsx`:
- Pass `onContactClick={openPanel}` to `OverviewTab` (new prop)

---

## Group C — Email Prompt Redesign

### Overview

Replace the three existing draft types (`inactive_user`, `open_seats`, `renewal`) with:

| Type | Label | Status |
|---|---|---|
| `inactive_user` | Inactive User | Active |
| `engagement` | Engagement | Active — requires Serper search |
| `renewal` | Renewal | Disabled in v1 |

### C1: Type system changes

In `lib/dashboard.ts`, update `EmailDraftContext`:

```ts
export interface EmailDraftContext {
  type: 'inactive_user' | 'engagement' | 'renewal';
  deal: {
    company: string;
    renewalDate: string | null;
    amount: number | null;
    stage: string;
  };
  contact: {
    name: string;
    title: string | null;
    lastLogin: string | null;
    tier: LoginTier;
  };
  mixpanel?: MixpanelUserActivity;
}
```

`open_seats` is removed. `renewal` is kept in the type for forward-compatibility but the API route returns a 400 when it is received.

### C2: Serper contact search

Add a new function `fetchContactMentions(contactName: string, companyName: string): Promise<RawNewsArticle[]>` to `lib/serper.ts`:

```ts
export async function fetchContactMentions(
  contactName: string,
  companyName: string
): Promise<RawNewsArticle[]> {
  try {
    const q = `"${contactName}" "${companyName}" (linkedin OR podcast OR announcement OR interview OR keynote)`;
    const data = await serperPost('/search', { q, num: 5, tbs: 'qdr:m3' });
    const items: Array<Record<string, unknown>> = data.organic ?? [];
    return items.map(item => ({
      title: String(item.title ?? ''),
      url: String(item.link ?? ''),
      source: String(item.displayLink ?? ''),
      date: String(item.date ?? ''),
      snippet: String(item.snippet ?? ''),
    }));
  } catch {
    return [];
  }
}
```

Both `fetchCompanyNews` and `fetchContactMentions` use `tbs: 'qdr:m3'` (last 3 months). Before passing results to MiniMax, **filter to last 60 days only**: parse the `date` field and discard articles older than 60 days.

### C3: `generateEmailDraft` rewrite (`lib/minimax.ts`)

The function now accepts a `repName: string` parameter (injected server-side from `session.user.name`).

```ts
export async function generateEmailDraft(
  ctx: EmailDraftContext,
  repName: string
): Promise<string>
```

**Inactive user prompt:**

```
You are a Customer Success manager at Podchaser.

{dealCtx}
{contactCtx — name, title, last login, tier}
{mixpanelCtx if present}

Write a warm, concise re-engagement email (2–3 sentences, under 75 words).
Acknowledge they've been quiet lately. Offer to reconnect and help them get more value from Podchaser.
Tone: Direct and friendly, like a colleague checking in. No 'Dear,' no 'Best,' no 'Sincerely.'
Sign-off: Kindly, {repName}

Output format:
Subject: [casual subject line, 4 words max, lowercase]
[email body]

Rules: No markdown. Never fabricate data not provided.
```

**Engagement prompt:**

Before calling MiniMax, the draft route runs two Serper searches in parallel:
1. `fetchCompanyNews(deal.company, 5)` — filtered to last 60 days
2. `fetchContactMentions(contact.name, deal.company)` — filtered to last 60 days

Both are filtered to last 60 days. If both return empty after filtering, return the string:
`"No recent updates found for ${contact.name} or ${deal.company} in the last 60 days. Try a different email type or search manually."`

Otherwise, pass the combined results to MiniMax:

```
You are a Customer Success manager at Podchaser writing a personalized outreach email.

Contact: {contact.name}{, contact.title} at {deal.company}

Recent updates (last 60 days):
{numbered list: title — date — snippet}

Instructions:
1. Identify the single most recent and compelling update (a post, announcement, podcast appearance, or quote). Prefer items dated within the last 30 days if available.
2. Write a 3-sentence email (under 50 words) using that hook:
   Sentence 1: Reference the specific update naturally (e.g. "Saw your post on X — your take on Y was spot on")
   Sentence 2: Note it's been a while since we last synced. Offer to help with current projects or growth goals using Podchaser's podcast intelligence tools.
   Sentence 3: Ask one specific, open-ended question about their current focus or a project they're mapping out.
3. Sign-off: Kindly, {repName}
4. Subject line: casual, 4 words max, no title case, reference the company or the specific topic found.

Output format:
Subject: [subject line]
[email body]

Rules: Only reference information from the search results above. Casual shorthand tone — like a text to a former colleague. No 'Dear,' no 'Best,' no 'Sincerely.' No markdown. Never fabricate information.
```

**Renewal:** The API route returns `400 { error: 'Renewal emails not yet available' }` when `type === 'renewal'`. The client shows this as a disabled button.

### C4: Draft API route changes (`app/api/dashboard/draft/route.ts`)

- Read `session.user.name` after the session check
- Reject `type === 'renewal'` with 400 before calling `generateEmailDraft`
- For `type === 'engagement'`: run Serper searches, filter to 60 days, call `generateEmailDraft` with combined results
- For `type === 'inactive_user'`: call `generateEmailDraft` directly
- Pass `repName = session.user.name ?? 'Your CS rep'` to `generateEmailDraft`

The Serper logic lives in the route (or a helper in `lib/serper.ts`) — `generateEmailDraft` receives pre-fetched, pre-filtered search results as an optional argument rather than fetching inside the lib function. This keeps `lib/minimax.ts` free of Serper imports.

Updated `EmailDraftContext` gains an optional field:
```ts
searchResults?: Array<{ title: string; date: string; snippet: string; source: string }>;
```

### C5: Side panel UI changes (`components/dashboard/UserSidePanel.tsx`)

**Draft type selector:**

| Button | State |
|---|---|
| Inactive User | Selectable |
| Engagement | Selectable |
| Renewal | Disabled — `opacity-50 cursor-not-allowed`, shows tooltip on hover: "Coming soon — requires verified deal data" |

**Loading state for Engagement:** While the Serper + MiniMax call is in progress, show "Researching [Company]…" instead of "Generating…" — the engagement flow takes longer than a direct LLM call.

**No-results state:** If the API returns the no-results message string, display it as a small grey notice instead of populating the textarea.

**Output display:** The generated output (subject line + body) is shown in the existing textarea as-is. Reps can read the subject line at the top and the body below it, then copy the whole block. No special parsing of the subject line is required in v1.

---

## What Is Not In Scope

- **Renewal email implementation** — deferred until deal renewal data (current amount, +10% renewal amount) is verified
- **Manual hook override for Engagement** — rep-supplied research hook is a future enhancement; v1 is fully automated via Serper
- **Pagination for `pollDeals`** — the existing outreach polling function used outside the dashboard is not changed
- **Business-type drill-down for Deal Stage** — only Business Type is clickable in v1; deal stage bars remain read-only
