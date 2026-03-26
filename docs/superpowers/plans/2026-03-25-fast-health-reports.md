# Fast Health Reports with On-Demand Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make client health reports load instantly by stripping `/api/hubspot/client` to HubSpot-only and moving Mixpanel, Chorus, News, and AI summary into on-demand enrichment flows triggered by the rep.

**Architecture:** Data layer changes first (serper, mixpanel, minimax libs), then API routes (strip existing, add two new), then UI (UserActivityTable optional prop, HealthReportView full rewrite). Each task is independently verifiable with `npx tsc --noEmit`.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS. No test runner — verify with `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-03-25-fast-health-reports-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `lib/serper.ts` | Add `tbs: 'qdr:m3'` to `fetchCompanyNews` |
| Modify | `lib/mixpanel.ts` | Export `MixpanelUserActivity` type; accept optional HubSpot contacts; suppress false "no logins" signal |
| Modify | `lib/minimax.ts` | Make `healthTier` and `mixpanel` optional in `generateClientSummary`; build prompt conditionally |
| Modify | `app/api/hubspot/client/route.ts` | Strip to HubSpot-only; remove Mixpanel and MiniMax |
| Create | `app/api/mixpanel/activity/route.ts` | On-demand Mixpanel enrichment + hourly call counter |
| Create | `app/api/minimax/summary/route.ts` | On-demand AI summary with re-fetched sources |
| Modify | `components/client-health/UserActivityTable.tsx` | Make `mixpanel` prop optional; guard `byEmail` computation |
| Modify | `components/client-health/HealthReportView.tsx` | Trigger buttons, local enrichment state, conditional HealthTierBadge, AI summary section |

---

## Task 1: Add date filter to fetchCompanyNews

**Files:**
- Modify: `lib/serper.ts`

- [ ] **Step 1: Add `tbs` param**

In `lib/serper.ts`, change line 25 from:
```typescript
const data = await serperPost('/news', { q: `"${companyName}"`, num: limit });
```
To:
```typescript
const data = await serperPost('/news', { q: `"${companyName}"`, num: limit, tbs: 'qdr:m3' });
```

- [ ] **Step 2: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 2: Update lib/mixpanel.ts

**Files:**
- Modify: `lib/mixpanel.ts`

- [ ] **Step 1: Export MixpanelUserActivity interface**

Add this interface immediately before the `fetchMixpanelActivity` function (before line 236):

```typescript
export interface MixpanelUserActivity {
  email: string;
  events: Record<string, number>;
  topSearches: string[];
  healthSignals: string[];
}
```

- [ ] **Step 2: Update fetchMixpanelActivity signature**

Change the signature of `fetchMixpanelActivity` to accept optional HubSpot contacts and add a return type annotation:

```typescript
export async function fetchMixpanelActivity(
  emails: string[],
  hubspotContacts?: Array<{ email: string; lastLoginDate: string | null }>
): Promise<MixpanelUserActivity[]>
```

- [ ] **Step 3: Add HubSpot cross-reference for "No logins" signal**

Replace the existing health signals block (currently at the end of the `emails.map(...)` callback, before the `return { email, events: rawEvents, topSearches, healthSignals }` line):

Current code:
```typescript
    const healthSignals: string[] = [];
    if ((rawEvents['loginSuccess'] ?? 0) === 0) healthSignals.push('No logins in 60 days');
    if ((rawEvents['exportButtonClicked'] ?? 0) > 0 && (rawEvents['contactsExportModalFileDownload'] ?? 0) === 0) {
      healthSignals.push('Export friction: started but never downloaded');
    }
    if ((rawEvents['CreateANewAlertsButtonClicked'] ?? 0) === 0 && (rawEvents['loginSuccess'] ?? 0) > 5) {
      healthSignals.push('No alerts set up despite regular usage');
    }

    return { email, events: rawEvents, topSearches, healthSignals };
