# Dashboard Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four dashboard bugs (Group A), add contact drill-downs to the Outreach and Overview tabs (Group B), and redesign the email draft generator with Serper-powered engagement emails (Group C).

**Architecture:** All changes are server-side API routes + client React components in a Next.js App Router project. Groups are independent; Group B depends only on Group A's pagination fix being in place first. Group C is fully independent.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS v4, HubSpot CRM v3 API, Serper Google Search API, MiniMax LLM, NextAuth v5, localStorage 4-hour TTL cache.

**Important:** This codebase uses a version of Next.js with potential breaking changes. Read `node_modules/next/dist/docs/` before writing any Next.js-specific code. Verify with `npm run build` after every task — it runs TypeScript compilation + Next.js checks.

---

## File Map

| File | Changes |
|------|---------|
| `lib/hubspot.ts` | Tasks 1, 2, 3 — property name, pagination helper, quote status |
| `components/dashboard/UserSidePanel.tsx` | Tasks 4, 9, 13 — Mixpanel label, type cleanup, full UI redesign |
| `app/api/dashboard/outreach/route.ts` | Task 5 — add contact fetching |
| `components/dashboard/OutreachTab.tsx` | Task 6 — full rewrite |
| `components/dashboard/DashboardClient.tsx` | Tasks 6, 8 — wire onContactClick to Outreach and Overview |
| `types/dashboard.ts` | Task 7 — add `deals` to SummaryData |
| `app/api/dashboard/summary/route.ts` | Task 7 — include deals in response |
| `components/dashboard/OverviewTab.tsx` | Task 8 — clickable bars, drill-down panel |
| `lib/dashboard.ts` | Task 9 — update EmailDraftContext type |
| `lib/serper.ts` | Task 10 — fetchContactMentions, filterToLast60Days |
| `lib/minimax.ts` | Task 11 — rewrite generateEmailDraft |
| `app/api/dashboard/draft/route.ts` | Task 12 — repName, renewal 400, engagement Serper |

---

## Task 1: Fix `number_of_seats` property name

**Spec:** A1
**Files:**
- Modify: `lib/hubspot.ts:64-68` (DASHBOARD_PROPS)
- Modify: `lib/hubspot.ts:100` (mapDealToDashboard)

The HubSpot custom deal property is `number_of_seats`, but the code requests `'seats'` (which returns null, causing seats to always be 0).

- [ ] **Step 1: Update DASHBOARD_PROPS**

In `lib/hubspot.ts`, find the `DASHBOARD_PROPS` constant (lines 64–68):

```ts
// Before:
const DASHBOARD_PROPS = [
  'dealname', 'dealstage', 'pipeline', 'amount',
  'contract_end_date', 'notes_last_contacted', 'business_type',
  'hubspot_owner_id', 'seats',
];

// After:
const DASHBOARD_PROPS = [
  'dealname', 'dealstage', 'pipeline', 'amount',
  'contract_end_date', 'notes_last_contacted', 'business_type',
  'hubspot_owner_id', 'number_of_seats',
];
```

- [ ] **Step 2: Update mapDealToDashboard**

In `lib/hubspot.ts`, find `mapDealToDashboard` (line 100):

```ts
// Before:
seats: p.seats != null && p.seats !== '' ? parseInt(p.seats, 10) : 0,

// After:
seats: p.number_of_seats != null && p.number_of_seats !== '' ? parseInt(p.number_of_seats, 10) : 0,
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add lib/hubspot.ts
git commit -m "fix: request number_of_seats instead of seats from HubSpot"
```

---

## Task 2: HubSpot cursor pagination

**Spec:** A2
**Files:**
- Modify: `lib/hubspot.ts` — add `hubspotSearchAll` helper, update `fetchDealsForDashboard`, `fetchRenewingDeals`, `fetchOutreachDeals`

`pollDeals` is explicitly out of scope — do NOT change it.

HubSpot returns `paging.next.after` when more results exist. All three dashboard query functions are currently capped at 100. Replace them with a pagination loop capped at 10,000.

- [ ] **Step 1: Add hubspotSearchAll helper**

In `lib/hubspot.ts`, add this function directly above the `// ---- HTTP helpers ----` comment (before the existing `hubspotGet` and `hubspotPost` functions):

```ts
/** Paginates a HubSpot search endpoint. Stops at 10,000 results (HubSpot hard cap). */
async function hubspotSearchAll(
  path: string,
  body: Record<string, unknown>
): Promise<Array<{ id: string; properties: Record<string, string | null> }>> {
  const items: Array<{ id: string; properties: Record<string, string | null> }> = [];
  let after: string | undefined;
  const SAFETY_LIMIT = 10_000;

  for (;;) {
    const page = await hubspotPost(path, {
      ...body,
      limit: 100,
      ...(after ? { after } : {}),
    });
    items.push(...(page.results ?? []));
    if (items.length >= SAFETY_LIMIT) {
      console.warn(`[hubspotSearchAll] 10,000-result limit reached for ${path}`);
      break;
    }
    const nextAfter: string | undefined = page.paging?.next?.after;
    if (!nextAfter) break;
    after = nextAfter;
  }

  return items;
}
```

