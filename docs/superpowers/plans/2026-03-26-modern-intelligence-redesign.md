# Modern Intelligence — Full System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Modern Intelligence design system across the entire app — replacing inline styles with Tailwind tokens, adopting the `ui/` component library, fixing off-brand blue colors, and adding consistent page headers.

**Architecture:** 11 self-contained tasks grouped by page/component area. Each task modifies one or a few closely related files and ends with a commit. No new APIs, no layout restructuring, no logic changes — purely visual.

**Tech Stack:** Next.js (App Router), Tailwind CSS v4 (CSS-variable-based via `@theme inline` in `globals.css` — no `tailwind.config.ts`), React, TypeScript.

**Color token reference (Tailwind class → CSS variable → hex):**
- `bg-brand-purple` / `text-brand-purple` → `--color-brand-purple` → `#4A027D`
- `bg-deep-violet` / `text-deep-violet` → `--color-deep-violet` → `#2D034F`
- `text-brand-pink` → `--color-brand-pink` → `#FB0467`
- `text-brand-mint` / `bg-brand-mint` → `--color-brand-mint` → `#2BDA9F`
- `text-brand-cyan` → `--color-brand-cyan` → `#0DAAC9`
- `text-brand-yellow` → `--color-brand-yellow` → `#FFEF70`

**Do not touch:** `app/login/`, `components/LoginForm.tsx` — excluded by spec.

---

### Task 1: Create `PageHeader` component

**Files:**
- Create: `components/ui/PageHeader.tsx`
- Modify: `components/ui/index.ts`

- [ ] **Step 1: Create `components/ui/PageHeader.tsx`**

```tsx
import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="flex items-stretch gap-3 mb-6">
      <div className="w-1 rounded bg-deep-violet shrink-0" />
      <div>
        <h1 className="text-2xl font-bold text-foreground leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to barrel export in `components/ui/index.ts`**

Add this line alongside the existing exports:
```ts
export { default as PageHeader } from './PageHeader';
```

- [ ] **Step 3: Verify it compiles**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors related to PageHeader.

- [ ] **Step 4: Commit**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && git add components/ui/PageHeader.tsx components/ui/index.ts && git commit -m "feat: add PageHeader component to ui library"
```

---

### Task 2: Convert `NavTabs` inline styles to Tailwind

**Files:**
- Modify: `components/NavTabs.tsx`

- [ ] **Step 1: Rewrite `NavTabs.tsx`**

Replace the entire file with:

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/client-health', label: 'Client Health' },
  { href: '/chart-history', label: 'Chart History' },
  { href: '/guest-finder', label: 'Guest Finder' },
  { href: '/team', label: 'Team' },
];