```

Replacement:
```typescript
    const healthSignals: string[] = [];

    const hsContact = hubspotContacts?.find(c => c.email === email);
    const hsLoginRecent = hsContact?.lastLoginDate
      ? (Date.now() - new Date(hsContact.lastLoginDate).getTime()) < 60 * 86_400_000
      : false;

    if ((rawEvents['loginSuccess'] ?? 0) === 0 && !hsLoginRecent) {
      healthSignals.push('No logins in 60 days');
    }
    if ((rawEvents['exportButtonClicked'] ?? 0) > 0 && (rawEvents['contactsExportModalFileDownload'] ?? 0) === 0) {
      healthSignals.push('Export friction: started but never downloaded');
    }
    if ((rawEvents['CreateANewAlertsButtonClicked'] ?? 0) === 0 && (rawEvents['loginSuccess'] ?? 0) > 5) {
      healthSignals.push('No alerts set up despite regular usage');
    }

    return { email, events: rawEvents, topSearches, healthSignals };
```

Also update the no-profile early-return to use the exported type shape:
```typescript
    if (!profile) {
      return { email, events: {}, topSearches: [], healthSignals: ['No Mixpanel profile found'] };
    }
```
(This line is unchanged — confirm it already matches this shape.)

- [ ] **Step 4: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 3: Rewrite generateClientSummary in lib/minimax.ts

**Files:**
- Modify: `lib/minimax.ts`

- [ ] **Step 1: Add MixpanelUserActivity import**

At the top of `lib/minimax.ts`, add the import after the existing imports (or as the first line if there are no local imports yet):

```typescript
import type { MixpanelUserActivity } from '@/lib/mixpanel';
```

- [ ] **Step 2: Replace generateClientSummary**

Replace the entire `generateClientSummary` function (lines 141–177) with:

```typescript
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
}): Promise<string> {
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

  const raw = await callMiniMax(prompt);
  return stripThinkingTags(raw);
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 4: Strip app/api/hubspot/client/route.ts to HubSpot-only

**Files:**
- Modify: `app/api/hubspot/client/route.ts`

- [ ] **Step 1: Rewrite the file**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  fetchDealById, fetchCompanyForDeal, fetchContactsForDeal,
  fetchNotesForDeal, fetchEmailsForDeal, ownerName,
} from '@/lib/hubspot';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { dealId } = await req.json();
  if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 });

  let deal, company, contacts, notes, emails;
  try {
    [deal, company] = await Promise.all([
      fetchDealById(dealId),
      fetchCompanyForDeal(dealId),
    ]);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    [contacts, notes, emails] = await Promise.all([
      fetchContactsForDeal(deal.id),
      fetchNotesForDeal(deal.id),
      fetchEmailsForDeal(deal.id),
    ]);
  } catch (e) {
    return NextResponse.json({ error: `HubSpot fetch failed: ${(e as Error).message}` }, { status: 502 });
  }

  const companyName = company?.name ?? deal.properties.dealname;
  const companyId = company?.id ?? null;
  const domain = company?.domain ?? null;

  return NextResponse.json({
    company: { id: companyId, name: companyName, domain },
    deal: {
      id: deal.id,
      name: deal.properties.dealname,
      stage: deal.properties.dealstage,
      pipeline: deal.properties.pipeline,
      owner: deal.properties.hubspot_owner_id,
      ownerName: ownerName(deal.properties.hubspot_owner_id),
      contractStart: deal.properties.contract_start_date ?? null,
      contractEnd: deal.properties.contract_end_date ?? null,
      entitlements: Object.fromEntries(
        ['brand_safety','sponsor_history','transcript_search','tell_me_why','political_skew','list_making','seats','alerts']
          .map(k => [k, deal.properties[k]])
      ),
    },
    contacts,
    notes,
    emails,
    dealOwnerWarning: deal.properties.hubspot_owner_id !== session.user.hubspot_owner_id
      ? `This deal is owned by ${ownerName(deal.properties.hubspot_owner_id)}.`
      : null,
  });
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 5: Create app/api/mixpanel/activity/route.ts

**Files:**
- Create: `app/api/mixpanel/activity/route.ts`

- [ ] **Step 1: Create the directory and file**

