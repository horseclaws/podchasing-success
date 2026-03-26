# Owner Filter & Card Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side owner filtering (All / Jon / Jules / Sydney) to the client health results list, and surface owner name and business type on each deal card.

**Architecture:** `ownerId` is added to `RawDealResult` and populated by `mapDealToRaw()`. A new `OwnerFilter` component renders owner pills. The page derives `filteredResults` inline from `results` and passes it to both the dashboard and list. `DealResultCard` gains two new metadata lines.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS. No test runner — verify with `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-03-25-owner-filter-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `lib/deal-scoring.ts` | Add `ownerId: string \| null` to `RawDealResult` |
| Modify | `lib/hubspot.ts` | Add `hubspot_owner_id` to `SEARCH_PROPS`; populate `ownerId` in `mapDealToRaw()` |
| Create | `components/client-health/OwnerFilter.tsx` | Four owner pills with active-highlight |
| Modify | `components/client-health/DealResultCard.tsx` | Add owner name + business type to right-side metadata |
| Modify | `app/client-health/page.tsx` | Add `ownerFilter` state, compute `filteredResults`, render `OwnerFilter` |

---

## Task 1: Add ownerId to RawDealResult

**Files:**
- Modify: `lib/deal-scoring.ts`

- [ ] **Step 1: Add the field**

In `lib/deal-scoring.ts`, add `ownerId` as the last field of `RawDealResult`, after `company`:

```typescript
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
  ownerId: string | null;            // hubspot_owner_id
}
```

`DealResult extends RawDealResult` — no change needed there.

- [ ] **Step 2: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: errors in `lib/hubspot.ts` only (mapDealToRaw now missing the field) — those are fixed next. Zero errors in `lib/deal-scoring.ts` itself.

---

## Task 2: Update lib/hubspot.ts

**Files:**
- Modify: `lib/hubspot.ts`

- [ ] **Step 1: Add hubspot_owner_id to SEARCH_PROPS**

Change `SEARCH_PROPS` (currently at lines 56–59) from:

```typescript
const SEARCH_PROPS = [
  'dealname', 'dealstage', 'pipeline', 'amount',
  'contract_end_date', 'notes_last_contacted', 'business_type',
];
```

To:

```typescript
const SEARCH_PROPS = [
  'dealname', 'dealstage', 'pipeline', 'amount',
  'contract_end_date', 'notes_last_contacted', 'business_type',
  'hubspot_owner_id',
];
```

- [ ] **Step 2: Add ownerId to mapDealToRaw**

In `mapDealToRaw()` (currently lines 61–74), add `ownerId` after the `company` field:

```typescript
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
    ownerId: p.hubspot_owner_id ?? null,
  };
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 3: Create OwnerFilter component

**Files:**
- Create: `components/client-health/OwnerFilter.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client';

const OWNERS = [
  { id: '1774818015', label: 'Jon' },
  { id: '184892201',  label: 'Jules' },
  { id: '157100429',  label: 'Sydney' },
];

interface Props {
  activeOwner: string | null;
  onSelect: (ownerId: string | null) => void;
}

export default function OwnerFilter({ activeOwner, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {/* All pill */}
      <button
        onClick={() => onSelect(null)}
        className="text-xs font-semibold px-4 py-2 rounded-xl transition-all"
        style={{
          backgroundColor: activeOwner === null ? '#4A027D' : '#F3F0F8',
          color: activeOwner === null ? '#ffffff' : '#4A027D',
          border: `1.5px solid ${activeOwner === null ? '#4A027D' : '#e5e7eb'}`,
        }}
      >
        All
      </button>

      {OWNERS.map(({ id, label }) => {
        const isActive = activeOwner === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(isActive ? null : id)}
            className="text-xs font-semibold px-4 py-2 rounded-xl transition-all"
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

Note: clicking an active owner pill calls `onSelect(null)` — clearing the filter back to All. The "All" pill calls `onSelect(null)` directly. Either action resets the filter.

- [ ] **Step 2: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 4: Update DealResultCard

**Files:**
- Modify: `components/client-health/DealResultCard.tsx`

- [ ] **Step 1: Add ownerName import and two metadata lines**

Replace the entire file with:

```typescript
import type { DealResult } from '@/lib/deal-scoring';
import { ownerName } from '@/lib/hubspot';

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
          {deal.ownerId && (
            <p className="text-xs" style={{ color: '#9ca3af' }}>{ownerName(deal.ownerId)}</p>
          )}
          {deal.businessType && (
            <p className="text-xs" style={{ color: '#9ca3af' }}>{deal.businessType}</p>
          )}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 5: Wire OwnerFilter into page.tsx

**Files:**
- Modify: `app/client-health/page.tsx`

- [ ] **Step 1: Rewrite the file**

```typescript
'use client';
import { useState } from 'react';
import { scoreDealSet, type RawDealResult, type DealResult } from '@/lib/deal-scoring';
import ClientSearchBar from '@/components/client-health/ClientSearchBar';
import PollButtons from '@/components/client-health/PollButtons';
import OwnerFilter from '@/components/client-health/OwnerFilter';
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
  const [ownerFilter, setOwnerFilter]       = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal]     = useState<DealResult | null>(null);
  const [report, setReport]                 = useState<Record<string, unknown> | null>(null);
  const [reportLoading, setReportLoading]   = useState(false);
  const [reportError, setReportError]       = useState('');

  const filteredResults = ownerFilter
    ? results.filter(d => d.ownerId === ownerFilter)
    : results;

  function handleSearchResults(raw: RawDealResult[]) {
    setMode('search');
    setResults(scoreDealSet(raw));
    setListError('');
  }

  async function handlePoll(type: 'renew_30' | 'renew_60' | 'contacted_45') {
    setMode(`poll_${type}` as Mode);  // highlight immediately before fetch
    setListLoading(true);
    setListError('');
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
              <OwnerFilter activeOwner={ownerFilter} onSelect={setOwnerFilter} />
              <ResultsDashboard deals={filteredResults} />
              <DealResultsList deals={filteredResults} onSelect={handleSelectDeal} />
              {filteredResults.length === 0 && (
                <p className="text-sm py-4" style={{ color: '#9ca3af' }}>No deals match this owner.</p>
              )}
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

Expected: **zero errors**. If errors appear, fix them before proceeding.