export default function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="bg-brand-purple">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-1 h-14">
          <span className="text-sm font-semibold tracking-tight mr-6 text-white/85">
            Podchaser Intelligence
          </span>
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-150 ${
                  active
                    ? 'text-brand-yellow bg-white/10'
                    : 'text-white/60 bg-transparent hover:text-white/85'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && git add components/NavTabs.tsx && git commit -m "style: convert NavTabs inline styles to Tailwind tokens"
```

---

### Task 3: Fix shared components — `LoadingSpinner` and `PodcastProfilePanel`

**Files:**
- Modify: `components/shared/LoadingSpinner.tsx`
- Modify: `components/shared/PodcastProfilePanel.tsx`

- [ ] **Step 1: Fix `LoadingSpinner` — replace blue with brand-purple**

Replace the entire file:

```tsx
export default function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      {message && <p className="text-sm text-gray-500">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `PodcastProfilePanel.tsx`**

Replace inline styles with Tailwind. Full replacement:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { EpisodeSummary } from '@/lib/types';
import InsightCard from '@/components/ui/InsightCard';

interface Props {
  podcastId: string;
  podcastName: string;
  podcastUrl: string | null;
  onClose: () => void;
}

export default function PodcastProfilePanel({ podcastId, podcastName, podcastUrl, onClose }: Props) {
  const [description, setDescription] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingProfile(true);
      setDescription(null);
      setEpisodes([]);
      setSummary(null);
      setError(null);

      try {
        const profileRes = await fetch('/api/podchaser/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ podcastId }),
        });

        if (!profileRes.ok) throw new Error('Failed to fetch profile');
        const profile = await profileRes.json();
        if (cancelled) return;

        setDescription(profile.description);
        setEpisodes(profile.episodes);
        setLoadingProfile(false);

        setLoadingSummary(true);
        const summaryRes = await fetch('/api/minimax/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            podcastName,
            podcastDescription: profile.description,
            episodes: profile.episodes,
          }),
        });

        if (!summaryRes.ok) throw new Error('Failed to fetch summary');
        const { summary: aiSummary } = await summaryRes.json();
        if (!cancelled) setSummary(aiSummary);
      } catch {
        if (!cancelled) setError('Failed to load podcast profile.');
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
          setLoadingSummary(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [podcastId, podcastName]);

  return (
    <InsightCard className="flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground text-sm leading-tight">{podcastName}</h2>
          {podcastUrl && (
            <a
              href={podcastUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-cyan hover:underline"
            >
              View on Podchaser
            </a>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0">×</button>
      </div>

      {loadingProfile ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          Loading profile…
        </div>
      ) : error ? (
        <p className="text-sm text-brand-pink">{error}</p>
      ) : (
        <>
          {description && (
            <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
          )}

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Guest Pattern
            </h3>
            {loadingSummary ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-3 h-3 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
                Analyzing…
              </div>
            ) : summary ? (
              <p className="text-xs text-gray-700 leading-relaxed">{summary}</p>
            ) : null}
          </div>

          {episodes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Recent Episodes
              </h3>
              <ul className="space-y-2">
                {episodes.map((ep, i) => (
                  <li key={i} className="text-xs">
                    <p className="font-medium text-gray-800 leading-snug">{ep.title}</p>
                    {ep.airDate && <p className="text-gray-400">{ep.airDate}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </InsightCard>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && git add components/shared/LoadingSpinner.tsx components/shared/PodcastProfilePanel.tsx && git commit -m "style: fix blue colors in LoadingSpinner and PodcastProfilePanel"
```

---

### Task 4: Client Health — search controls

**Files:**
- Modify: `components/client-health/ClientSearchBar.tsx`
- Modify: `components/client-health/PollButtons.tsx`
- Modify: `components/client-health/OwnerFilter.tsx`

- [ ] **Step 1: Rewrite `ClientSearchBar.tsx`**

```tsx
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
          className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-white text-foreground border border-gray-200 focus:outline-none focus:border-brand-purple transition-colors disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || loading || !query.trim()}
          className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-brand-pink text-white transition-opacity disabled:opacity-40"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <p className="text-sm mt-2 text-gray-500">{error}</p>}
    </div>
  );
}
```

Note: Search button stays `bg-brand-pink` (`#FB0467`) — this is the existing pink, kept intentionally as a distinct search action.

- [ ] **Step 2: Rewrite `PollButtons.tsx`**

```tsx
'use client';

type PollType = 'renew_30' | 'renew_60' | 'contacted_45';
type Mode = 'idle' | 'search' | 'poll_renew_30' | 'poll_renew_60' | 'poll_contacted_45';

interface Props {
  activeMode: Mode;
  disabled: boolean;
  onPoll: (type: PollType) => void;
}

const BUTTONS: { type: PollType; label: string }[] = [
  { type: 'renew_30',      label: 'Renewing in 30 days' },
  { type: 'renew_60',      label: 'Renewing in 60 days' },
  { type: 'contacted_45',  label: 'Last Contacted 45+ days' },
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
            className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all disabled:opacity-40 ${
              isActive
                ? 'bg-brand-purple text-white border-brand-purple'
                : 'bg-violet-50 text-brand-purple border-gray-200'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `OwnerFilter.tsx`**

```tsx
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
      <button
        onClick={() => onSelect(null)}
        className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all ${
          activeOwner === null
            ? 'bg-brand-purple text-white border-brand-purple'
            : 'bg-violet-50 text-brand-purple border-gray-200'
        }`}
      >
        All
      </button>
      {OWNERS.map(({ id, label }) => {
        const isActive = activeOwner === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(isActive ? null : id)}
            className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all ${
              isActive
                ? 'bg-brand-purple text-white border-brand-purple'
                : 'bg-violet-50 text-brand-purple border-gray-200'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && git add components/client-health/ClientSearchBar.tsx components/client-health/PollButtons.tsx components/client-health/OwnerFilter.tsx && git commit -m "style: convert client health search controls to Tailwind tokens"
```

---

### Task 5: Client Health — deal results

**Files:**
- Modify: `components/client-health/DealResultCard.tsx`
- Modify: `components/client-health/ResultsDashboard.tsx`

- [ ] **Step 1: Rewrite `DealResultCard.tsx`**

```tsx
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
      className="w-full text-left rounded-2xl p-4 bg-white border border-violet-100 transition-colors hover:border-brand-purple"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="shrink-0 rounded-lg px-2 py-1 text-center bg-violet-50 min-w-[52px]">
            <div className="text-sm font-bold text-brand-purple">{deal.totalScore}</div>
            <div className="text-[10px] text-gray-400">score</div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-foreground">{deal.name}</p>
            <p className="text-xs mt-0.5 text-gray-400">{deal.stage}</p>
          </div>
        </div>
        <div className="shrink-0 text-right space-y-0.5">
          <p className="text-sm font-semibold text-brand-purple">{formatAmount(deal.amount)}</p>
          {deal.contractEndDate && (
            <p className="text-xs text-gray-400">Renews {formatDate(deal.contractEndDate)}</p>
          )}
          {deal.lastContactedDate && (
            <p className="text-xs text-gray-400">Contacted {daysSince(deal.lastContactedDate)}</p>
          )}
          {deal.ownerId && (
            <p className="text-xs text-gray-400">{ownerName(deal.ownerId)}</p>
          )}
          {deal.businessType && (
            <p className="text-xs text-gray-400">{deal.businessType}</p>
          )}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Rewrite `ResultsDashboard.tsx`**

```tsx
import type { DealResult } from '@/lib/deal-scoring';

interface Props {
  deals: DealResult[];
}

const BAR_COLORS = ['bg-brand-purple', 'bg-brand-cyan', 'bg-brand-mint', 'bg-brand-pink'];

function DistributionTile({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] ?? 1;
  return (
    <div className="rounded-2xl p-4 bg-white border border-violet-100">
      <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-brand-purple">{title}</p>
      <div className="space-y-2">
        {entries.map(([label, count], i) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-700">{label}</span>
              <span className="text-gray-400">{count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-violet-50">
              <div
                className={`h-1.5 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                style={{ width: `${(count / max) * 100}%` }}
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
      <div className="rounded-2xl p-4 bg-white border border-violet-100">
        <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-brand-purple">Total Contract Value</p>
        <p className="text-2xl font-bold text-foreground">
          ${Math.round(totalValue).toLocaleString('en-US')}
        </p>
        <p className="text-xs mt-0.5 text-gray-400">
          {deals.length} deal{deals.length !== 1 ? 's' : ''}
        </p>
      </div>
      <DistributionTile title="By Business Type" counts={byType} />
      <DistributionTile title="By Deal Stage" counts={byStage} />
    </div>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && git add components/client-health/DealResultCard.tsx components/client-health/ResultsDashboard.tsx && git commit -m "style: convert deal results components to design tokens"
```

---

### Task 6: Client Health — user activity and feature entitlements

**Files:**
- Modify: `components/client-health/HealthTierBadge.tsx`
- Modify: `components/client-health/FeatureEntitlements.tsx`
- Modify: `components/client-health/UserActivityTable.tsx`

- [ ] **Step 1: Rewrite `HealthTierBadge.tsx` — replace with `PillBadge`**

```tsx
import PillBadge from '@/components/ui/PillBadge';

type Tier = 'Active' | 'Drifting' | 'At Risk';

const VARIANTS: Record<Tier, 'green' | 'yellow' | 'magenta'> = {
  Active:    'green',
  Drifting:  'yellow',
  'At Risk': 'magenta',
};

export default function HealthTierBadge({ tier }: { tier: Tier }) {
  return <PillBadge label={tier} variant={VARIANTS[tier]} />;
}
```

- [ ] **Step 2: Rewrite `FeatureEntitlements.tsx`**

```tsx
import InsightCard from '@/components/ui/InsightCard';

const LABELS: Record<string, string> = {
  brand_safety: 'Brand Safety',
  sponsor_history: 'Sponsor History',
  transcript_search: 'Transcript Search',
  tell_me_why: 'Tell Me Why',
  political_skew: 'Political Skew',
  list_making: 'List Making',
  seats: 'Seats',
  alerts: 'Alerts',
};

export default function FeatureEntitlements({ entitlements }: { entitlements: Record<string, unknown> }) {
  return (
    <InsightCard>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-3 text-brand-purple">Feature Entitlements</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {Object.entries(LABELS).map(([key, label]) => {
          const val = entitlements[key];
          const enabled = val === true || val === 'true' || (typeof val === 'number' && val > 0);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${enabled ? 'bg-brand-mint' : 'bg-gray-200'}`} />
              <span className={`text-xs ${enabled ? 'text-foreground' : 'text-gray-400'}`}>
                {label}{typeof val === 'number' ? ` (${val})` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}
```

- [ ] **Step 3: Rewrite `UserActivityTable.tsx`**

```tsx
import InsightCard from '@/components/ui/InsightCard';

const EVENT_LABELS: Record<string, string> = {
  loginSuccess: 'Logins',
  episodePlayButtonClicked: 'Episodes Played',
  'tellmewhy-launch': 'Tell Me Why',
  addItemToListClicked: 'List Adds',
  exportButtonClicked: 'Exports Started',
  contactsExportModalFileDownload: 'Exports Downloaded',
  contactCopied: 'Contacts Copied',
  TopSearchSubmit: 'Searches',
  filtersApplied: 'Filters Applied',
  CreateANewAlertsButtonClicked: 'Alerts Created',
};

interface Contact { name: string; email: string; lastLoginDate: string | null }
interface MixpanelUser { email: string; events: Record<string, number>; topSearches: string[]; healthSignals: string[] }

export default function UserActivityTable({
  contacts, mixpanel,
}: { contacts: Contact[]; mixpanel?: MixpanelUser[] | null }) {
  const byEmail = mixpanel
    ? Object.fromEntries(mixpanel.map(m => [m.email, m]))
    : {};

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-3 text-brand-purple">
        User Activity <span className="text-gray-400 normal-case tracking-normal">(60 days)</span>
      </h3>
      <div className="space-y-3">
        {contacts.map(c => {
          const mp = byEmail[c.email];
          return (
            <InsightCard key={c.email} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">{c.name}</span>
                <span className="text-xs text-gray-400">Last login: {c.lastLoginDate ?? 'never'}</span>
              </div>
              {mp ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                    {Object.entries(EVENT_LABELS).map(([key, label]) => (
                      <div key={key} className="text-center rounded-xl py-2 px-1 bg-background">
                        <div className="text-base font-semibold text-brand-purple">{mp.events[key] ?? 0}</div>
                        <div className="text-xs mt-0.5 text-gray-400">{label}</div>
                      </div>
                    ))}
                  </div>
                  {mp.topSearches.length > 0 && (
                    <p className="text-xs text-gray-500">Top searches: {mp.topSearches.join(', ')}</p>
                  )}
                  {mp.healthSignals.map(s => (
                    <p key={s} className="text-xs mt-1 font-medium text-amber-600">⚠ {s}</p>
                  ))}
                </>
              ) : (
                <p className="text-xs text-gray-400">Mixpanel data unavailable</p>
              )}
            </InsightCard>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && git add components/client-health/HealthTierBadge.tsx components/client-health/FeatureEntitlements.tsx components/client-health/UserActivityTable.tsx && git commit -m "style: adopt InsightCard and PillBadge in user activity components"
```

---

### Task 7: Client Health — report sections

**Files:**
- Modify: `components/client-health/AISummary.tsx`
- Modify: `components/client-health/ChorusInsights.tsx`
- Modify: `components/client-health/RecentNews.tsx`
- Modify: `components/client-health/HealthReportView.tsx`

- [ ] **Step 1: Rewrite `AISummary.tsx` — adopt `CalloutBlock`**

```tsx
import CalloutBlock from '@/components/ui/CalloutBlock';

export default function AISummary({ summary }: { summary: string }) {
  return (
    <CalloutBlock title="Key Takeaways">
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
    </CalloutBlock>
  );
}
```

- [ ] **Step 2: Rewrite `ChorusInsights.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import type { ChorusInsightsData } from '@/lib/chorus';
import InsightCard from '@/components/ui/InsightCard';

interface Props {
  companyName: string;
}

export default function ChorusInsights({ companyName }: Props) {
  const [insights, setInsights] = useState<ChorusInsightsData | null | undefined>(undefined);

  useEffect(() => {
    if (!companyName) return;
    const encoded = encodeURIComponent(companyName);
    fetch(`/api/chorus?company=${encoded}`)
      .then(r => {
        if (!r.ok) { setInsights(null); return; }
        return r.json();
      })
      .then(data => {
        if (data !== undefined) setInsights(data.insights ?? null);
      })
      .catch(() => setInsights(null));
  }, [companyName]);

  if (insights === undefined) {
    return (
      <InsightCard>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-brand-purple">Call Insights</h3>
        <p className="text-xs text-gray-400">Loading call insights…</p>
      </InsightCard>
    );
  }

  if (insights === null) {
    return (
      <InsightCard>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-brand-purple">Call Insights</h3>
        <p className="text-xs text-gray-400">No Chorus calls found for this account.</p>
      </InsightCard>
    );
  }

  const dateLabel = insights.latestCallDate
    ? new Date(insights.latestCallDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'unknown date';

  const sections: { label: string; items: string[]; colorClass: string; dotClass: string }[] = [
    { label: 'Usage signals',  items: insights.usage,        colorClass: 'text-brand-cyan',  dotClass: 'text-brand-cyan'  },
    { label: 'Frustrations',   items: insights.frustrations, colorClass: 'text-brand-pink',  dotClass: 'text-brand-pink'  },
    { label: 'Goals',          items: insights.goals,        colorClass: 'text-brand-mint',  dotClass: 'text-brand-mint'  },
  ];

  return (
    <InsightCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Call Insights</h3>
        <span className="text-xs text-gray-400">{insights.callCount} call{insights.callCount !== 1 ? 's' : ''} · latest {dateLabel}</span>
      </div>
      <div className="space-y-4">
        {sections.filter(s => s.items.length > 0).map(s => (
          <div key={s.label}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${s.colorClass}`}>{s.label}</p>
            <ul className="space-y-1">
              {s.items.map((item, i) => (
                <li key={i} className="text-xs flex gap-2 text-gray-700">
                  <span className={`shrink-0 mt-0.5 ${s.dotClass}`}>·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </InsightCard>
  );
}
```

- [ ] **Step 3: Rewrite `RecentNews.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import type { NewsArticle } from '@/lib/serper';
import InsightCard from '@/components/ui/InsightCard';

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
      <InsightCard>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-brand-purple">Recent News</h3>
        <p className="text-xs text-gray-400">Loading recent news…</p>
      </InsightCard>
    );
  }

  if (articles === null) {
    return (
      <InsightCard>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-brand-purple">Recent News</h3>
        <p className="text-xs text-gray-400">No recent news found for this company.</p>
      </InsightCard>
    );
  }

  return (
    <InsightCard>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-4 text-brand-purple">Recent News</h3>
      <ul className="space-y-4">
        {articles.map((article, i) => (
          <li key={i}>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-brand-cyan hover:underline"
            >
              {article.title}
            </a>
            <p className="text-xs mt-0.5 text-gray-400">
              {article.source}{article.date ? ` · ${article.date}` : ''}
            </p>
            {article.relevance && (
              <p className="text-xs italic mt-1 text-gray-500">{article.relevance}</p>
            )}
          </li>
        ))}
      </ul>
    </InsightCard>
  );
}
```

- [ ] **Step 4: Rewrite `HealthReportView.tsx`**

Replace every `style={}` prop with Tailwind. Full replacement:

```tsx
'use client';
import { useState } from 'react';
import HealthTierBadge from './HealthTierBadge';
import FeatureEntitlements from './FeatureEntitlements';
import UserActivityTable from './UserActivityTable';
import ChorusInsights from './ChorusInsights';
import RecentNews from './RecentNews';
import AISummary from './AISummary';
import InsightCard from '@/components/ui/InsightCard';
import type { MixpanelUserActivity } from '@/lib/mixpanel';

interface UsageInfo { used: number; limit: number; resetsAt: string }
interface Props { report: Record<string, unknown>; onReset: () => void }

export default function HealthReportView({ report, onReset }: Props) {
  const [mixpanel, setMixpanel]               = useState<MixpanelUserActivity[] | null>(null);
  const [mixpanelLoading, setMixpanelLoading] = useState(false);
  const [mixpanelUsage, setMixpanelUsage]     = useState<UsageInfo | null>(null);
  const [mixpanelError, setMixpanelError]     = useState('');
  const [healthTier, setHealthTier]           = useState<'Active' | 'Drifting' | 'At Risk' | null>(null);

  const [chorusTriggered, setChorusTriggered] = useState(false);
  const [newsTriggered, setNewsTriggered]     = useState(false);

  const [aiSummary, setAiSummary]           = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError]     = useState('');

  const [saving, setSaving]       = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

  const deal     = report.deal as Record<string, unknown>;
  const company  = report.company as Record<string, string>;
  const contacts = report.contacts as { name: string; email: string; lastLoginDate: string | null }[];

  async function loadMixpanel() {
    setMixpanelLoading(true);
    setMixpanelError('');
    try {
      const res = await fetch('/api/mixpanel/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      });
      const data = await res.json();
      if (res.status === 429) {
        const resetTime = new Date(data.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMixpanelError(`Mixpanel limit reached for this hour (resets at ${resetTime})`);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Mixpanel fetch failed');
      setMixpanel(data.activity);
      setHealthTier(data.healthTier);
      setMixpanelUsage(data.usage);
    } catch (e) {
      setMixpanelError((e as Error).message);
    } finally {
      setMixpanelLoading(false);
    }
  }

  async function generateSummary() {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const res = await fetch('/api/minimax/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: deal.id,
          sources: { mixpanel: mixpanel !== null, chorus: chorusTriggered, news: newsTriggered },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Summary generation failed');
      setAiSummary(data.summary);
    } catch (e) {
      setSummaryError((e as Error).message);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function saveNote() {
    setSaveError('');
    setSaving(true);
    try {
      const res = await fetch('/api/hubspot/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: deal.id,
          dealOwnerId: deal.owner,
          companyName: company.name,
          aiSummary,
          healthTier: healthTier ?? 'Unknown',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error || 'Failed to save note to HubSpot');
        return;
      }
      const data = await res.json();
      setSavedNote(data.noteId);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const limitReached = mixpanelUsage && mixpanelUsage.used >= mixpanelUsage.limit;

  return (
    <div className="space-y-5">

      {/* Company header */}
      <InsightCard>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-foreground">{company.name}</h2>
              {healthTier && <HealthTierBadge tier={healthTier} />}
            </div>
            <p className="text-xs text-gray-400">
              Owner: {deal.ownerName as string} · Contract: {deal.contractStart as string ?? '?'} → {deal.contractEnd as string ?? '?'}
            </p>
            {!!report.dealOwnerWarning && (
              <p className="text-xs mt-1 font-medium text-amber-600">{report.dealOwnerWarning as string}</p>
            )}
          </div>
          <button onClick={onReset} className="text-xs font-medium text-gray-400 hover:opacity-60 transition-opacity">← New search</button>
        </div>
      </InsightCard>

      <FeatureEntitlements entitlements={deal.entitlements as Record<string, unknown>} />
      <UserActivityTable contacts={contacts} mixpanel={mixpanel} />

      {/* Mixpanel */}
      <InsightCard className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Mixpanel Activity</p>
            {mixpanelUsage && (
              <p className="text-xs mt-0.5 text-gray-400">
                {mixpanelUsage.used} of {mixpanelUsage.limit} calls used this hour
              </p>
            )}
          </div>
          {!mixpanel && (
            <button
              onClick={loadMixpanel}
              disabled={mixpanelLoading || !!limitReached}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-purple text-white transition-opacity disabled:opacity-50"
            >
              {mixpanelLoading ? 'Loading…' : 'Load Mixpanel'}
            </button>
          )}
          {mixpanel && <span className="text-xs font-medium text-brand-mint">✓ Loaded</span>}
        </div>
        {mixpanelError && <p className="text-xs mt-2 text-amber-600">{mixpanelError}</p>}
      </InsightCard>

      {/* Chorus */}
      <InsightCard className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Chorus Insights</p>
          {!chorusTriggered && (
            <button
              onClick={() => setChorusTriggered(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-purple text-white"
            >
              Load Chorus
            </button>
          )}
          {chorusTriggered && <span className="text-xs font-medium text-brand-mint">✓ Loaded</span>}
        </div>
        {chorusTriggered && <ChorusInsights companyName={company.name} />}
      </InsightCard>

      {/* News */}
      <InsightCard className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Recent News</p>
          {!newsTriggered && (
            <button
              onClick={() => setNewsTriggered(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-purple text-white"
            >
              Load News
            </button>
          )}
          {newsTriggered && <span className="text-xs font-medium text-brand-mint">✓ Loaded</span>}
        </div>
        {newsTriggered && <RecentNews companyName={company.name} />}
      </InsightCard>

      {/* AI Summary */}
      <InsightCard className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-brand-purple">AI Summary</p>
        <p className="text-xs mb-3 text-gray-400">
          Will include: HubSpot data
          {mixpanel !== null && ' + Mixpanel ✓'}
          {chorusTriggered && ' + Chorus ✓'}
          {newsTriggered && ' + News ✓'}
        </p>
        {!aiSummary && (
          <button
            onClick={generateSummary}
            disabled={summaryLoading}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-purple text-white disabled:opacity-50"
          >
            {summaryLoading ? 'Generating…' : 'Generate AI Summary'}
          </button>
        )}
        {summaryError && (
          <>
            <p className="text-xs mt-2 text-brand-pink">{summaryError}</p>
            <button onClick={generateSummary} className="text-xs font-medium mt-1 text-brand-purple">Retry</button>
          </>
        )}
        {aiSummary && (
          <>
            <AISummary summary={aiSummary} />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={saveNote}
                disabled={saving || !!savedNote}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                  savedNote
                    ? 'border-violet-100 text-brand-mint bg-green-50'
                    : 'border-violet-100 text-brand-purple bg-white'
                }`}
              >
                {saving ? 'Saving…' : savedNote ? '✓ Saved to HubSpot' : 'Save to HubSpot'}
              </button>
              {saveError && <p className="text-xs text-brand-pink">{saveError}</p>}
            </div>
          </>
        )}
      </InsightCard>

    </div>
  );
}
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && git add components/client-health/AISummary.tsx components/client-health/ChorusInsights.tsx components/client-health/RecentNews.tsx components/client-health/HealthReportView.tsx && git commit -m "style: adopt InsightCard and CalloutBlock in health report sections"
```

---

### Task 8: Add `PageHeader` to all pages

**Files:**
- Modify: `app/client-health/page.tsx`
- Modify: `app/chart-history/page.tsx`
- Modify: `app/guest-finder/page.tsx`
- Modify: `components/team/TeamPage.tsx`

- [ ] **Step 1: Add `PageHeader` to `app/client-health/page.tsx`**

Add import at top:
```tsx
import { PageHeader } from '@/components/ui';
```

Replace:
```tsx
<h1 className="text-xl font-semibold mb-6" style={{ color: '#1a1a2e' }}>Client Health</h1>
```
With:
```tsx
<PageHeader title="Client Health" subtitle="Search accounts or run a pipeline poll" />
```

- [ ] **Step 2: Add `PageHeader` to `app/chart-history/page.tsx`**

Add import at top:
```tsx
import { PageHeader } from '@/components/ui';
```

Replace:
```tsx
<h1 className="text-xl font-semibold text-gray-900 mb-4">Chart History</h1>
```
With:
```tsx
<PageHeader title="Chart History" subtitle="Leaderboard rankings across podcast categories" />
```

- [ ] **Step 3: Add `PageHeader` to `app/guest-finder/page.tsx`**

Add import at top:
```tsx
import { PageHeader } from '@/components/ui';
```

Replace:
```tsx
<h1 className="text-xl font-semibold text-gray-900 mb-4">Guest Finder</h1>
```
With:
```tsx
<PageHeader title="Guest Finder" subtitle="Find podcast placement opportunities for your clients" />
```

- [ ] **Step 4: Add `PageHeader` to `components/team/TeamPage.tsx`**

Add import at top:
```tsx
import { PageHeader } from '@/components/ui';
```

Replace:
```tsx
<h1 className="text-xl font-semibold text-gray-900">Team</h1>
```
With:
```tsx
<PageHeader title="Team" subtitle="Manage members and access" />
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && git add app/client-health/page.tsx app/chart-history/page.tsx app/guest-finder/page.tsx components/team/TeamPage.tsx && git commit -m "style: add PageHeader to all pages"
```

---

### Task 9: Chart History — fix blue colors and adopt InsightCard

**Files:**
- Modify: `app/chart-history/page.tsx`
- Modify: `components/chart-history/LeaderboardTable.tsx`

- [ ] **Step 1: Fix blue Run button in `app/chart-history/page.tsx`**

Replace:
```tsx
className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
```
With:
```tsx
className="px-4 py-1.5 text-sm rounded-lg bg-brand-purple text-white hover:opacity-90 disabled:opacity-50"
```

- [ ] **Step 2: Rewrite `LeaderboardTable.tsx` — adopt InsightCard, fix blue hover states**

```tsx
'use client';
import { LeaderboardEntry } from '@/lib/types';
import InsightCard from '@/components/ui/InsightCard';

interface Props {
  entries: LeaderboardEntry[];
  onSelect: (entry: LeaderboardEntry) => void;
  selectedId: string | null;
}

export default function LeaderboardTable({ entries, onSelect, selectedId }: Props) {
  return (
    <InsightCard className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-3 py-2 w-10 font-medium text-gray-600">#</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Podcast</th>
            <th className="text-right px-3 py-2 w-20 font-medium text-gray-600">Score</th>
            <th className="text-right px-3 py-2 w-16 font-medium text-gray-600">Days</th>
            <th className="text-right px-3 py-2 w-24 font-medium text-gray-600">Best Rank</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className={`border-b border-gray-100 hover:bg-violet-50 cursor-pointer ${
                selectedId === entry.id ? 'bg-violet-50' : ''
              }`}
              onClick={() => onSelect(entry)}
            >
              <td className="px-3 py-2 tabular-nums text-gray-500">{entry.leaderboardPosition}</td>
              <td className="px-3 py-2 text-brand-purple font-medium">{entry.title}</td>
              <td className="px-3 py-2 tabular-nums text-right">{entry.totalScore}</td>
              <td className="px-3 py-2 tabular-nums text-right">{entry.daysAppeared}</td>
              <td className="px-3 py-2 tabular-nums text-right">#{entry.bestRank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </InsightCard>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && git add app/chart-history/page.tsx components/chart-history/LeaderboardTable.tsx && git commit -m "style: fix blue colors and adopt InsightCard in chart history"
```

---

### Task 10: Guest Finder — fix blue colors and adopt InsightCard

**Files:**
- Modify: `components/guest-finder/ClientDescriptionForm.tsx`
- Modify: `components/guest-finder/GuestFinderResults.tsx`

- [ ] **Step 1: Rewrite `ClientDescriptionForm.tsx`**

```tsx
'use client';
import InsightCard from '@/components/ui/InsightCard';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function ClientDescriptionForm({ value, onChange, onSubmit, isLoading }: Props) {
  return (
    <InsightCard className="flex flex-col gap-3">
      <label className="text-sm font-medium text-gray-700">
        Describe your client
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. A venture capital investor focused on early-stage B2B SaaS startups who advises founders on go-to-market strategy"
        rows={4}
        className="text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-purple"
        disabled={isLoading}
      />
      <button
        onClick={onSubmit}
        disabled={isLoading || !value.trim()}
        className="self-start px-4 py-1.5 text-sm bg-brand-purple text-white rounded-lg hover:opacity-90 disabled:opacity-50"
      >
        {isLoading ? 'Finding…' : 'Find Podcasts'}
      </button>
    </InsightCard>
  );
}
```

- [ ] **Step 2: Rewrite `GuestFinderResults.tsx`**

```tsx
'use client';
import { GuestFinderCard, PowerScoreTier } from '@/lib/types';
import InsightCard from '@/components/ui/InsightCard';

const TIER_LABELS: Record<PowerScoreTier, string> = {
  A: 'Tier A — High Power Score (70–100)',
  B: 'Tier B — Mid Power Score (41–69)',
  C: 'Tier C — Emerging (20–40)',
};

interface Props {
  cards: GuestFinderCard[];
  onSelectPodcast: (card: GuestFinderCard) => void;
  selectedId: string | null;
}

export default function GuestFinderResults({ cards, onSelectPodcast, selectedId }: Props) {
  const tiers: PowerScoreTier[] = ['A', 'B', 'C'];

  return (
    <div className="flex flex-col gap-6">
      {tiers.map((tier) => {
        const tierCards = cards.filter((c) => c.tier === tier);
        if (tierCards.length === 0) return null;
        return (
          <div key={tier}>
            <h2 className="text-xs font-semibold uppercase tracking-wide mb-3 text-brand-purple">
              {TIER_LABELS[tier]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tierCards.map((card, i) => (
                <button
                  key={i}
                  onClick={() => card.podcastId && onSelectPodcast(card)}
                  className={`text-left rounded-2xl border transition-colors ${
                    selectedId && selectedId === card.podcastId
                      ? 'border-brand-purple bg-violet-50'
                      : 'border-violet-100 bg-white hover:border-brand-purple hover:bg-violet-50'
                  }`}
                >
                  <InsightCard className="h-full">
                    <p className="font-medium text-foreground text-sm mb-1">{card.podcastName}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{card.brief}</p>
                    {card.podcastURL && (
                      <a
                        href={card.podcastURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-block mt-2 text-xs text-brand-cyan hover:underline"
                      >
                        View on Podchaser →
                      </a>
                    )}
                  </InsightCard>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && git add components/guest-finder/ClientDescriptionForm.tsx components/guest-finder/GuestFinderResults.tsx && git commit -m "style: fix blue colors and adopt InsightCard in guest finder"
```

---

### Task 11: Team — fix blue colors and adopt InsightCard

**Files:**
- Modify: `components/team/TeamMemberList.tsx`
- Modify: `components/team/AddMemberForm.tsx`
- Modify: `components/team/ChangePasswordForm.tsx`

- [ ] **Step 1: Rewrite `TeamMemberList.tsx`**

```tsx
'use client';
import InsightCard from '@/components/ui/InsightCard';

interface Member {
  id: string;
  name: string;
  email: string;
  hubspot_owner_id: string;
  created_at: string;
}

interface Props {
  members: Member[];
  currentUserId: string;
  onRemove: (id: string) => void;
}

export default function TeamMemberList({ members, currentUserId, onRemove }: Props) {
  return (
    <InsightCard className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">HubSpot Owner ID</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Joined</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-t border-gray-100">
              <td className="px-4 py-2 text-foreground">{m.name}</td>
              <td className="px-4 py-2 text-gray-600">{m.email}</td>
              <td className="px-4 py-2 text-gray-600">{m.hubspot_owner_id}</td>
              <td className="px-4 py-2 text-gray-400">{new Date(m.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={() => onRemove(m.id)}
                  disabled={m.id === currentUserId}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </InsightCard>
  );
}
```

- [ ] **Step 2: Rewrite `AddMemberForm.tsx`**

```tsx
'use client';
import { useState } from 'react';
import InsightCard from '@/components/ui/InsightCard';

interface Props {
  onAdded: () => void;
}

export default function AddMemberForm({ onAdded }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hubspotOwnerId, setHubspotOwnerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, hubspot_owner_id: hubspotOwnerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add member');
        return;
      }
      setName(''); setEmail(''); setPassword(''); setHubspotOwnerId('');
      onAdded();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <InsightCard>
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Add Member</h3>
        <p className="text-xs text-gray-400">Known owner IDs — Jon: 1774818015 / Jules: 184892201 / Sydney: 157100429</p>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-purple" />
          <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-purple" />
          <input placeholder="Temp password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-purple" />
          <input placeholder="HubSpot Owner ID" value={hubspotOwnerId} onChange={e => setHubspotOwnerId(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-purple" />
        </div>
        {error && <p className="text-xs text-brand-pink">{error}</p>}
        <button type="submit" disabled={loading} className="px-4 py-1.5 text-sm bg-brand-purple text-white rounded-lg hover:opacity-90 disabled:opacity-50">
          {loading ? 'Adding…' : 'Add Member'}
        </button>
      </form>
    </InsightCard>
  );
}
```

- [ ] **Step 3: Rewrite `ChangePasswordForm.tsx`**

```tsx
'use client';
import { useState } from 'react';
import InsightCard from '@/components/ui/InsightCard';

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to change password');
        return;
      }
      setMessage('Password updated.');
      setCurrent(''); setNext('');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <InsightCard className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Change Password</h3>
        <input placeholder="Current password" type="password" value={current} onChange={e => setCurrent(e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-purple" />
        <input placeholder="New password" type="password" value={next} onChange={e => setNext(e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-purple" />
        {error && <p className="text-xs text-brand-pink">{error}</p>}
        {message && <p className="text-xs text-brand-mint">{message}</p>}
        <button type="submit" disabled={loading} className="px-4 py-1.5 text-sm bg-brand-purple text-white rounded-lg hover:opacity-90 disabled:opacity-50">
          {loading ? 'Saving…' : 'Change Password'}
        </button>
      </form>
    </InsightCard>
  );
}
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit and push**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && git add components/team/TeamMemberList.tsx components/team/AddMemberForm.tsx components/team/ChangePasswordForm.tsx && git commit -m "style: fix blue colors and adopt InsightCard in team components" && git push
```

---

### Final verification

- [ ] Run `npx tsc --noEmit` — expect zero errors
- [ ] Start dev server: `npm run dev` — visit all 4 pages and confirm:
  - Purple nav bar unchanged
  - Deep-violet accent bar on every page header
  - All cards have consistent white + violet-100 border style
  - No blue buttons or spinners anywhere
  - AI Summary uses dark CalloutBlock with magenta left border
  - Tier badges use PillBadge colors
- [ ] Push all commits: `git push`