First confirm the `app/api/mixpanel/` directory does not already exist, then create:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchContactsForDeal } from '@/lib/hubspot';
import { fetchMixpanelActivity, computeHealthTier } from '@/lib/mixpanel';
import type { MixpanelUserActivity } from '@/lib/mixpanel';

export const maxDuration = 60;

// Module-level hourly counter — resets on server restart (acceptable for small team tool)
let callCount = 0;
let resetAt = Date.now() + 3_600_000;

function trackUsage(): { used: number; limit: number; resetsAt: string } {
  const now = Date.now();
  if (now > resetAt) { callCount = 0; resetAt = now + 3_600_000; }
  callCount++;
  return { used: callCount, limit: 40, resetsAt: new Date(resetAt).toISOString() };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check limit before doing any work
  const now = Date.now();
  if (now > resetAt) { callCount = 0; resetAt = now + 3_600_000; }
  if (callCount >= 40) {
    return NextResponse.json(
      { error: 'limit_reached', resetsAt: new Date(resetAt).toISOString() },
      { status: 429 }
    );
  }

  const { dealId } = await req.json();
  if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 });

  let contacts: Awaited<ReturnType<typeof fetchContactsForDeal>>;
  try {
    contacts = await fetchContactsForDeal(dealId);
  } catch (e) {
    return NextResponse.json({ error: `HubSpot fetch failed: ${(e as Error).message}` }, { status: 502 });
  }

  const emails = contacts.map(c => c.email).filter(Boolean);
  let activity: MixpanelUserActivity[];
  try {
    activity = await fetchMixpanelActivity(emails, contacts);
  } catch (e) {
    return NextResponse.json({ error: `Mixpanel fetch failed: ${(e as Error).message}` }, { status: 502 });
  }

  const usage = trackUsage();
  const healthTier = computeHealthTier(activity);

  return NextResponse.json({ activity, healthTier, usage });
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 6: Create app/api/minimax/summary/route.ts

**Files:**
- Create: `app/api/minimax/summary/route.ts`

- [ ] **Step 1: Create the directory and file**

