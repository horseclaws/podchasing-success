# Fast Health Reports with On-Demand Enrichment — Design Spec

## Goal

Make client health reports load instantly by returning only HubSpot data on the initial request. Chorus, Mixpanel, and News become optional enrichments the rep loads on demand. MiniMax AI summary can be generated at any point using whatever enrichment is currently loaded. Mixpanel usage is tracked and capped at 40 calls/hour to protect the shared API budget.

## Background

The current `/api/hubspot/client` route fetches HubSpot data + Mixpanel + MiniMax in one blocking request. With 7+ contacts per deal, Mixpanel alone makes 9+ API calls (N profile lookups + 2 JQL queries). The result is a slow report and silent Mixpanel rate pressure. `ChorusInsights` and `RecentNews` already lazy-load independently, but they auto-trigger on mount with no user opt-in.

This spec also fixes a data quality issue: Mixpanel's "No logins in 60 days" signal fires even when HubSpot shows a recent login, because the two data sources are never cross-referenced.

---

## Changes Overview

| Action | File | Summary |
|--------|------|---------|
| Modify | `lib/serper.ts` | Add `tbs: 'qdr:m3'` to `fetchCompanyNews` |
| Modify | `lib/mixpanel.ts` | Export `MixpanelUserActivity` type; accept HubSpot contacts; suppress false "no logins" signal |
| Modify | `lib/minimax.ts` | Make `healthTier` and `mixpanel` optional in `generateClientSummary`; build prompt conditionally |
| Modify | `app/api/hubspot/client/route.ts` | Strip to HubSpot-only; remove Mixpanel and MiniMax |
| Create | `app/api/mixpanel/activity/route.ts` | On-demand Mixpanel enrichment + hourly call counter |
| Create | `app/api/minimax/summary/route.ts` | On-demand AI summary; re-fetches flagged sources server-side |
| Modify | `components/client-health/HealthReportView.tsx` | Trigger buttons, local Mixpanel state, AI summary generation |
| Modify | `components/client-health/UserActivityTable.tsx` | Make `mixpanel` prop optional; show contacts-only view when null |

`ChorusInsights` and `RecentNews` require **no changes** — they are simply not rendered until the rep triggers them.

---

## Data Layer

### lib/serper.ts

In `fetchCompanyNews`, add `tbs: 'qdr:m3'` to the Serper POST body:

```typescript
const data = await serperPost('/news', { q: `"${companyName}"`, num: limit, tbs: 'qdr:m3' });
```

No other changes.

---

### lib/mixpanel.ts

**Export a named type** for the per-user activity result so downstream routes can reference it:

```typescript
export interface MixpanelUserActivity {
  email: string;
  events: Record<string, number>;
  topSearches: string[];
  healthSignals: string[];
}
```

**Change the signature of `fetchMixpanelActivity`** to accept an optional array of HubSpot contacts for cross-referencing, and update the return type annotation:

```typescript
export async function fetchMixpanelActivity(
  emails: string[],
  hubspotContacts?: Array<{ email: string; lastLoginDate: string | null }>
): Promise<MixpanelUserActivity[]>
```

**Suppress the false "no logins" signal**: when `loginSuccess === 0` in Mixpanel, check the matching HubSpot contact's `lastLoginDate`. If it is within the last 60 days, suppress the "No logins in 60 days" signal entirely. HubSpot login data is always authoritative.

```typescript
const hsContact = hubspotContacts?.find(c => c.email === email);
const hsLoginRecent = hsContact?.lastLoginDate
  ? (Date.now() - new Date(hsContact.lastLoginDate).getTime()) < 60 * 86_400_000
  : false;

if ((rawEvents['loginSuccess'] ?? 0) === 0 && !hsLoginRecent) {
  healthSignals.push('No logins in 60 days');
}
```

**Keep all other signals unchanged**, including:
- "No alerts set up despite regular usage" (fires when `CreateANewAlertsButtonClicked === 0` and `loginSuccess > 5`)
- "Export friction: started but never downloaded"

Top searches continue to be shown when present.

`computeHealthTier` is unchanged.

---

### app/api/hubspot/client/route.ts (strip to HubSpot-only)

Remove the Mixpanel and MiniMax imports and their call blocks. The route becomes:

```
POST /api/hubspot/client
Body: { dealId: string }
```