- [ ] **Step 2: Update fetchDealsForDashboard**

Replace the single-request pattern (the `hubspotPost` call + `result.results`) with `hubspotSearchAll`. The full replacement (lines 183–191):

```ts
// Before:
  const result = await hubspotPost('/crm/v3/objects/deals/search', {
    filterGroups: [{ filters }],
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    properties: DASHBOARD_PROPS,
    limit: 100,
  });

  return (result.results ?? []).map(mapDealToDashboard);

// After:
  const results = await hubspotSearchAll('/crm/v3/objects/deals/search', {
    filterGroups: [{ filters }],
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    properties: DASHBOARD_PROPS,
  });

  return results.map(mapDealToDashboard);
```

- [ ] **Step 3: Update fetchRenewingDeals**

Replace the single-request pattern (lines 205–212):

```ts
// Before:
  const result = await hubspotPost('/crm/v3/objects/deals/search', {
    filterGroups: [{ filters }],
    sorts: [{ propertyName: 'contract_end_date', direction: 'ASCENDING' }],
    properties: DASHBOARD_PROPS,
    limit: 100,
  });

  return (result.results ?? []).map(mapDealToDashboard);

// After:
  const results = await hubspotSearchAll('/crm/v3/objects/deals/search', {
    filterGroups: [{ filters }],
    sorts: [{ propertyName: 'contract_end_date', direction: 'ASCENDING' }],
    properties: DASHBOARD_PROPS,
  });

  return results.map(mapDealToDashboard);
```

- [ ] **Step 4: Update fetchOutreachDeals**

Replace the single-request pattern (lines 227–239):

```ts
// Before:
  const result = await hubspotPost('/crm/v3/objects/deals/search', {
    filterGroups: [
      { filters: [...baseFilters, { propertyName: 'notes_last_contacted', operator: 'LT', value: String(cutoff) }] },
      { filters: [...baseFilters, { propertyName: 'notes_last_contacted', operator: 'NOT_HAS_PROPERTY' }] },
    ],
    sorts: [{ propertyName: 'notes_last_contacted', direction: 'ASCENDING' }],
    properties: DASHBOARD_PROPS,
    limit: 100,
  });

  return (result.results ?? []).map(mapDealToDashboard);

// After:
  const results = await hubspotSearchAll('/crm/v3/objects/deals/search', {
    filterGroups: [
      { filters: [...baseFilters, { propertyName: 'notes_last_contacted', operator: 'LT', value: String(cutoff) }] },
      { filters: [...baseFilters, { propertyName: 'notes_last_contacted', operator: 'NOT_HAS_PROPERTY' }] },
    ],
    sorts: [{ propertyName: 'notes_last_contacted', direction: 'ASCENDING' }],
    properties: DASHBOARD_PROPS,
  });

  return results.map(mapDealToDashboard);
```

- [ ] **Step 5: Verify build passes**

```bash
npm run build
```
Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add lib/hubspot.ts
git commit -m "fix: add cursor pagination to dashboard HubSpot queries (10k safety cap)"
```

---

## Task 3: Fix quote status mapping

**Spec:** A3
**Files:**
- Modify: `lib/hubspot.ts` — add `mapQuoteStatus` helper, fix `fetchDealQuotes`

HubSpot returns uppercase status values (`SIGNED`, `COUNTERSIGNED`, `PUBLISHED`, `DRAFT`, etc.) but the current code does a case-sensitive check against lowercase strings, so all statuses fall through to `'draft'`.

- [ ] **Step 1: Add mapQuoteStatus helper**

In `lib/hubspot.ts`, add this function just above `fetchDealQuotes` (around line 249):

```ts
function mapQuoteStatus(raw: string): 'draft' | 'sent' | 'accepted' {
  const upper = (raw ?? '').toUpperCase();
  if (upper === 'PUBLISHED') return 'sent';
  if (upper === 'SIGNED' || upper === 'COUNTERSIGNED') return 'accepted';
  return 'draft'; // DRAFT, PENDING_APPROVAL, REJECTED, APPROVAL_NOT_NEEDED, unknown
}
```

- [ ] **Step 2: Replace the status mapping in fetchDealQuotes**

Find this block in `fetchDealQuotes` (around lines 267–270):

```ts
    const raw = q.properties.hs_quote_status ?? '';
    const status = (['draft', 'sent', 'accepted'] as const).includes(raw as never)
      ? (raw as 'draft' | 'sent' | 'accepted')
      : 'draft';
