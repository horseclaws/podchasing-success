# Client Health Search/Poll Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the auto-selecting client search with a scored results list, add three deal-poll shortcut buttons, and display an aggregate dashboard above every result set.

**Architecture:** A new `lib/deal-scoring.ts` module owns the shared types (`RawDealResult`, `DealResult`) and client-side scoring function. `lib/hubspot.ts` gains stage-label helpers and two new query functions (`searchDeals`, `pollDeals`). Two API routes return raw deal arrays. Five React components are created or updated. All UI state lives in `app/client-health/page.tsx`.

**Tech Stack:** Next.js App Router, TypeScript, HubSpot CRM Search API, inline brand styles (#4A027D, #FB0467, #0DAAC9, #2BDA9F, #FFEF70). No test runner — verify with `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-03-24-client-health-search-poll-redesign.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `lib/deal-scoring.ts` | `RawDealResult`, `DealResult` types + `scoreDealSet()` |
| Modify | `lib/hubspot.ts` | Add `STAGE_LABELS`, `stageLabel()`, `SEARCH_PROPS`, `mapDealToRaw()`, `searchDeals()`, `pollDeals()` |
| Modify | `app/api/hubspot/search/route.ts` | Return `{ deals: RawDealResult[] }` instead of flat company array |
| Create | `app/api/hubspot/poll/route.ts` | Poll by renewal window or last-contact cutoff |
| Create | `components/client-health/PollButtons.tsx` | Three poll shortcut buttons with active-highlight |
| Create | `components/client-health/DealResultCard.tsx` | Single deal row: score badge, name, amount, dates |
| Create | `components/client-health/DealResultsList.tsx` | List wrapper, slices to top 50 |
| Create | `components/client-health/ResultsDashboard.tsx` | Total value tile + two distribution tiles |
| Modify | `components/client-health/ClientSearchBar.tsx` | Remove auto-select; call `onResults(deals[])` |
| Modify | `app/client-health/page.tsx` | Wire all components; manage mode/results/selected state |

---

## Task 1: Create lib/deal-scoring.ts

**Files:**
- Create: `lib/deal-scoring.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/deal-scoring.ts

export interface RawDealResult {
  id: string;
  name: string;
  stage: string;           // human-readable label (already mapped by API)
  pipeline: string;
  amount: number | null;
  contractEndDate: string | null;    // ISO date string e.g. "2026-04-01"
  lastContactedDate: string | null;  // ISO date string
  businessType: string | null;
  company: { id: string | null; name: string; domain: string | null };
}

export interface DealResult extends RawDealResult {
  scoreValue: number;     // 0–100
  scoreContact: number;   // 0–100
  scoreRenewal: number;   // 0–100
  totalScore: number;     // 0–300
}

function norm(value: number, max: number): number {
  return max > 0 ? (value / max) * 100 : 0;
}

function daysUntilRenewal(deal: RawDealResult): number | null {
  if (!deal.contractEndDate) return null;
  return Math.round((new Date(deal.contractEndDate).getTime() - Date.now()) / 86_400_000);
}

export function scoreDealSet(deals: RawDealResult[]): DealResult[] {
  if (!deals.length) return [];

  const amounts = deals.map(d => d.amount ?? 0);
  const contactDays = deals.map(d =>
    d.lastContactedDate
      ? Math.round((Date.now() - new Date(d.lastContactedDate).getTime()) / 86_400_000)
      : 0
  );
  const renewalDays = deals.map(d => daysUntilRenewal(d));

  const maxAmount  = Math.max(...amounts, 0);
  const maxContact = Math.max(...contactDays, 0);

  const validRenewal = renewalDays.filter((d): d is number => d !== null);
  const maxRenewal   = validRenewal.length > 0 ? Math.max(...validRenewal) : null;

  return deals
    .map((deal, i) => {
      const scoreValue   = norm(amounts[i], maxAmount);
      const scoreContact = norm(contactDays[i], maxContact);

      let scoreRenewal: number;
      if (renewalDays[i] === null) {
        scoreRenewal = 0;
      } else if (maxRenewal === null || maxRenewal <= 0) {
        scoreRenewal = 100;
      } else {
        scoreRenewal = Math.min(100, Math.max(0,
          norm(maxRenewal - renewalDays[i], maxRenewal)));
      }

      return {
        ...deal,
        scoreValue:   Math.round(scoreValue),
        scoreContact: Math.round(scoreContact),
        scoreRenewal: Math.round(scoreRenewal),
        totalScore:   Math.round(scoreValue + scoreContact + scoreRenewal),
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: zero errors in `lib/deal-scoring.ts` (other pre-existing errors are fine for now).

- [ ] **Step 3: Commit**

```bash
git add lib/deal-scoring.ts
git commit -m "feat: add RawDealResult/DealResult types and scoreDealSet utility"
```

---

## Task 2: Update lib/hubspot.ts — stage labels, searchDeals, pollDeals

**Files:**
- Modify: `lib/hubspot.ts`

**Context:** `lib/hubspot.ts` currently exports `searchCompanies` (returns company-shaped objects, only caller is `app/api/hubspot/search/route.ts`). We replace it with `searchDeals` and add `pollDeals`. The `HubSpotCompanyResult` interface is removed.

- [ ] **Step 1: Confirm no other callers of searchCompanies**

```bash
grep -r "searchCompanies" "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" --include="*.ts" --include="*.tsx"
```

Expected: only `app/api/hubspot/search/route.ts`. If other callers appear, **stop and note them** before continuing.

- [ ] **Step 2: Add import and stage-label map**

At the very top of `lib/hubspot.ts`, add the import:

```typescript
import type { RawDealResult } from '@/lib/deal-scoring';
```

After `const BASE = 'https://api.hubapi.com';`, add:

```typescript
export const STAGE_LABELS: Record<string, string> = {
  '10311744':   'Onboarding',
  '1236558246': 'Money Back Window',
  '191321462':  'Basic Pro',
  '10311745':   'Engagement',
  '10311748':   'At Risk',
  '11544543':   'Monthly Renewal',
  '10311746':   'Promised Renewal',
  '12714085':   'Connect/API Deals',
  '8879384':    'Paused/Feature Release',
};

export function stageLabel(stageId: string): string {
  return STAGE_LABELS[stageId] ?? stageId;
}
```

- [ ] **Step 3: Add SEARCH_PROPS and mapDealToRaw**

After the `DEAL_PROPS` const (currently ends around line 71), add:

```typescript
// Properties for search/poll list queries (subset — full deal uses DEAL_PROPS)
const SEARCH_PROPS = [
  'dealname', 'dealstage', 'pipeline', 'amount',
  'contract_end_date', 'notes_last_contacted', 'business_type',
];

function mapDealToRaw(d: { id: string; properties: Record<string, string | null> }): RawDealResult {
  const p = d.properties;
  return {
    id: d.id,
    name: p.dealname ?? '',
    stage: stageLabel(p.dealstage ?? ''),
    pipeline: p.pipeline ?? '',
    amount: p.amount != null && p.amount !== '' ? parseFloat(p.amount) : null,
    contractEndDate: p.contract_end_date ?? null,
    lastContactedDate: p.notes_last_contacted ?? null,
    businessType: p.business_type ?? null,
    company: { id: null, name: '', domain: null },
  };
}
```

- [ ] **Step 4: Replace searchCompanies and remove HubSpotCompanyResult**

Delete the entire `searchCompanies` function and the `HubSpotCompanyResult` interface. Replace with:

```typescript
export async function searchDeals(name: string): Promise<RawDealResult[]> {
  const token = name.trim().split(/[\s\-()+]+/)
    .filter(w => w.length > 3)
    .sort((a, b) => b.length - a.length)[0] ?? name.trim();

  const result = await hubspotPost('/crm/v3/objects/deals/search', {
    filterGroups: [{
      filters: [
        { propertyName: 'dealname', operator: 'CONTAINS_TOKEN', value: token },
        { propertyName: 'pipeline', operator: 'EQ', value: PIPELINE_ID },
        { propertyName: 'dealstage', operator: 'IN', values: VALID_STAGES },
      ],
    }],
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    properties: SEARCH_PROPS,
    limit: 20,
  });

  return (result.results ?? []).map(mapDealToRaw);
}
```

- [ ] **Step 5: Add pollDeals**

Add immediately after `searchDeals`:

```typescript
export async function pollDeals(
  type: 'renew_30' | 'renew_60' | 'contacted_45'
): Promise<RawDealResult[]> {
  const now = Date.now();
  const dayMs = 86_400_000;

  let filterGroups: unknown[];

  if (type === 'renew_30') {
    filterGroups = [{
      filters: [
        { propertyName: 'contract_end_date', operator: 'BETWEEN',
          value: String(now), highValue: String(now + 30 * dayMs) },
        { propertyName: 'pipeline', operator: 'EQ', value: PIPELINE_ID },
      ],
    }];
  } else if (type === 'renew_60') {
    filterGroups = [{
      filters: [
        { propertyName: 'contract_end_date', operator: 'BETWEEN',
          value: String(now), highValue: String(now + 60 * dayMs) },
        { propertyName: 'pipeline', operator: 'EQ', value: PIPELINE_ID },
      ],
    }];
  } else {
    // contacted_45: last contacted more than 45 days ago
    filterGroups = [{
      filters: [
        { propertyName: 'notes_last_contacted', operator: 'LT',
          value: String(now - 45 * dayMs) },
        { propertyName: 'pipeline', operator: 'EQ', value: PIPELINE_ID },
        { propertyName: 'dealstage', operator: 'IN', values: VALID_STAGES },
      ],
    }];
  }

  const result = await hubspotPost('/crm/v3/objects/deals/search', {
    filterGroups,
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    properties: SEARCH_PROPS,
    limit: 100,
  });

  return (result.results ?? []).map(mapDealToRaw);
}
```

- [ ] **Step 6: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: zero new errors. The `app/api/hubspot/search/route.ts` will error on the removed `searchCompanies` export — that's expected and fixed in the next task.

- [ ] **Step 7: Commit**

```bash
git add lib/hubspot.ts
git commit -m "feat: add stageLabel, searchDeals, pollDeals to lib/hubspot"
```

---

## Task 3: Update POST /api/hubspot/search

**Files:**
- Modify: `app/api/hubspot/search/route.ts`

**Context:** Currently imports `searchCompanies` (removed) and returns a flat array. Replace the entire file.

- [ ] **Step 1: Rewrite the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchDeals } from '@/lib/hubspot';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  try {
    const deals = await searchDeals(name);
    return NextResponse.json({ deals });
  } catch (err) {
    console.error('[search] searchDeals threw:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/hubspot/search/route.ts
git commit -m "feat: update /api/hubspot/search to return { deals: RawDealResult[] }"
```

---

## Task 4: Create POST /api/hubspot/poll

**Files:**
- Create: `app/api/hubspot/poll/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pollDeals } from '@/lib/hubspot';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type } = await req.json();
  if (!['renew_30', 'renew_60', 'contacted_45'].includes(type)) {
    return NextResponse.json(
      { error: 'type must be renew_30, renew_60, or contacted_45' },
      { status: 400 }
    );
  }

  try {
    const deals = await pollDeals(type as 'renew_30' | 'renew_60' | 'contacted_45');
    return NextResponse.json({ deals });
  } catch (err) {
    console.error('[poll] pollDeals threw:', err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/hubspot/poll/route.ts
git commit -m "feat: add /api/hubspot/poll route"
```

---

## Task 5: Create PollButtons component

**Files:**
- Create: `components/client-health/PollButtons.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client';

type PollType = 'renew_30' | 'renew_60' | 'contacted_45';
type Mode = 'idle' | 'search' | 'poll_renew_30' | 'poll_renew_60' | 'poll_contacted_45';

interface Props {
  activeMode: Mode;
  disabled: boolean;
  onPoll: (type: PollType) => void;
}

const BUTTONS: { type: PollType; label: string }[] = [
  { type: 'renew_30',     label: 'Renewing in 30 days' },
  { type: 'renew_60',     label: 'Renewing in 60 days' },
  { type: 'contacted_45', label: 'Last Contacted 45+ days' },
];

export default function PollButtons({ activeMode, disabled, onPoll }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {BUTTONS.map(({ type, label }) => {
        const isActive = activeMode === `poll_${type}`;
        return (
          <button
            key={type}
            onClick={() => onPoll(type)}
            disabled={disabled}
            className="text-xs font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-40"
            style={{
              backgroundColor: isActive ? '#4A027D' : '#F3F0F8',
              color: isActive ? '#ffffff' : '#4A027D',
              border: `1.5px solid ${isActive ? '#4A027D' : '#e5e7eb'}`,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/client-health/PollButtons.tsx
git commit -m "feat: add PollButtons component"
```

---

## Task 6: Create DealResultCard component

**Files:**
- Create: `components/client-health/DealResultCard.tsx`

- [ ] **Step 1: Create the file**

```typescript
import type { DealResult } from '@/lib/deal-scoring';

interface Props {
  deal: DealResult;
  onSelect: () => void;
}

function formatAmount(amount: number | null): string {
  if (amount === null) return '—';
  return '$' + Math.round(amount).toLocaleString('en-US');
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysSince(iso: string | null): string {
  if (!iso) return '—';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return `${days}d ago`;
}

export default function DealResultCard({ deal, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-2xl p-4 transition-all"
      style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 8px rgba(74,2,125,0.05)' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#4A027D')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#ede9f5')}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Score badge + deal name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="shrink-0 rounded-lg px-2 py-1 text-center"
            style={{ backgroundColor: '#F3F0F8', minWidth: '52px' }}
          >
            <div className="text-sm font-bold" style={{ color: '#4A027D' }}>{deal.totalScore}</div>
            <div style={{ color: '#9ca3af', fontSize: '10px' }}>score</div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: '#1a1a2e' }}>{deal.name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{deal.stage}</p>
          </div>
        </div>
        {/* Right-side metadata */}
        <div className="shrink-0 text-right space-y-0.5">
          <p className="text-sm font-semibold" style={{ color: '#4A027D' }}>{formatAmount(deal.amount)}</p>
          {deal.contractEndDate && (
            <p className="text-xs" style={{ color: '#9ca3af' }}>Renews {formatDate(deal.contractEndDate)}</p>
          )}
          {deal.lastContactedDate && (
            <p className="text-xs" style={{ color: '#9ca3af' }}>Contacted {daysSince(deal.lastContactedDate)}</p>
          )}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/client-health/DealResultCard.tsx
git commit -m "feat: add DealResultCard component"
```

---

## Task 7: Create DealResultsList component

**Files:**
- Create: `components/client-health/DealResultsList.tsx`

- [ ] **Step 1: Create the file**

```typescript
import type { DealResult } from '@/lib/deal-scoring';
import DealResultCard from './DealResultCard';

interface Props {
  deals: DealResult[];
  onSelect: (deal: DealResult) => void;
}

export default function DealResultsList({ deals, onSelect }: Props) {
  const visible = deals.slice(0, 50);
  return (
    <div className="space-y-2">
      {visible.map(deal => (
        <DealResultCard key={deal.id} deal={deal} onSelect={() => onSelect(deal)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/client-health/DealResultsList.tsx
git commit -m "feat: add DealResultsList component"
```

---

## Task 8: Create ResultsDashboard component

**Files:**
- Create: `components/client-health/ResultsDashboard.tsx`

- [ ] **Step 1: Create the file**

```typescript
import type { DealResult } from '@/lib/deal-scoring';

interface Props {
  deals: DealResult[];   // full scored set, not capped
}

const BAR_COLORS = ['#4A027D', '#0DAAC9', '#2BDA9F', '#FB0467'];

function DistributionTile({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] ?? 1;
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5' }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A027D' }}>{title}</p>
      <div className="space-y-2">
        {entries.map(([label, count], i) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span style={{ color: '#374151' }}>{label}</span>
              <span style={{ color: '#9ca3af' }}>{count}</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ backgroundColor: '#F3F0F8' }}>
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: `${(count / max) * 100}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResultsDashboard({ deals }: Props) {
  const totalValue = deals.reduce((sum, d) => sum + (d.amount ?? 0), 0);

  const byType: Record<string, number> = {};
  for (const d of deals) {
    const key = d.businessType || 'Unknown';
    byType[key] = (byType[key] ?? 0) + 1;
  }

  const byStage: Record<string, number> = {};
  for (const d of deals) {
    const key = d.stage || 'Unknown';
    byStage[key] = (byStage[key] ?? 0) + 1;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
      {/* Total value tile */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A027D' }}>Total Contract Value</p>
        <p className="text-2xl font-bold" style={{ color: '#1a1a2e' }}>
          ${Math.round(totalValue).toLocaleString('en-US')}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
          {deals.length} deal{deals.length !== 1 ? 's' : ''}
        </p>
      </div>
      <DistributionTile title="By Business Type" counts={byType} />
      <DistributionTile title="By Deal Stage" counts={byStage} />
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/client-health/ResultsDashboard.tsx
git commit -m "feat: add ResultsDashboard component"
```

---

## Task 9: Update ClientSearchBar

**Files:**
- Modify: `components/client-health/ClientSearchBar.tsx`

**Context:** Currently accepts `onSelect(company)` and auto-selects on single result. Replace entirely with the new signature that calls `onResults(deals[])` and never auto-selects.

- [ ] **Step 1: Rewrite the file**

```typescript
'use client';
import { useState } from 'react';
import type { RawDealResult } from '@/lib/deal-scoring';

interface Props {
  onResults: (deals: RawDealResult[]) => void;
  disabled?: boolean;
}

export default function ClientSearchBar({ onResults, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/hubspot/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ? `Search error: ${data.error}` : 'Search failed. Try again.');
        return;
      }
      onResults(data.deals ?? []);
    } catch {
      setError('Search failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-3">
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setError(''); }}
          placeholder="Search client by deal name…"
          disabled={disabled || loading}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-shadow disabled:opacity-60"
          style={{ border: '1.5px solid #e5e7eb', backgroundColor: '#ffffff', color: '#1a1a2e' }}
          onFocus={e => (e.target.style.borderColor = '#4A027D')}
          onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
        />
        <button
          type="submit"
          disabled={disabled || loading || !query.trim()}
          className="px-5 py-2.5 text-sm font-semibold rounded-xl transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#FB0467', color: '#ffffff' }}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <p className="text-sm mt-2" style={{ color: '#6b7280' }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: error in `app/client-health/page.tsx` (still references old `onSelect` prop) — that's fine, fixed next.

- [ ] **Step 3: Commit**

```bash
git add components/client-health/ClientSearchBar.tsx
git commit -m "feat: update ClientSearchBar — remove auto-select, expose onResults"
```

---

## Task 10: Rewrite app/client-health/page.tsx

**Files:**
- Modify: `app/client-health/page.tsx`

**Context:** Replaces the `selectedCompany`/`report`/`loading` pattern with `mode`, `results`, `listLoading`, `reportLoading`, `selectedDeal`, and `report`. Wires in all new components.

- [ ] **Step 1: Rewrite the file**

```typescript
'use client';
import { useState } from 'react';
import { scoreDealSet, type RawDealResult, type DealResult } from '@/lib/deal-scoring';
import ClientSearchBar from '@/components/client-health/ClientSearchBar';
import PollButtons from '@/components/client-health/PollButtons';
import ResultsDashboard from '@/components/client-health/ResultsDashboard';
import DealResultsList from '@/components/client-health/DealResultsList';
import HealthReportView from '@/components/client-health/HealthReportView';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

type Mode = 'idle' | 'search' | 'poll_renew_30' | 'poll_renew_60' | 'poll_contacted_45';

export default function ClientHealthPage() {
  const [mode, setMode]                     = useState<Mode>('idle');
  const [results, setResults]               = useState<DealResult[]>([]);
  const [listLoading, setListLoading]       = useState(false);
  const [listError, setListError]           = useState('');
  const [selectedDeal, setSelectedDeal]     = useState<DealResult | null>(null);
  const [report, setReport]                 = useState<Record<string, unknown> | null>(null);
  const [reportLoading, setReportLoading]   = useState(false);
  const [reportError, setReportError]       = useState('');

  function handleSearchResults(raw: RawDealResult[]) {
    setMode('search');
    setResults(scoreDealSet(raw));
    setListError('');
  }

  async function handlePoll(type: 'renew_30' | 'renew_60' | 'contacted_45') {
    setMode(`poll_${type}` as Mode);  // highlight immediately before fetch
    setListLoading(true);
    setListError('');
    setResults([]);
    try {
      const res = await fetch('/api/hubspot/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Poll failed');
      setResults(scoreDealSet(data.deals ?? []));
    } catch (e) {
      setListError((e as Error).message);
    } finally {
      setListLoading(false);
    }
  }

  async function handleSelectDeal(deal: DealResult) {
    setSelectedDeal(deal);
    setReport(null);
    setReportError('');
    setReportLoading(true);
    try {
      const res = await fetch('/api/hubspot/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load client report.');
      setReport(data);
    } catch (e) {
      setReportError((e as Error).message);
      setSelectedDeal(null);
    } finally {
      setReportLoading(false);
    }
  }

  function handleReset() {
    setSelectedDeal(null);
    setReport(null);
    setReportError('');
  }

  const showHealthReport = !!(selectedDeal && report && !reportLoading);
  const showList         = !selectedDeal && !reportLoading;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#1a1a2e' }}>Client Health</h1>

      <ClientSearchBar onResults={handleSearchResults} disabled={listLoading} />
      <PollButtons activeMode={mode} disabled={listLoading} onPoll={handlePoll} />

      {/* Health report loading/error/view */}
      {reportLoading && selectedDeal && (
        <LoadingSpinner message={`Loading report for ${selectedDeal.name}…`} />
      )}
      {reportError && (
        <p className="text-sm py-4" style={{ color: '#6b7280' }}>{reportError}</p>
      )}
      {showHealthReport && (
        <HealthReportView report={report!} onReset={handleReset} />
      )}

      {/* Results list view */}
      {showList && (
        <>
          {listLoading && <LoadingSpinner message="Loading deals…" />}
          {!listLoading && listError && (
            <p className="text-sm py-4" style={{ color: '#6b7280' }}>{listError}</p>
          )}
          {!listLoading && !listError && results.length > 0 && (
            <>
              <ResultsDashboard deals={results} />
              <DealResultsList deals={results} onSelect={handleSelectDeal} />
            </>
          )}
          {!listLoading && !listError && results.length === 0 && mode !== 'idle' && (
            <p className="text-sm py-4" style={{ color: '#9ca3af' }}>
              {mode === 'search' ? 'No deals found.' : 'No deals match this criterion.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile — zero errors expected**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: **zero errors**. If errors appear, fix them before committing.

- [ ] **Step 3: Commit**

```bash
git add app/client-health/page.tsx
git commit -m "feat: rewrite client health page — search list, poll buttons, dashboard"
```

---

## Task 11: Browser smoke test

**Context:** No automated test runner. Manually verify the feature end-to-end against a running dev server.

- [ ] **Step 1: Start dev server**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npm run dev
```

Open `http://localhost:3000/client-health`.

- [ ] **Step 2: Search shows a list (never auto-opens)**

Type a known deal name (e.g. a partial company name you know exists) and click Search.

Expected:
- A list of scored deal cards appears, sorted by score descending.
- Each card shows a score badge, deal name, stage, amount, renewal date, and days-since-contact.
- No health report auto-opens even if there is only one result.

- [ ] **Step 3: Dashboard appears above results**

Expected:
- Three tiles: Total Contract Value (formatted as $X,XXX), By Business Type distribution, By Deal Stage distribution.
- Color bars proportional to largest category.

- [ ] **Step 4: Clicking a deal opens health report**

Click any result card.

Expected:
- Loading spinner appears.
- Full `HealthReportView` renders (company name, health tier badge, AI summary, etc.).
- Search bar and poll buttons are hidden while report is shown.

- [ ] **Step 5: Back button restores results**

Click the back/reset button in `HealthReportView`.

Expected:
- Results list and dashboard restore exactly as before.
- Search input still shows the original query.
- No poll button is active (was a search result).

- [ ] **Step 6: Poll buttons work**

Click "Renewing in 30 days".

Expected:
- Button highlights immediately (purple background).
- Spinner shows "Loading deals…".
- Results load with deals whose contracts end within 30 days.
- Dashboard updates to reflect those deals.

Click "Last Contacted 45+ days".

Expected:
- Previous button un-highlights.
- New button highlights immediately.
- Results update.

- [ ] **Step 7: Poll → search clears poll highlight**

With a poll active, type a search and submit.

Expected:
- Poll button un-highlights.
- Search results appear.
- Search query text preserved after poll clicks.

- [ ] **Step 8: Confirm clean working tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`. If stray changes exist, review and commit or discard.