Returns:
```typescript
{
  company: { id: string | null; name: string; domain: string | null };
  deal: {
    id: string; name: string; stage: string; pipeline: string;
    owner: string; ownerName: string;
    contractStart: string | null; contractEnd: string | null;
    entitlements: Record<string, string | null>;
  };
  contacts: Array<{ id: string; name: string; email: string; lastLoginDate: string | null }>;
  notes: Array<{ id: string; body: string; timestamp: string; isParrotBot: boolean }>;
  emails: Array<{ id: string; subject: string; body: string; timestamp: string }>;
  dealOwnerWarning: string | null;
}
```

`healthTier`, `mixpanel`, and `aiSummary` are **removed** from this response.

---

### app/api/mixpanel/activity/route.ts (new)

```
POST /api/mixpanel/activity
Body: { dealId: string }
```

**Module-level hourly counter** (resets on server restart; acceptable for a small team tool):

```typescript
let callCount = 0;
let resetAt = Date.now() + 3_600_000;

function trackUsage(): { used: number; limit: number; resetsAt: string } {
  const now = Date.now();
  if (now > resetAt) { callCount = 0; resetAt = now + 3_600_000; }
  callCount++;
  return { used: callCount, limit: 40, resetsAt: new Date(resetAt).toISOString() };
}
```

**Route behavior:**
1. Auth check
2. Check counter: if `callCount >= 40`, return `{ error: 'limit_reached', resetsAt }` with status 429
3. Fetch contacts for the deal from HubSpot (reuses `fetchContactsForDeal`)
4. Call `fetchMixpanelActivity(emails, contacts)` — passing HubSpot contacts for cross-referencing
5. Increment counter via `trackUsage()`
6. Compute `healthTier` via `computeHealthTier(activity)`
7. Return:

```typescript
{
  activity: MixpanelUserActivity[];   // uses the newly exported type from lib/mixpanel
  healthTier: 'Active' | 'Drifting' | 'At Risk';
  usage: { used: number; limit: number; resetsAt: string };
}
```

---

### app/api/minimax/summary/route.ts (new)

```
POST /api/minimax/summary
Body: {
  dealId: string;
  sources: { mixpanel: boolean; chorus: boolean; news: boolean };
}
```

**Route behavior:**
1. Auth check
2. Fetch HubSpot data: deal + company + contacts (always included)
3. If `sources.mixpanel`: call `fetchMixpanelActivity(emails, contacts)` — does **not** increment the Mixpanel usage counter (this is a summary generation, not a rep-initiated enrichment load)
4. If `sources.news`: call `fetchCompanyNews` + `annotateNewsRelevance`
5. Chorus data is not re-fetchable server-side for the summary — if `sources.chorus` is true, the prompt notes that Chorus call recordings were reviewed (via `includesChorus` flag)
6. Call `generateClientSummary` with all gathered data. The explicit call site must be:

```typescript
const summary = await generateClientSummary({
  companyName: company.name,
  deal: {
    stage: deal.properties.dealstage,
    contractEnd: deal.properties.contract_end_date ?? null,
    entitlements: Object.fromEntries(
      ['brand_safety','sponsor_history','transcript_search','tell_me_why',
       'political_skew','list_making','seats','alerts']
        .map(k => [k, deal.properties[k]])
    ),
  },
  contacts,
  healthTier: mixpanelData?.healthTier ?? null,
  mixpanel: mixpanelData?.activity,
  includesChorus: sources.chorus,
});
```

Where `mixpanelData` is the result of `fetchMixpanelActivity` + `computeHealthTier` (only present when `sources.mixpanel` is true). `includesChorus` must be explicitly passed — if omitted it silently defaults to `undefined` (falsy) and the Chorus note never appears.

7. Return: `{ summary: string }`

Note: The MiniMax summary Mixpanel fetch does not increment the usage counter. The counter tracks user-initiated "Load Mixpanel" enrichment loads only.

---

### lib/minimax.ts — generateClientSummary rewrite

**Updated parameter shape** — `healthTier` and `mixpanel` become optional:

```typescript
import type { MixpanelUserActivity } from '@/lib/mixpanel';

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
}): Promise<string>
```

**Prompt construction — build conditionally, never hallucinate missing data:**

```typescript
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
```

Key differences from the current implementation:
- `Health Tier` line only appears when `healthTier` is non-null
- Mixpanel section is replaced with an explicit "not loaded" notice when absent — the model is instructed never to guess
- Top searches are surfaced more prominently (up to 5 per user) rather than buried in a JSON blob
- Health signals appear inline with their user, making them more readable in the model context
- Instruction 1 shifts from tier confirmation to renewal risk when no Mixpanel data is present
- Instruction 2 shifts from adoption gap detection (requires event counts) to entitlement follow-up when no Mixpanel data is present
- `includesChorus` adds a brief note so the model can reference that call context was available