```

Replace with:

```ts
    const status = mapQuoteStatus(q.properties.hs_quote_status ?? '');
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add lib/hubspot.ts
git commit -m "fix: map HubSpot uppercase quote statuses correctly (SIGNED -> accepted)"
```

---

## Task 4: Add Mixpanel timeframe label

**Spec:** A4
**Files:**
- Modify: `components/dashboard/UserSidePanel.tsx` — add "Last 60 days" label

Renders only when `mixpanel` state is non-null (after pull succeeds). Sits above the event counts.

- [ ] **Step 1: Add the label**

In `components/dashboard/UserSidePanel.tsx`, find the Mixpanel section where `mixpanel` is truthy (around line 137). The block starts with:

```tsx
            ) : (
              <div className="space-y-1 text-xs text-gray-600">
                {([['Logins', 'loginSuccess'], ...
```

Add the label as the first child inside that `<div>`:

```tsx
            ) : (
              <div className="space-y-1 text-xs text-gray-600">
                <p className="text-xs text-gray-400 mb-1">Last 60 days</p>
                {([['Logins', 'loginSuccess'], ['Exports', 'exportButtonClicked'], ['Searches', 'TopSearchSubmit']] as [string, string][]).map(([label, key]) => (
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/UserSidePanel.tsx
git commit -m "feat: add 'Last 60 days' label above Mixpanel event counts"
```

---

## Task 5: Outreach route — add contact fetching

**Spec:** B1 (API change)
**Files:**
- Modify: `app/api/dashboard/outreach/route.ts`

Currently returns `DashboardDeal[]`. Change to fetch contacts per deal and return `DealWithContacts[]`. Mirror the pattern already used in `app/api/dashboard/seats/route.ts`.

- [ ] **Step 1: Update the route**

Replace the entire file contents of `app/api/dashboard/outreach/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchOutreachDeals, fetchContactsForDeal } from '@/lib/hubspot';
import { enforceOwnerAccess, enrichContacts } from '@/lib/dashboard';
import type { DealWithContacts } from '@/lib/dashboard';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ownerId, error } = enforceOwnerAccess(
    session.user.is_manager,
    session.user.hubspot_owner_id,
    req.nextUrl.searchParams.get('ownerId')
  );
  if (error) return NextResponse.json({ error }, { status: 403 });

  const daysParam = Number(req.nextUrl.searchParams.get('days'));
  const days = [30, 45, 60].includes(daysParam) ? daysParam : 30;

  try {
    const deals = await fetchOutreachDeals(days, ownerId);

    const contactArrays = await Promise.all(
      deals.map(d => fetchContactsForDeal(d.id).catch(() => []))
    );

    const result: DealWithContacts[] = deals.map((deal, i) => ({
      ...deal,
      contacts: enrichContacts(contactArrays[i]),
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error('[dashboard/outreach]', e);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/dashboard/outreach/route.ts
git commit -m "feat: outreach route now fetches contacts per deal (DealWithContacts[])"
```

---

## Task 6: OutreachTab — expandable rows with contact chips

**Spec:** B1 (component changes)
**Files:**
- Modify: `components/dashboard/OutreachTab.tsx` — full rewrite
- Modify: `components/dashboard/DashboardClient.tsx` — wire onContactClick

The current tab renders `<a href="/client-health">` rows. Replace with expandable deal rows showing contact chips (like SeatsTab). Clicking a chip opens UserSidePanel.

- [ ] **Step 1: Rewrite OutreachTab.tsx**

Replace the entire file:

```tsx
// components/dashboard/OutreachTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { DealWithContacts, DashboardContact, DashboardDeal } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import ContactChip from './ContactChip';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

type Days = 30 | 45 | 60;

interface Props {
  ownerId: string;
  showOwnerColumn: boolean;
  onContactClick: (contact: DashboardContact, deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>) => void;
}

export default function OutreachTab({ ownerId, showOwnerColumn, onContactClick }: Props) {
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<DealWithContacts[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async (bust = false) => {
    const key = dashboardCacheKey('outreach', ownerId, days);
    if (bust) cacheClear(key);
    const cached = cacheGet<DealWithContacts[]>(key);
    if (cached) { setData(cached); setAgeMinutes(cacheAge(key)); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/dashboard/outreach?days=${days}&ownerId=${ownerId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      cacheSet(key, json); setData(json); setAgeMinutes(0);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [ownerId, days]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Never';
  const daysSince = (d: string | null) =>
    d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {([30, 45, 60] as Days[]).map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                days === d ? 'bg-brand-purple text-white' : 'bg-violet-50 text-brand-purple hover:bg-violet-100'
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
        <button onClick={() => load(true)} className="text-xs text-gray-400 hover:text-brand-purple">
          {ageMinutes != null ? `Updated ${ageMinutes}m ago · ` : ''}Refresh
        </button>
      </div>

      {loading && <LoadingSpinner message="Loading outreach gaps…" />}
      {error && <p className="text-sm text-gray-500 py-4">{error}</p>}
      {data && !loading && (
        data.length === 0
          ? <p className="text-sm text-gray-400 py-4">No deals beyond {days} days without contact.</p>
          : <div className="space-y-2">
              {data.map(deal => {
                const dealSnap = { id: deal.id, name: deal.name, stage: deal.stage, amount: deal.amount, contractEndDate: deal.contractEndDate };
                const isOpen = expanded.has(deal.id);
                const ds = daysSince(deal.lastContactedDate);
                return (
                  <div key={deal.id} className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
                    <button
                      onClick={() => toggle(deal.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{deal.name}</p>
                        {showOwnerColumn && (
                          <p className="text-xs text-gray-400 mt-0.5">{deal.ownerName}</p>
                        )}
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="text-xs font-medium text-gray-700">{fmtDate(deal.lastContactedDate)}</p>
                          {ds != null && <p className="text-xs text-red-400">{ds}d ago</p>}
                        </div>
                        <span className="text-gray-300">{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3 pt-1 border-t border-violet-50">
                        {deal.contacts.length === 0
                          ? <p className="text-xs text-gray-400">No pro users assigned.</p>
                          : <div className="flex flex-wrap gap-1.5">
                              {deal.contacts.map(c => (
                                <ContactChip key={c.id} contact={c} deal={dealSnap} onClick={onContactClick} />
                              ))}
                            </div>
                        }
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire onContactClick in DashboardClient.tsx**

In `components/dashboard/DashboardClient.tsx`, find the OutreachTab render (around line 58):

```tsx
// Before:
      {tab === 'outreach' && (
        <OutreachTab ownerId={ownerId} showOwnerColumn={isManager && ownerId === 'all'} />
      )}

// After:
      {tab === 'outreach' && (
        <OutreachTab ownerId={ownerId} showOwnerColumn={isManager && ownerId === 'all'} onContactClick={openPanel} />
      )}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```
Expected: No TypeScript errors, no lint errors about missing props.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/OutreachTab.tsx components/dashboard/DashboardClient.tsx
git commit -m "feat: outreach tab now shows expandable contact chips instead of client-health links"
```

---

## Task 7: SummaryData type + deals in summary response

**Spec:** B2 (data layer)
**Files:**
- Modify: `types/dashboard.ts` — add `deals` field to `SummaryData`
- Modify: `app/api/dashboard/summary/route.ts` — include deals in response

The Overview drill-down panel (Task 8) needs the full deal+contact list from the summary response.

- [ ] **Step 1: Add deals field to SummaryData**

In `types/dashboard.ts`, update the `SummaryData` interface. Add the `deals` field at the end:

```ts
// Before:
export interface SummaryData {
  totalDeals: number;
  totalContractValue: number;
  totalSeats: number;
  activeContacts: number;
  inactiveContacts: number;
  ghostContacts: number;
  byStage: Record<string, number>;
  byBusinessType: Record<string, number>;
}

// After:
export interface SummaryData {
  totalDeals: number;
  totalContractValue: number;
  totalSeats: number;
  activeContacts: number;
  inactiveContacts: number;
  ghostContacts: number;
  byStage: Record<string, number>;
  byBusinessType: Record<string, number>;
  deals: Array<{
    id: string;
    name: string;
    stage: string;
    amount: number | null;
    contractEndDate: string | null;
    businessType: string | null;
    contacts: DashboardContact[];
  }>;
}
```

- [ ] **Step 2: Include deals in summary route response**

In `app/api/dashboard/summary/route.ts`, the route already has `deals` (DashboardDeal[]) and `contactArrays` in scope. Add the `deals` field to the response. Import `enrichContacts` and update the route:

```ts
// Add enrichContacts to the import from @/lib/dashboard (line 4):
import { enforceOwnerAccess, loginTier, enrichContacts, type SummaryData } from '@/lib/dashboard';
```

Then, in the `data` object construction (around lines 41–50), add the `deals` field:

```ts
    const data: SummaryData = {
      totalDeals: deals.length,
      totalContractValue: Math.round(deals.reduce((s, d) => s + (d.amount ?? 0), 0)),
      totalSeats: deals.reduce((s, d) => s + d.seats, 0),
      activeContacts,
      inactiveContacts,
      ghostContacts,
      byStage,
      byBusinessType,
      deals: deals.map((deal, i) => ({
        id: deal.id,
        name: deal.name,
        stage: deal.stage,
        amount: deal.amount,
        contractEndDate: deal.contractEndDate,
        businessType: deal.businessType,
        contacts: enrichContacts(contactArrays[i]),
      })),
    };
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```
Expected: No TypeScript errors. TypeScript will enforce that `deals` is provided on `SummaryData`.

- [ ] **Step 4: Commit**

```bash
git add types/dashboard.ts app/api/dashboard/summary/route.ts
git commit -m "feat: include deal+contact list in summary response for overview drill-down"
```

---

## Task 8: OverviewTab — clickable business-type bars + drill-down panel

**Spec:** B2 (component changes)
**Files:**
- Modify: `components/dashboard/OverviewTab.tsx` — clickable DistributionTile, drill-down panel, onContactClick prop
- Modify: `components/dashboard/DashboardClient.tsx` — pass onContactClick to OverviewTab

The "By Business Type" distribution tile becomes interactive. Clicking a bar reveals deal cards with contact chips below. The "By Deal Stage" tile remains read-only.

- [ ] **Step 1: Rewrite OverviewTab.tsx**

Replace the entire file:

```tsx
// components/dashboard/OverviewTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { SummaryData, LoginTier, DashboardContact, DashboardDeal } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import SeatTierStat from './SeatTierStat';
import ContactChip from './ContactChip';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

function DistributionTile({
  title,
  counts,
  onSelect,
  selectedLabel,
}: {
  title: string;
  counts: Record<string, number>;
  onSelect?: (label: string) => void;
  selectedLabel?: string | null;
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] ?? 1;
  const colors = ['bg-brand-purple', 'bg-brand-cyan', 'bg-brand-mint', 'bg-brand-pink'];
  return (
    <div className="rounded-2xl p-4 bg-white border border-violet-100">
      <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-brand-purple">{title}</p>
      <div className="space-y-2">
        {entries.map(([label, count], i) => {
          const isSelected = selectedLabel === label;
          const bar = (
            <>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-700">{label}</span>
                <span className="text-gray-400">{count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-violet-50">
                <div className={`h-1.5 rounded-full ${colors[i % colors.length]}`} style={{ width: `${(count / max) * 100}%` }} />
              </div>
            </>
          );
          if (onSelect) {
            return (
              <button
                key={label}
                onClick={() => onSelect(label)}
                className={`w-full text-left rounded p-0.5 transition-colors ${isSelected ? 'bg-violet-50' : 'hover:bg-violet-50/50'}`}
              >
                {bar}
              </button>
            );
          }
          return <div key={label}>{bar}</div>;
        })}
      </div>
    </div>
  );
}

interface Props {
  ownerId: string;
  onNavigateToSeats: (tier: LoginTier) => void;
  onContactClick: (contact: DashboardContact, deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>) => void;
}

export default function OverviewTab({ ownerId, onNavigateToSeats, onContactClick }: Props) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);
  const [selectedBusinessType, setSelectedBusinessType] = useState<string | null>(null);
  const key = dashboardCacheKey('overview', ownerId);

  const load = useCallback(async (bust = false) => {
    if (bust) cacheClear(key);
    const cached = cacheGet<SummaryData>(key);
    if (cached) { setData(cached); setAgeMinutes(cacheAge(key)); return; }
    setLoading(true); setError('');
    try {
      const params = ownerId !== 'all' ? `?ownerId=${ownerId}` : '?ownerId=all';
      const res = await fetch(`/api/dashboard/summary${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      cacheSet(key, json); setData(json); setAgeMinutes(0);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [ownerId, key]);

  useEffect(() => { load(); }, [load]);

  const handleBusinessTypeSelect = (label: string) => {
    setSelectedBusinessType(prev => prev === label ? null : label);
  };

  if (loading) return <LoadingSpinner message="Loading overview…" />;
  if (!data) return (
    error ? (
      <div className="space-y-2 py-4">
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={() => load(true)} className="text-xs text-gray-400 hover:text-brand-purple">Refresh</button>
      </div>
    ) : null
  );

  const drillDeals = selectedBusinessType
    ? data.deals.filter(d => (d.businessType ?? 'Unknown') === selectedBusinessType)
    : [];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => load(true)} className="text-xs text-gray-400 hover:text-brand-purple">
          {ageMinutes != null ? `Updated ${ageMinutes}m ago · ` : ''}Refresh
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Deals', value: data.totalDeals },
          { label: 'Contract Value', value: `$${data.totalContractValue.toLocaleString()}` },
          { label: 'Total Seats', value: data.totalSeats },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 bg-white border border-violet-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">{s.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(['Active', 'Inactive', 'Ghost'] as LoginTier[]).map(tier => (
          <SeatTierStat
            key={tier}
            tier={tier}
            count={tier === 'Active' ? data.activeContacts : tier === 'Inactive' ? data.inactiveContacts : data.ghostContacts}
            onClick={onNavigateToSeats}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DistributionTile title="By Deal Stage" counts={data.byStage} />
        <DistributionTile
          title="By Business Type"
          counts={data.byBusinessType}
          onSelect={handleBusinessTypeSelect}
          selectedLabel={selectedBusinessType}
        />
      </div>

      {/* Business type drill-down panel */}
      {selectedBusinessType && (
        <div className="rounded-2xl border border-violet-100 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">
              {selectedBusinessType} — {drillDeals.length} deal{drillDeals.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => setSelectedBusinessType(null)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            {drillDeals.map(deal => {
              const dealSnap = { id: deal.id, name: deal.name, stage: deal.stage, amount: deal.amount, contractEndDate: deal.contractEndDate };
              return (
                <div key={deal.id} className="rounded-xl border border-violet-50 p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{deal.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{deal.stage}</p>
                    </div>
                    <div className="text-right">
                      {deal.amount != null && (
                        <p className="text-xs font-medium text-gray-700">${deal.amount.toLocaleString()}</p>
                      )}
                      {deal.contractEndDate && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Renewal: {new Date(deal.contractEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  {deal.contacts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {deal.contacts.map(c => (
                        <ContactChip key={c.id} contact={c} deal={dealSnap} onClick={onContactClick} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire onContactClick in DashboardClient.tsx**

In `components/dashboard/DashboardClient.tsx`, find the OverviewTab render (around line 52):

```tsx
// Before:
      {tab === 'overview' && (
        <OverviewTab ownerId={ownerId} onNavigateToSeats={navigateToSeats} />
      )}

// After:
      {tab === 'overview' && (
        <OverviewTab ownerId={ownerId} onNavigateToSeats={navigateToSeats} onContactClick={openPanel} />
      )}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/OverviewTab.tsx components/dashboard/DashboardClient.tsx
git commit -m "feat: overview business-type bars now drill down to deal cards with contact chips"
```

---

## Task 9: Update EmailDraftContext type

**Spec:** C1
**Files:**
- Modify: `lib/dashboard.ts` — update `EmailDraftContext`
- Modify: `components/dashboard/UserSidePanel.tsx` — update `DRAFT_LABELS` to match (prevents TypeScript error)

`open_seats` is removed. `engagement` is added. `renewal` is kept for forward-compatibility. An optional `searchResults` field is added (populated by the API route for engagement emails).

- [ ] **Step 1: Update EmailDraftContext in lib/dashboard.ts**

Replace the `EmailDraftContext` interface (lines 16–31):

```ts
// Before:
export interface EmailDraftContext {
  type: 'inactive_user' | 'open_seats' | 'renewal';
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

// After:
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
  searchResults?: Array<{ title: string; date: string; snippet: string; source: string }>;
}
```

- [ ] **Step 2: Update DRAFT_LABELS in UserSidePanel.tsx**

The component derives `DraftType` from `EmailDraftContext['type']`, so the type change above will automatically narrow it. Update `DRAFT_LABELS` to match:

```ts
// Before (around line 15):
const DRAFT_LABELS: Record<DraftType, string> = {
  inactive_user: 'Inactive User',
  open_seats: 'Open Seats',
  renewal: 'Renewal',
};

// After:
const DRAFT_LABELS: Record<Exclude<DraftType, 'renewal'>, string> = {
  inactive_user: 'Inactive User',
  engagement: 'Engagement',
};
```

Note: `renewal` is excluded from `DRAFT_LABELS` because it will be rendered as a disabled button (not via the map loop). The full UI changes come in Task 13.

Also update the initial `draftType` state default to `'inactive_user'` (which it already is — no change needed there).

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard.ts components/dashboard/UserSidePanel.tsx
git commit -m "feat: update EmailDraftContext type (engagement replaces open_seats, add searchResults)"
```

---

## Task 10: Serper — fetchContactMentions and 60-day filter

**Spec:** C2
**Files:**
- Modify: `lib/serper.ts` — export `RawNewsArticle`, add `fetchContactMentions`, add `filterToLast60Days`

- [ ] **Step 1: Export RawNewsArticle and add helpers**

In `lib/serper.ts`, make `RawNewsArticle` exported (it's currently internal) and add two new exports. Update the file:

Change the `RawNewsArticle` interface declaration from:

```ts
// Internal only — includes snippet for MiniMax context, not sent to the client
interface RawNewsArticle {
```

to:

```ts
// Includes snippet for MiniMax context — not sent to the client directly
export interface RawNewsArticle {
```

Then add the following two functions after `fetchCompanyNews` (before `annotateNewsRelevance`):

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

function parseSerperDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Relative: "3 hours ago", "2 days ago", "1 week ago", "2 months ago"
  const relative = dateStr.match(/^(\d+)\s+(hour|day|week|month)s?\s+ago$/i);
  if (relative) {
    const n = parseInt(relative[1], 10);
    const unit = relative[2].toLowerCase() as 'hour' | 'day' | 'week' | 'month';
    const ms: Record<typeof unit, number> = { hour: 3_600_000, day: 86_400_000, week: 604_800_000, month: 2_592_000_000 };
    return new Date(Date.now() - n * ms[unit]);
  }
  // Absolute: "Jan 5, 2024", "December 31, 2024"
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function filterToLast60Days<T extends { date: string }>(articles: T[]): T[] {
  const cutoff = Date.now() - 60 * 86_400_000;
  return articles.filter(a => {
    const d = parseSerperDate(a.date);
    return d !== null && d.getTime() >= cutoff;
  });
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add lib/serper.ts
git commit -m "feat: add fetchContactMentions and filterToLast60Days to serper lib"
```

---

## Task 11: Rewrite generateEmailDraft

**Spec:** C3
**Files:**
- Modify: `lib/minimax.ts` — rewrite `generateEmailDraft` with new signature and prompts

The function now takes `repName: string` as a second parameter. It reads `searchResults` from the context for the engagement type. The `open_seats` type is gone.

- [ ] **Step 1: Replace generateEmailDraft**

In `lib/minimax.ts`, replace the entire `generateEmailDraft` function (lines 217–253):

```ts
export async function generateEmailDraft(
  ctx: EmailDraftContext,
  repName: string
): Promise<string> {
  const { type, deal, contact, mixpanel, searchResults } = ctx;

  if (type === 'inactive_user') {
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
      ? `\nMixpanel (60 days): logins=${mixpanel.events['loginSuccess'] ?? 0}, exports=${mixpanel.events['exportButtonClicked'] ?? 0}, searches=${mixpanel.events['TopSearchSubmit'] ?? 0}` +
        (mixpanel.healthSignals.length ? `\nSignals: ${mixpanel.healthSignals.join('; ')}` : '')
      : '';

    const prompt = `You are a Customer Success manager at Podchaser.

${dealCtx}
${contactCtx}${mixpanelCtx}

Write a warm, concise re-engagement email (2–3 sentences, under 75 words).
Acknowledge they've been quiet lately. Offer to reconnect and help them get more value from Podchaser.
Tone: Direct and friendly, like a colleague checking in. No 'Dear,' no 'Best,' no 'Sincerely.'
Sign-off: Kindly, ${repName}

Output format:
Subject: [casual subject line, 4 words max, lowercase]
[email body]

Rules: No markdown. Never fabricate data not provided.`;

    const raw = await callMiniMax(prompt);
    return stripThinkingTags(raw);
  }

  if (type === 'engagement') {
    const results = searchResults ?? [];
    const resultList = results
      .map((r, i) => `${i + 1}. ${r.title} — ${r.date} — ${r.snippet}`)
      .join('\n');

    const prompt = `You are a Customer Success manager at Podchaser writing a personalized outreach email.

Contact: ${contact.name}${contact.title ? `, ${contact.title}` : ''} at ${deal.company}

Recent updates (last 60 days):
${resultList}

Instructions:
1. Identify the single most recent and compelling update (a post, announcement, podcast appearance, or quote). Prefer items dated within the last 30 days if available.
2. Write a 3-sentence email (under 50 words) using that hook:
   Sentence 1: Reference the specific update naturally (e.g. "Saw your post on X — your take on Y was spot on")
   Sentence 2: Note it's been a while since we last synced. Offer to help with current projects or growth goals using Podchaser's podcast intelligence tools.
   Sentence 3: Ask one specific, open-ended question about their current focus or a project they're mapping out.
3. Sign-off: Kindly, ${repName}
4. Subject line: casual, 4 words max, no title case, reference the company or the specific topic found.

Output format:
Subject: [subject line]
[email body]

Rules: Only reference information from the search results above. Casual shorthand tone — like a text to a former colleague. No 'Dear,' no 'Best,' no 'Sincerely.' No markdown. Never fabricate information.`;

    const raw = await callMiniMax(prompt);
    return stripThinkingTags(raw);
  }

  throw new Error(`Unsupported email type: ${type}`);
}
```

- [ ] **Step 2: Verify build — one expected error**

```bash
npm run build
```
Expected: Exactly one TypeScript error — `app/api/dashboard/draft/route.ts` still calls `generateEmailDraft(body)` with one argument. That is intentional and fixed in Task 12. All other files should be error-free.

- [ ] **Step 3: Commit**

```bash
git add lib/minimax.ts
git commit -m "feat: rewrite generateEmailDraft with inactive_user and engagement prompts"
```

---

## Task 12: Draft API route changes

**Spec:** C4
**Files:**
- Modify: `app/api/dashboard/draft/route.ts` — inject repName, reject renewal, run Serper for engagement

- [ ] **Step 1: Replace the route**

Replace the entire file contents of `app/api/dashboard/draft/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateEmailDraft } from '@/lib/minimax';
import { fetchCompanyNews, fetchContactMentions, filterToLast60Days } from '@/lib/serper';
import type { EmailDraftContext } from '@/lib/dashboard';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const repName = session.user.name ?? 'Your CS rep';

  let body: EmailDraftContext;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.type || !body.deal || !body.contact) {
    return NextResponse.json({ error: 'type, deal, and contact are required' }, { status: 400 });
  }

  if (body.type === 'renewal') {
    return NextResponse.json({ error: 'Renewal emails not yet available' }, { status: 400 });
  }

  if (body.type === 'engagement') {
    const [companyNews, contactMentions] = await Promise.all([
      fetchCompanyNews(body.deal.company, 5),
      fetchContactMentions(body.contact.name, body.deal.company),
    ]);

    const filtered = filterToLast60Days([...companyNews, ...contactMentions]);

    if (filtered.length === 0) {
      const noResults = `No recent updates found for ${body.contact.name} or ${body.deal.company} in the last 60 days. Try a different email type or search manually.`;
      return NextResponse.json({ draft: noResults });
    }

    body = {
      ...body,
      searchResults: filtered.map(a => ({
        title: a.title,
        date: a.date,
        snippet: a.snippet,
        source: a.source,
      })),
    };
  }

  try {
    const draft = await generateEmailDraft(body, repName);
    return NextResponse.json({ draft });
  } catch (e) {
    console.error('[dashboard/draft]', e);
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/dashboard/draft/route.ts
git commit -m "feat: draft route injects repName, runs Serper for engagement, rejects renewal"
```

---

## Task 13: UserSidePanel UI changes

**Spec:** C5
**Files:**
- Modify: `components/dashboard/UserSidePanel.tsx` — new draft type selector, Renewal disabled, engagement loading state, no-results display

Key changes:
- Render Inactive User and Engagement as selectable buttons (from `DRAFT_LABELS`)
- Render Renewal as a disabled button with tooltip ("Coming soon — requires verified deal data")
- Engagement shows "Researching [Company]…" during loading
- No-results string is shown as a grey notice, not in the textarea
- "Last 60 days" label was added in Task 4 (already done)

- [ ] **Step 1: Update the Generate Draft section**

In `components/dashboard/UserSidePanel.tsx`, replace the entire **Email draft** section (lines 154–194, from the `<section>` to its closing `</section>`):

```tsx
          {/* Email draft */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-2">Generate Draft</p>
            <div className="flex gap-1 flex-wrap mb-3">
              {(Object.keys(DRAFT_LABELS) as Array<keyof typeof DRAFT_LABELS>).map(t => (
                <button
                  key={t}
                  onClick={() => { setDraftType(t); setDraft(null); }}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    draftType === t
                      ? 'bg-brand-purple text-white'
                      : 'bg-violet-50 text-brand-purple hover:bg-violet-100'
                  }`}
                >
                  {DRAFT_LABELS[t]}
                </button>
              ))}
              {/* Renewal — always disabled */}
              <div className="relative group">
                <button
                  disabled
                  className="text-xs px-2.5 py-1 rounded-full font-medium bg-violet-50 text-brand-purple opacity-50 cursor-not-allowed"
                >
                  Renewal
                </button>
                <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10 w-48 rounded-lg bg-gray-800 text-white text-xs px-2 py-1.5 shadow-lg">
                  Coming soon — requires verified deal data
                </div>
              </div>
            </div>
            <button
              onClick={generateDraft}
              disabled={draftLoading}
              className="w-full text-xs px-3 py-1.5 rounded-lg bg-brand-purple text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              {draftLoading
                ? draftType === 'engagement'
                  ? `Researching ${deal.name}…`
                  : 'Generating…'
                : 'Generate Draft'}
            </button>
            {draft && (
              <div className="mt-3">
                {draft.startsWith('No recent updates found') ? (
                  <p className="text-xs text-gray-400 leading-relaxed">{draft}</p>
                ) : (
                  <>
                    <textarea
                      readOnly
                      value={draft}
                      className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none h-44 text-gray-700 leading-relaxed"
                    />
                    <button
                      onClick={copy}
                      className="mt-1.5 w-full text-xs px-3 py-1.5 rounded-lg bg-violet-50 text-brand-purple font-medium hover:bg-violet-100"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/UserSidePanel.tsx
git commit -m "feat: side panel shows Engagement/Inactive User drafts, Renewal disabled with tooltip"
```

---

## Verification Checklist

After all tasks are committed:

- [ ] `npm run build` passes clean
- [ ] Open dashboard → Overview tab: seats shows real numbers (not 0)
- [ ] Open a deal with a signed quote (e.g., RAD Strategies): status shows "Accepted" not "Draft"
- [ ] Pull Mixpanel on any user: "Last 60 days" label appears above event counts
- [ ] Outreach tab: deal rows expand, contact chips appear, clicking chip opens side panel
- [ ] Overview tab: clicking a business type bar shows drill-down with deal cards and contact chips
- [ ] Side panel → Generate Draft → Engagement: shows "Researching [Company]…" during load
- [ ] Side panel → Generate Draft → Renewal: button is greyed out, tooltip shows on hover
- [ ] Side panel → Inactive User draft: generates a subject + body using new prompt