First confirm the `app/api/minimax/` directory does not already exist, then create:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchDealById, fetchCompanyForDeal, fetchContactsForDeal } from '@/lib/hubspot';
import { fetchMixpanelActivity, computeHealthTier } from '@/lib/mixpanel';
import { fetchCompanyNews, annotateNewsRelevance } from '@/lib/serper';
import { generateClientSummary } from '@/lib/minimax';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { dealId, sources } = await req.json() as {
    dealId: string;
    sources: { mixpanel: boolean; chorus: boolean; news: boolean };
  };
  if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 });

  // Always fetch HubSpot base data
  let deal, company, contacts;
  try {
    [deal, company] = await Promise.all([
      fetchDealById(dealId),
      fetchCompanyForDeal(dealId),
    ]);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    contacts = await fetchContactsForDeal(deal.id);
  } catch (e) {
    return NextResponse.json({ error: `HubSpot fetch failed: ${(e as Error).message}` }, { status: 502 });
  }

  const companyName = company?.name ?? deal.properties.dealname;
  const emails = contacts.map(c => c.email).filter(Boolean);

  // Optional: Mixpanel (does NOT increment the usage counter — this is a summary generation call)
  let mixpanelData: { activity: Awaited<ReturnType<typeof fetchMixpanelActivity>>; healthTier: 'Active' | 'Drifting' | 'At Risk' } | null = null;
  if (sources.mixpanel) {
    try {
      const activity = await fetchMixpanelActivity(emails, contacts);
      mixpanelData = { activity, healthTier: computeHealthTier(activity) };
    } catch {
      // non-fatal — summary proceeds without Mixpanel data
    }
  }

  // Optional: News
  if (sources.news) {
    try {
      const rawArticles = await fetchCompanyNews(companyName, 5);
      await annotateNewsRelevance(rawArticles, companyName);
      // News data is used for context in a future enhancement; currently only fetched to confirm freshness
    } catch {
      // non-fatal
    }
  }

  let summary: string;
  try {
    summary = await generateClientSummary({
      companyName,
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
  } catch (e) {
    return NextResponse.json({ error: `Summary generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  return NextResponse.json({ summary });
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 7: Make mixpanel prop optional in UserActivityTable

**Files:**
- Modify: `components/client-health/UserActivityTable.tsx`

- [ ] **Step 1: Update prop interface and guard byEmail**

Replace the props interface and `byEmail` line:

Current code at top of component:
```typescript
export default function UserActivityTable({
  contacts, mixpanel,
}: { contacts: Contact[]; mixpanel: MixpanelUser[] }) {
  const byEmail = Object.fromEntries(mixpanel.map(m => [m.email, m]));
```

Replacement:
```typescript
export default function UserActivityTable({
  contacts, mixpanel,
}: { contacts: Contact[]; mixpanel?: MixpanelUser[] | null }) {
  const byEmail = mixpanel
    ? Object.fromEntries(mixpanel.map(m => [m.email, m]))
    : {};
```

No other changes — the existing `mp ? <activity> : <p>Mixpanel data unavailable</p>` per-user guard already handles the null case correctly.

- [ ] **Step 2: Verify types compile**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence"
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 8: Rewrite HealthReportView

**Files:**
- Modify: `components/client-health/HealthReportView.tsx`

- [ ] **Step 1: Rewrite the file**

Replace the entire file with:

```typescript
'use client';
import { useState } from 'react';
import HealthTierBadge from './HealthTierBadge';
import FeatureEntitlements from './FeatureEntitlements';
import UserActivityTable from './UserActivityTable';
import ChorusInsights from './ChorusInsights';
import RecentNews from './RecentNews';
import AISummary from './AISummary';
import type { MixpanelUserActivity } from '@/lib/mixpanel';

interface UsageInfo { used: number; limit: number; resetsAt: string }

interface Props { report: Record<string, unknown>; onReset: () => void }

export default function HealthReportView({ report, onReset }: Props) {
  // Mixpanel enrichment state
  const [mixpanel, setMixpanel]               = useState<MixpanelUserActivity[] | null>(null);
  const [mixpanelLoading, setMixpanelLoading] = useState(false);
  const [mixpanelUsage, setMixpanelUsage]     = useState<UsageInfo | null>(null);
  const [mixpanelError, setMixpanelError]     = useState('');
  const [healthTier, setHealthTier]           = useState<'Active' | 'Drifting' | 'At Risk' | null>(null);

  // Chorus / News trigger state
  const [chorusTriggered, setChorusTriggered] = useState(false);
  const [newsTriggered, setNewsTriggered]     = useState(false);

  // AI summary state
  const [aiSummary, setAiSummary]         = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError]   = useState('');

  // HubSpot save state
  const [saving, setSaving]       = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

  const deal    = report.deal as Record<string, unknown>;
  const company = report.company as Record<string, string>;
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
          sources: {
            mixpanel: mixpanel !== null,
            chorus: chorusTriggered,
            news: newsTriggered,
          },
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
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setSaveError(data.error || 'Failed to save note to HubSpot');
      return;
    }
    const data = await res.json();
    setSavedNote(data.noteId);
  }

  const limitReached = mixpanelUsage && mixpanelUsage.used >= mixpanelUsage.limit;

  return (
    <div className="space-y-5">

      {/* Company header */}
      <div className="rounded-2xl p-5 flex items-start justify-between" style={{ backgroundColor: '#ffffff', boxShadow: '0 2px 12px rgba(74,2,125,0.08)', border: '1px solid #ede9f5' }}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-semibold" style={{ color: '#1a1a2e' }}>{company.name}</h2>
            {healthTier && <HealthTierBadge tier={healthTier} />}
          </div>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            Owner: {deal.ownerName as string} · Contract: {deal.contractStart as string ?? '?'} → {deal.contractEnd as string ?? '?'}
          </p>
          {!!report.dealOwnerWarning && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#d97706' }}>{report.dealOwnerWarning as string}</p>
          )}
        </div>
        <button onClick={onReset} className="text-xs font-medium transition-opacity hover:opacity-60" style={{ color: '#9ca3af' }}>← New search</button>
      </div>

      <FeatureEntitlements entitlements={deal.entitlements as Record<string, unknown>} />

      {/* User Activity — contacts-only until Mixpanel loads */}
      <UserActivityTable contacts={contacts} mixpanel={mixpanel} />

      {/* Mixpanel enrichment section */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 8px rgba(74,2,125,0.05)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A027D' }}>Mixpanel Activity</p>
            {mixpanelUsage && (
              <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                {mixpanelUsage.used} of {mixpanelUsage.limit} calls used this hour
              </p>
            )}
          </div>
          {!mixpanel && (
            <button
              onClick={loadMixpanel}
              disabled={mixpanelLoading || !!limitReached}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#4A027D', color: '#ffffff' }}
            >
              {mixpanelLoading ? 'Loading…' : 'Load Mixpanel'}
            </button>
          )}
          {mixpanel && (
            <span className="text-xs font-medium" style={{ color: '#2BDA9F' }}>✓ Loaded</span>
          )}
        </div>
        {mixpanelError && (
          <p className="text-xs mt-2" style={{ color: '#d97706' }}>{mixpanelError}</p>
        )}
      </div>

      {/* Chorus Insights section */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 8px rgba(74,2,125,0.05)' }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A027D' }}>Chorus Insights</p>
          {!chorusTriggered && (
            <button
              onClick={() => setChorusTriggered(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: '#4A027D', color: '#ffffff' }}
            >
              Load Chorus
            </button>
          )}
          {chorusTriggered && (
            <span className="text-xs font-medium" style={{ color: '#2BDA9F' }}>✓ Loaded</span>
          )}
        </div>
        {chorusTriggered && <ChorusInsights companyName={company.name} />}
      </div>

      {/* Recent News section */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 8px rgba(74,2,125,0.05)' }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A027D' }}>Recent News</p>
          {!newsTriggered && (
            <button
              onClick={() => setNewsTriggered(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: '#4A027D', color: '#ffffff' }}
            >
              Load News
            </button>
          )}
          {newsTriggered && (
            <span className="text-xs font-medium" style={{ color: '#2BDA9F' }}>✓ Loaded</span>
          )}
        </div>
        {newsTriggered && <RecentNews companyName={company.name} />}
      </div>

      {/* AI Summary section */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: '#ffffff', border: '1px solid #ede9f5', boxShadow: '0 2px 8px rgba(74,2,125,0.05)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A027D' }}>AI Summary</p>
        <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>
          Will include: HubSpot data
          {mixpanel !== null && ' + Mixpanel ✓'}
          {chorusTriggered && ' + Chorus ✓'}
          {newsTriggered && ' + News ✓'}
        </p>
        {!aiSummary && (
          <button
            onClick={generateSummary}
            disabled={summaryLoading}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#4A027D', color: '#ffffff' }}
          >
            {summaryLoading ? 'Generating…' : 'Generate AI Summary'}
          </button>
        )}
        {summaryError && (
          <>
            <p className="text-xs mt-2" style={{ color: '#FB0467' }}>{summaryError}</p>
            <button
              onClick={generateSummary}
              className="text-xs font-medium mt-1"
              style={{ color: '#4A027D' }}
            >
              Retry
            </button>
          </>
        )}
        {aiSummary && (
          <>
            <AISummary summary={aiSummary} />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={saveNote}
                disabled={saving || !!savedNote}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                style={{ border: '1px solid #ede9f5', color: savedNote ? '#2BDA9F' : '#4A027D', backgroundColor: savedNote ? 'rgba(43,218,159,0.08)' : '#ffffff' }}
              >
                {saving ? 'Saving…' : savedNote ? '✓ Saved to HubSpot' : 'Save to HubSpot'}
              </button>
              {saveError && <p className="text-xs" style={{ color: '#FB0467' }}>{saveError}</p>}
            </div>
          </>
        )}
      </div>

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