---

## UI Layer

### components/client-health/HealthReportView.tsx

**Removed from props:** `report.healthTier`, `report.mixpanel`, `report.aiSummary`

**New local state:**
```typescript
const [mixpanel, setMixpanel]         = useState<MixpanelUserActivity[] | null>(null);
const [mixpanelLoading, setMixpanelLoading] = useState(false);
const [mixpanelUsage, setMixpanelUsage] = useState<UsageInfo | null>(null);
const [mixpanelError, setMixpanelError] = useState('');

const [chorusTriggered, setChorusTriggered] = useState(false);
const [newsTriggered, setNewsTriggered]     = useState(false);

const [aiSummary, setAiSummary]     = useState('');
const [summaryLoading, setSummaryLoading] = useState(false);
const [summaryError, setSummaryError] = useState('');
```

**Base report renders immediately:** company header (without `HealthTierBadge` — tier requires Mixpanel), deal owner warning, feature entitlements, `UserActivityTable` (contacts-only until Mixpanel loads).

**Enrichment sections** — each starts collapsed:

#### Mixpanel Activity section
```
┌─────────────────────────────────────────┐
│ Mixpanel Activity                       │
│ 8 of 40 calls used this hour            │
│                          [Load Mixpanel]│
└─────────────────────────────────────────┘
```
- On click: `POST /api/mixpanel/activity` with `dealId`
- On success: populate local `mixpanel` state; render `UserActivityTable` with full activity data; update usage indicator; render `HealthTierBadge` in the company header (conditionally shown only when `mixpanel !== null`)
- On 429 limit_reached: show "Mixpanel limit reached for this hour (resets at HH:MM)" — button disabled

#### Chorus Insights section
```
┌─────────────────────────────────────────┐
│ Chorus Insights           [Load Chorus] │
└─────────────────────────────────────────┘
```
- On click: `setChorusTriggered(true)` — renders `<ChorusInsights companyName={...} />` which auto-fetches on mount

#### Recent News section
```
┌─────────────────────────────────────────┐
│ Recent News                 [Load News] │
└─────────────────────────────────────────┘
```
- On click: `setNewsTriggered(true)` — renders `<RecentNews companyName={...} />` which auto-fetches on mount

#### AI Summary section (always visible, always triggerable)
```
┌─────────────────────────────────────────────────┐
│ AI Summary                                      │
│ Will include: HubSpot data                      │
│ + Mixpanel ✓  + Chorus ✓  + News ✗             │
│                          [Generate AI Summary]  │
└─────────────────────────────────────────────────┘
```
- The section always renders, showing which enrichments are currently loaded
- On click: `POST /api/minimax/summary` with `dealId` and `sources` flags derived from loaded state
- After generation: renders summary text with "Save to HubSpot" button

**Save to HubSpot** — moved to the AI Summary section footer (only useful once a summary exists). Removed from the header. The `saveNote` function must be updated to use local state (`aiSummary`, `healthTier` derived from `mixpanel`) rather than `report.aiSummary` and `report.healthTier`, both of which are no longer present in the base report response.

---

### components/client-health/UserActivityTable.tsx

Make `mixpanel` prop optional and add a null guard before any array operations on it:

```typescript
interface Props {
  contacts: Array<{ name: string; email: string; lastLoginDate: string | null }>;
  mixpanel?: MixpanelUserActivity[] | null;
}
```

The component currently calls `mixpanel.map(...)` unconditionally — this must be guarded. When `mixpanel` is null/undefined, the table renders contacts with their HubSpot `lastLoginDate` only — no event counts, no health signals, no top searches. A subtle note "Load Mixpanel to see activity data" is optional.

---

## Error Handling & Edge Cases

| Case | Behavior |
|------|----------|
| Mixpanel limit reached (≥ 40 calls) | Button disabled, "Resets at HH:MM" shown |
| Mixpanel fetch fails (non-rate-limit) | Error message inline; counter not incremented |
| MiniMax summary fails | Error message inline; retry button shown |
| Chorus or News returns no data | Existing empty-state handling in each component unchanged |
| `hubspotContacts` has no `lastLoginDate` for a user | Mixpanel "no logins" signal fires normally |
| Server restarts | Hourly counter resets to 0 — acceptable for small team |

---

## Out of Scope

- Persistent Mixpanel call counter across server restarts (would require database)
- Showing per-user Mixpanel call cost in the indicator (counter tracks route calls, not per-user calls)
- Multi-source MiniMax summary streaming
- Chorus data included in MiniMax summary prompt content (only flagged as "reviewed")
