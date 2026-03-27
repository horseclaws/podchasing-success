# CS Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/dashboard` route giving CS reps a personal view of their book and Sydney a full-team toggle across four tabs: Overview, Renewals, Outreach, Seats — with a user side panel for contact drill-in and AI email draft generation.

**Architecture:** Server-fetched data from HubSpot (primary) and Mixpanel (on-demand only), rendered in client components with 4-hour localStorage caching per tab/owner/range key. Five new API routes enforce session-based owner access; Sydney's `is_manager` flag threads through NextAuth JWT and session.

**Tech Stack:** Next.js 16 (App Router), NextAuth v5 (JWT), Neon Postgres, HubSpot CRM v3 API, MiniMax LLM, Tailwind CSS v4, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-26-cs-dashboard-design.md`

---

## File Map

### New Files
| File | Purpose |
|---|---|
| `scripts/migrate-is-manager.ts` | DB migration: add `is_manager` column |
| `types/dashboard.ts` | Plain data types (`DashboardDeal`, `DashboardContact`, etc.) — imported by both `lib/hubspot.ts` and `lib/dashboard.ts` to avoid dependency inversion |
| `lib/dashboard.ts` | Helpers: `loginTier`, `enrichContacts`, `enforceOwnerAccess`, `EmailDraftContext` (imports types from `types/dashboard.ts`) |
| `lib/dashboard-cache.ts` | localStorage TTL cache helpers |
| `app/api/dashboard/summary/route.ts` | Pipeline headline stats + seat tier counts |
| `app/api/dashboard/renewals/route.ts` | Renewing deals + quote data |
| `app/api/dashboard/outreach/route.ts` | Deals not contacted in N days |
| `app/api/dashboard/seats/route.ts` | Per-deal seat + contact breakdown |
| `app/api/dashboard/draft/route.ts` | AI email draft generation |
| `app/dashboard/page.tsx` | Route entry point (server component) |
| `components/dashboard/DashboardClient.tsx` | Client shell: tabs, owner toggle, side panel state |
| `components/dashboard/DashboardSubNav.tsx` | Tab sub-navigation |
| `components/dashboard/OwnerToggle.tsx` | Manager-only owner selector |
| `components/dashboard/OverviewTab.tsx` | Tab 1: pipeline stats + seat tiers + distributions |
| `components/dashboard/RenewalsTab.tsx` | Tab 2: renewal deal cards |
| `components/dashboard/RenewalDealCard.tsx` | Individual renewal deal card |
| `components/dashboard/OutreachTab.tsx` | Tab 3: outreach gap list |
| `components/dashboard/SeatsTab.tsx` | Tab 4: seat/contact breakdown |
| `components/dashboard/UserSidePanel.tsx` | Sliding contact detail + Mixpanel + email draft |
| `components/dashboard/ContactChip.tsx` | Clickable contact chip (color-coded tier) |
| `components/dashboard/QuoteStatusChip.tsx` | No Quote / Draft / Sent / Accepted badge |
| `components/dashboard/SeatTierStat.tsx` | Clickable stat tile navigating to Seats tab |

### Modified Files
| File | Change |
|---|---|
| `scripts/migrate.ts` | Reference only — pattern for new migration script |
| `lib/auth.ts` | Add `is_manager` to `AppUser`, `authorize` query, JWT + session callbacks |
| `types/next-auth.d.ts` | Add `is_manager: boolean` to `Session.user` and `JWT` augmentations |
| `lib/hubspot.ts` | Add `DASHBOARD_PROPS`, `fetchDealsForDashboard`, `fetchRenewingDeals`, `fetchOutreachDeals`, `fetchDealQuotes` |
| `lib/minimax.ts` | Add `generateEmailDraft` |
| `components/NavTabs.tsx` | Add Dashboard tab |

---

## Task 1: DB Migration — add `is_manager`

**Files:**
- Create: `scripts/migrate-is-manager.ts`

- [ ] **Step 1: Write migration script**

```ts
// scripts/migrate-is-manager.ts
import { neon } from '@neondatabase/serverless';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_manager BOOLEAN NOT NULL DEFAULT false`;
  console.log('Added is_manager column');
}

migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run migration**

```bash
npx tsx scripts/migrate-is-manager.ts
```
Expected: `Added is_manager column`

- [ ] **Step 3: Set Sydney as manager**

In your Neon console or any Postgres client, run:
```sql
UPDATE users SET is_manager = true WHERE email = 'sydney@podchaser.com';
```
(Substitute Sydney's actual email address.)

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-is-manager.ts
git commit -m "feat: add is_manager column to users"
```

---

## Task 2: Auth — thread `is_manager` through NextAuth

**Files:**
- Modify: `lib/auth.ts`
- Modify: `types/next-auth.d.ts`

- [ ] **Step 1: Update `lib/auth.ts`**

Change `AppUser` interface:
```ts
export interface AppUser {
  id: string;
  name: string;
  email: string;
  hubspot_owner_id: string;
  must_change_password: boolean;
  is_manager: boolean;
}
```

Change the SQL query in `authorize()` — add `is_manager` to the SELECT:
```ts
rows = await sql`
  SELECT id, name, email, password_hash, hubspot_owner_id, must_change_password, is_manager
  FROM users
  WHERE email = ${credentials.email as string}
`;
```

Change the return value in `authorize()`:
```ts
return {
  id: user.id,
  name: user.name,
  email: user.email,
  hubspot_owner_id: user.hubspot_owner_id,
  must_change_password: user.must_change_password,
  is_manager: user.is_manager ?? false,
};
```

Change the `jwt` callback:
```ts
async jwt({ token, user }) {
  if (user) {
    const appUser = user as AppUser;
    token.id = appUser.id;
    token.hubspot_owner_id = appUser.hubspot_owner_id;
    token.must_change_password = appUser.must_change_password;
    token.is_manager = appUser.is_manager;
  }
  return token;
},
```

Change the `session` callback:
```ts
async session({ session, token }) {
  session.user.id = token.id;
  session.user.hubspot_owner_id = token.hubspot_owner_id;
  session.user.must_change_password = token.must_change_password;
  session.user.is_manager = token.is_manager;
  return session;
},
```

- [ ] **Step 2: Update `types/next-auth.d.ts`**

```ts
import 'next-auth';
import type { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      hubspot_owner_id: string;
      must_change_password: boolean;
      is_manager: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    hubspot_owner_id: string;
    must_change_password: boolean;
    is_manager: boolean;
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/jondispenza/Desktop/Test App/podchaser-intelligence" && npm run build 2>&1 | tail -20
```
Expected: build completes, no TypeScript errors about `is_manager`.

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts types/next-auth.d.ts
git commit -m "feat: add is_manager to auth JWT and session"
```

---

## Task 3: Shared dashboard types + helpers

**Files:**
- Create: `types/dashboard.ts`
- Create: `lib/dashboard.ts`

- [ ] **Step 1: Create `types/dashboard.ts`**

Plain data types only — no logic, no external imports. Both `lib/hubspot.ts` and `lib/dashboard.ts` import from here, keeping dependencies clean.

```ts
// types/dashboard.ts
export type LoginTier = 'Active' | 'Inactive' | 'Ghost';

export interface DashboardContact {
  id: string;
  name: string;
  email: string;
  title: string | null;
  lastLoginDate: string | null;
  tier: LoginTier;
  hubspotUrl: string;
}

export interface DashboardDeal {
  id: string;
  name: string;
  stage: string;
  amount: number | null;
  contractEndDate: string | null;
  lastContactedDate: string | null;
  businessType: string | null;
  ownerId: string | null;
  ownerName: string;
  seats: number;
}

export interface DealWithContacts extends DashboardDeal {
  contacts: DashboardContact[];
}

export interface DealQuote {
  status: 'draft' | 'sent' | 'accepted';
  amount: number | null;
  percentChange: number | null;
}

export interface DealWithQuote extends DealWithContacts {
  quote: DealQuote | null;
  daysUntilRenewal: number;
}

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
```

- [ ] **Step 2: Write `lib/dashboard.ts`**

```ts
// lib/dashboard.ts
import type { MixpanelUserActivity } from '@/lib/mixpanel';
import type { LoginTier, DashboardContact } from '@/types/dashboard';

// Re-export all plain types so the rest of the app imports from a single location
export type { LoginTier, DashboardContact, DashboardDeal, DealWithContacts, DealQuote, DealWithQuote, SummaryData } from '@/types/dashboard';

export function loginTier(lastLoginDate: string | null): LoginTier {
  if (!lastLoginDate) return 'Ghost';
  const days = (Date.now() - new Date(lastLoginDate).getTime()) / 86_400_000;
  if (days <= 30) return 'Active';
  if (days <= 90) return 'Inactive';
  return 'Ghost';
}

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

/**
 * Enriches raw HubSpot contacts with tier + HubSpot URL.
 * Requires NEXT_PUBLIC_HUBSPOT_PORTAL_ID in .env.local.
 * The input shape must include `title` — ensure `jobtitle` is in fetchContactsForDeal's property list.
 */
export function enrichContacts(
  contacts: Array<{ id: string; name: string; email: string; title: string | null; lastLoginDate: string | null }>
): DashboardContact[] {
  const portalId = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID ?? '';
  return contacts.map(c => ({
    ...c,
    tier: loginTier(c.lastLoginDate),
    hubspotUrl: `https://app.hubspot.com/contacts/${portalId}/contact/${c.id}`,
  }));
}

/**
 * Resolves the owner filter and enforces access control.
 * Returns { ownerId, error } — if error is set, respond 403.
 */
export function enforceOwnerAccess(
  isManager: boolean,
  sessionOwnerId: string,
  paramOwnerId: string | null
): { ownerId: string | null; error: string | null } {
  if (!isManager) {
    if (paramOwnerId === 'all') return { ownerId: null, error: 'Forbidden' };
    if (paramOwnerId && paramOwnerId !== sessionOwnerId) return { ownerId: null, error: 'Forbidden' };
    return { ownerId: sessionOwnerId, error: null };
  }
  if (!paramOwnerId || paramOwnerId === 'all') return { ownerId: null, error: null };
  return { ownerId: paramOwnerId, error: null };
}
```

- [ ] **Step 2: Add `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` to `.env.local`**

Open `.env.local` and add:
```
NEXT_PUBLIC_HUBSPOT_PORTAL_ID=your_portal_id_here
```
Find your portal ID in HubSpot → Account Settings → Account Defaults (it's in the URL: `app.hubspot.com/contacts/{PORTAL_ID}/`).

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard.ts
git commit -m "feat: add dashboard shared types and helpers"
```

---

## Task 4: localStorage cache helpers

**Files:**
- Create: `lib/dashboard-cache.ts`

- [ ] **Step 1: Write `lib/dashboard-cache.ts`**

```ts
// lib/dashboard-cache.ts
const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage may be unavailable (SSR) or full
  }
}

export function cacheClear(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

/** Returns age in minutes, or null if no entry. */
export function cacheAge(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    return Math.floor((Date.now() - entry.timestamp) / 60_000);
  } catch {
    return null;
  }
}

export function dashboardCacheKey(tab: string, ownerId: string, days?: number): string {
  return days != null
    ? `dashboard:${tab}:${ownerId}:${days}`
    : `dashboard:${tab}:${ownerId}`;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add lib/dashboard-cache.ts
git commit -m "feat: add dashboard localStorage cache helpers"
```

---

## Task 5: HubSpot lib — dashboard query functions

**Files:**
- Modify: `lib/hubspot.ts`

Add the following to `lib/hubspot.ts` after the existing `SEARCH_PROPS` definition and before `mapDealToRaw`.

- [ ] **Step 1: Add `DASHBOARD_PROPS` and the `DashboardDeal` import**

At the top of `lib/hubspot.ts`, add:
```ts
import type { DashboardDeal } from '@/types/dashboard';
```

After the existing `SEARCH_PROPS` block (around line 60), add:

```ts
// Dashboard queries include seats (absent from SEARCH_PROPS)
const DASHBOARD_PROPS = [
  'dealname', 'dealstage', 'pipeline', 'amount',
  'contract_end_date', 'notes_last_contacted', 'business_type',
  'hubspot_owner_id', 'seats',
];
```

- [ ] **Step 2: Add `mapDealToDashboard`**

Add after the existing `mapDealToRaw` function:

```ts
function mapDealToDashboard(
  d: { id: string; properties: Record<string, string | null> }
): DashboardDeal {
  const p = d.properties;
  return {
    id: d.id,
    name: p.dealname ?? '',
    stage: stageLabel(p.dealstage ?? ''),
    amount: p.amount != null && p.amount !== '' ? parseFloat(p.amount) : null,
    contractEndDate: p.contract_end_date ?? null,
    lastContactedDate: p.notes_last_contacted ?? null,
    businessType: p.business_type ?? null,
    ownerId: p.hubspot_owner_id ?? null,
    ownerName: ownerName(p.hubspot_owner_id ?? ''),
    seats: p.seats != null && p.seats !== '' ? parseInt(p.seats, 10) : 0,
  };
}
```

- [ ] **Step 3: Add `jobtitle` to `fetchContactsForDeal`**

The existing `fetchContactsForDeal` in `lib/hubspot.ts` does not request `jobtitle`. The side panel needs it. Find the contacts property array inside `fetchContactsForDeal` and add `'jobtitle'` to it. Then update the return mapping to include `title: p.jobtitle ?? null`. The return type of `fetchContactsForDeal` gains a `title: string | null` field — update accordingly.

- [ ] **Step 4: Add `fetchDealsForDashboard`**

Add after `pollDeals`:

```ts
/** All active deals for an owner (or all owners if ownerId is null). */
export async function fetchDealsForDashboard(ownerId: string | null): Promise<DashboardDeal[]> {
  const filters: unknown[] = [
    { propertyName: 'pipeline', operator: 'EQ', value: PIPELINE_ID },
    { propertyName: 'dealstage', operator: 'IN', values: VALID_STAGES },
  ];
  if (ownerId) filters.push({ propertyName: 'hubspot_owner_id', operator: 'EQ', value: ownerId });

  const result = await hubspotPost('/crm/v3/objects/deals/search', {
    filterGroups: [{ filters }],
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    properties: DASHBOARD_PROPS,
    limit: 100,
  });

  return (result.results ?? []).map(mapDealToDashboard);
}
```

- [ ] **Step 5: Add `fetchRenewingDeals`**

```ts
/** Deals whose contract_end_date falls within `days` from now. */
export async function fetchRenewingDeals(days: number, ownerId: string | null): Promise<DashboardDeal[]> {
  const now = Date.now();
  const filters: unknown[] = [
    { propertyName: 'contract_end_date', operator: 'BETWEEN',
      value: String(now), highValue: String(now + days * 86_400_000) },
    { propertyName: 'pipeline', operator: 'EQ', value: PIPELINE_ID },
    { propertyName: 'dealstage', operator: 'IN', values: VALID_STAGES },
  ];
  if (ownerId) filters.push({ propertyName: 'hubspot_owner_id', operator: 'EQ', value: ownerId });

  const result = await hubspotPost('/crm/v3/objects/deals/search', {
    filterGroups: [{ filters }],
    sorts: [{ propertyName: 'contract_end_date', direction: 'ASCENDING' }],
    properties: DASHBOARD_PROPS,
    limit: 100,
  });

  return (result.results ?? []).map(mapDealToDashboard);
}
```

- [ ] **Step 6: Add `fetchOutreachDeals`**

Uses two `filterGroups` (OR logic) so that deals where `notes_last_contacted` is null ("never contacted") are included alongside deals older than the threshold. HubSpot's `LT` filter silently excludes nulls.

```ts
/** Deals where last contacted date is older than `days` ago, OR never contacted. */
export async function fetchOutreachDeals(days: number, ownerId: string | null): Promise<DashboardDeal[]> {
  const cutoff = Date.now() - days * 86_400_000;
  const ownerFilter = ownerId
    ? [{ propertyName: 'hubspot_owner_id', operator: 'EQ', value: ownerId }]
    : [];
  const baseFilters: unknown[] = [
    { propertyName: 'pipeline', operator: 'EQ', value: PIPELINE_ID },
    { propertyName: 'dealstage', operator: 'IN', values: VALID_STAGES },
    ...ownerFilter,
  ];

  const result = await hubspotPost('/crm/v3/objects/deals/search', {
    filterGroups: [
      // Group 1: last contacted older than cutoff
      { filters: [...baseFilters, { propertyName: 'notes_last_contacted', operator: 'LT', value: String(cutoff) }] },
      // Group 2: never contacted (property has no value)
      { filters: [...baseFilters, { propertyName: 'notes_last_contacted', operator: 'NOT_HAS_PROPERTY' }] },
    ],
    sorts: [{ propertyName: 'notes_last_contacted', direction: 'ASCENDING' }],
    properties: DASHBOARD_PROPS,
    limit: 100,
  });

  return (result.results ?? []).map(mapDealToDashboard);
}
```

- [ ] **Step 7: Add `fetchDealQuotes`**

```ts
export interface HubSpotQuote {
  status: 'draft' | 'sent' | 'accepted';
  amount: number | null;
  lastModified: string;
}

/** Returns the most recent quote for a deal, or null if none. */
export async function fetchDealQuotes(dealId: string): Promise<HubSpotQuote | null> {
  try {
    const assoc = await hubspotGet(`/crm/v3/objects/deals/${dealId}/associations/quotes`);
    const quoteIds: string[] = (assoc.results ?? []).map((r: { id: string }) => r.id);
    if (quoteIds.length === 0) return null;

    const quotes = await Promise.all(
      quoteIds.map(id =>
        hubspotGet(`/crm/v3/objects/quotes/${id}?properties=hs_quote_status,hs_total,hs_lastmodifieddate`)
      )
    );

    const sorted = quotes.sort((a, b) =>
      new Date(b.properties.hs_lastmodifieddate ?? 0).getTime() -
      new Date(a.properties.hs_lastmodifieddate ?? 0).getTime()
    );

    const q = sorted[0];
    const raw = q.properties.hs_quote_status ?? '';
    const status = (['draft', 'sent', 'accepted'] as const).includes(raw as never)
      ? (raw as 'draft' | 'sent' | 'accepted')
      : 'draft';

    return {
      status,
      amount: q.properties.hs_total != null && q.properties.hs_total !== ''
        ? parseFloat(q.properties.hs_total) : null,
      lastModified: q.properties.hs_lastmodifieddate ?? '',
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 8: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 9: Commit**

```bash
git add lib/hubspot.ts
git commit -m "feat: add dashboard HubSpot query functions"
```

---

## Task 6: Minimax — `generateEmailDraft`

**Files:**
- Modify: `lib/minimax.ts`

- [ ] **Step 1: Add import at top of `lib/minimax.ts`**

`lib/minimax.ts` already imports `MixpanelUserActivity` — do not add a duplicate. Add only the `EmailDraftContext` import (it is not already there):

```ts
import type { EmailDraftContext } from '@/lib/dashboard';
```

- [ ] **Step 2: Add `generateEmailDraft` at the end of `lib/minimax.ts`**

```ts
export async function generateEmailDraft(ctx: EmailDraftContext): Promise<string> {
  const { type, deal, contact, mixpanel } = ctx;

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

  const instructions: Record<EmailDraftContext['type'], string> = {
    inactive_user: `Write a short, warm re-engagement email to ${contact.name} at ${deal.company}. They haven't logged into Podchaser recently (tier: ${contact.tier}). Offer help, mention a relevant feature, and include a clear call to action. Under 150 words.`,
    open_seats: `Write a short, friendly email to ${contact.name} at ${deal.company} noting that their account has unused seats. Ask if anyone else on their team would benefit from Podchaser access. Under 120 words.`,
    renewal: `Write a professional renewal discussion email to ${contact.name} at ${deal.company}. Contract renews${deal.renewalDate ? ` on ${deal.renewalDate}` : ' soon'}. Express appreciation, summarise value, and open a renewal conversation. Under 150 words.`,
  };

  const prompt = `You are a Customer Success manager at Podchaser. ${instructions[type]}

${dealCtx}
${contactCtx}${mixpanelCtx}

Rules: Warm but professional. No markdown. No subject line — email body only. Never fabricate data not provided above.`;

  const raw = await callMiniMax(prompt);
  return stripThinkingTags(raw);
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add lib/minimax.ts
git commit -m "feat: add generateEmailDraft to minimax lib"
```

---

## Task 7: API routes — summary, renewals, outreach, seats, draft

**Files:**
- Create: `app/api/dashboard/summary/route.ts`
- Create: `app/api/dashboard/renewals/route.ts`
- Create: `app/api/dashboard/outreach/route.ts`
- Create: `app/api/dashboard/seats/route.ts`
- Create: `app/api/dashboard/draft/route.ts`

- [ ] **Step 1: Create summary route**

```ts
// app/api/dashboard/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchDealsForDashboard, fetchContactsForDeal } from '@/lib/hubspot';
import { enforceOwnerAccess, enrichContacts, loginTier, type SummaryData } from '@/lib/dashboard';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ownerId, error } = enforceOwnerAccess(
    session.user.is_manager,
    session.user.hubspot_owner_id,
    req.nextUrl.searchParams.get('ownerId')
  );
  if (error) return NextResponse.json({ error }, { status: 403 });

  const deals = await fetchDealsForDashboard(ownerId);

  const contactArrays = await Promise.all(
    deals.map(d => fetchContactsForDeal(d.id).catch(() => []))
  );

  let activeContacts = 0, inactiveContacts = 0, ghostContacts = 0;
  const byStage: Record<string, number> = {};
  const byBusinessType: Record<string, number> = {};

  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    byStage[deal.stage] = (byStage[deal.stage] ?? 0) + 1;
    byBusinessType[deal.businessType ?? 'Unknown'] = (byBusinessType[deal.businessType ?? 'Unknown'] ?? 0) + 1;

    for (const c of contactArrays[i]) {
      const t = loginTier(c.lastLoginDate);
      if (t === 'Active') activeContacts++;
      else if (t === 'Inactive') inactiveContacts++;
      else ghostContacts++;
    }
  }

  const data: SummaryData = {
    totalDeals: deals.length,
    totalContractValue: Math.round(deals.reduce((s, d) => s + (d.amount ?? 0), 0)),
    totalSeats: deals.reduce((s, d) => s + d.seats, 0),
    activeContacts,
    inactiveContacts,
    ghostContacts,
    byStage,
    byBusinessType,
  };

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Create renewals route**

```ts
// app/api/dashboard/renewals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchRenewingDeals, fetchContactsForDeal, fetchDealQuotes } from '@/lib/hubspot';
import { enforceOwnerAccess, enrichContacts, type DealWithQuote } from '@/lib/dashboard';

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
  const days = [30, 60, 90].includes(daysParam) ? daysParam : 30;

  const deals = await fetchRenewingDeals(days, ownerId);

  const [contactArrays, rawQuotes] = await Promise.all([
    Promise.all(deals.map(d => fetchContactsForDeal(d.id).catch(() => []))),
    Promise.all(deals.map(d => fetchDealQuotes(d.id).catch(() => null))),
  ]);

  const result: DealWithQuote[] = deals.map((deal, i) => {
    const contacts = enrichContacts(contactArrays[i]);
    const q = rawQuotes[i];
    const daysUntilRenewal = deal.contractEndDate
      ? Math.round((new Date(deal.contractEndDate).getTime() - Date.now()) / 86_400_000)
      : 0;

    const quote = q ? {
      status: q.status,
      amount: q.amount,
      percentChange: (deal.amount && q.amount)
        ? Math.round(((q.amount - deal.amount) / deal.amount) * 100)
        : null,
    } : null;

    return { ...deal, contacts, quote, daysUntilRenewal };
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 3: Create outreach route**

```ts
// app/api/dashboard/outreach/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchOutreachDeals } from '@/lib/hubspot';
import { enforceOwnerAccess } from '@/lib/dashboard';

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

  const deals = await fetchOutreachDeals(days, ownerId);
  return NextResponse.json(deals);
}
```

- [ ] **Step 4: Create seats route**

```ts
// app/api/dashboard/seats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchDealsForDashboard, fetchContactsForDeal } from '@/lib/hubspot';
import { enforceOwnerAccess, enrichContacts, type DealWithContacts } from '@/lib/dashboard';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ownerId, error } = enforceOwnerAccess(
    session.user.is_manager,
    session.user.hubspot_owner_id,
    req.nextUrl.searchParams.get('ownerId')
  );
  if (error) return NextResponse.json({ error }, { status: 403 });

  const deals = await fetchDealsForDashboard(ownerId);
  const contactArrays = await Promise.all(
    deals.map(d => fetchContactsForDeal(d.id).catch(() => []))
  );

  const result: DealWithContacts[] = deals.map((deal, i) => ({
    ...deal,
    contacts: enrichContacts(contactArrays[i]),
  }));

  return NextResponse.json(result);
}
```

- [ ] **Step 5: Create draft route**

```ts
// app/api/dashboard/draft/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateEmailDraft } from '@/lib/minimax';
import type { EmailDraftContext } from '@/lib/dashboard';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: EmailDraftContext = await req.json();
  if (!body.type || !body.deal || !body.contact) {
    return NextResponse.json({ error: 'type, deal, and contact are required' }, { status: 400 });
  }

  const draft = await generateEmailDraft(body);
  return NextResponse.json({ draft });
}
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: build completes without TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/dashboard/
git commit -m "feat: add dashboard API routes (summary, renewals, outreach, seats, draft)"
```

---

## Task 8: Shared UI components

**Files:**
- Create: `components/dashboard/ContactChip.tsx`
- Create: `components/dashboard/QuoteStatusChip.tsx`
- Create: `components/dashboard/SeatTierStat.tsx`

- [ ] **Step 1: Create `ContactChip`**

```tsx
// components/dashboard/ContactChip.tsx
import type { DashboardContact, DashboardDeal } from '@/lib/dashboard';

const TIER_COLORS = {
  Active: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  Inactive: 'bg-amber-100 text-amber-800 ring-amber-200',
  Ghost: 'bg-red-100 text-red-800 ring-red-200',
};

interface Props {
  contact: DashboardContact;
  deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>;
  onClick: (contact: DashboardContact, deal: Props['deal']) => void;
}

export default function ContactChip({ contact, deal, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(contact, deal)}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset hover:opacity-80 transition-opacity ${TIER_COLORS[contact.tier]}`}
    >
      {contact.name || contact.email}
    </button>
  );
}
```

- [ ] **Step 2: Create `QuoteStatusChip`**

```tsx
// components/dashboard/QuoteStatusChip.tsx
type QuoteStatus = 'none' | 'draft' | 'sent' | 'accepted';

const COLORS: Record<QuoteStatus, string> = {
  none: 'bg-gray-100 text-gray-500',
  draft: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
};

const LABELS: Record<QuoteStatus, string> = {
  none: 'No Quote', draft: 'Draft', sent: 'Sent', accepted: 'Accepted',
};

export default function QuoteStatusChip({ status }: { status: QuoteStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${COLORS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 3: Create `SeatTierStat`**

```tsx
// components/dashboard/SeatTierStat.tsx
import type { LoginTier } from '@/lib/dashboard';

const COLORS: Record<LoginTier, { border: string; label: string }> = {
  Active:   { border: 'border-emerald-200 bg-emerald-50', label: 'text-emerald-700' },
  Inactive: { border: 'border-amber-200 bg-amber-50',     label: 'text-amber-700' },
  Ghost:    { border: 'border-red-200 bg-red-50',         label: 'text-red-700' },
};

interface Props {
  tier: LoginTier;
  count: number;
  onClick: (tier: LoginTier) => void;
}

export default function SeatTierStat({ tier, count, onClick }: Props) {
  const c = COLORS[tier];
  return (
    <button
      onClick={() => onClick(tier)}
      className={`rounded-2xl p-4 border text-left w-full hover:opacity-90 transition-opacity ${c.border}`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${c.label}`}>{tier}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{count}</p>
      <p className="text-xs text-gray-400 mt-0.5">seats</p>
    </button>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ContactChip.tsx components/dashboard/QuoteStatusChip.tsx components/dashboard/SeatTierStat.tsx
git commit -m "feat: add shared dashboard UI components"
```

---

## Task 9: UserSidePanel

**Files:**
- Create: `components/dashboard/UserSidePanel.tsx`

- [ ] **Step 1: Create `UserSidePanel`**

```tsx
// components/dashboard/UserSidePanel.tsx
'use client';
import { useState } from 'react';
import type { DashboardContact, DashboardDeal, LoginTier, EmailDraftContext } from '@/lib/dashboard';
import type { MixpanelUserActivity } from '@/lib/mixpanel';

type DraftType = EmailDraftContext['type'];

const TIER_BADGE: Record<LoginTier, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-amber-100 text-amber-700',
  Ghost: 'bg-red-100 text-red-700',
};

const DRAFT_LABELS: Record<DraftType, string> = {
  inactive_user: 'Inactive User',
  open_seats: 'Open Seats',
  renewal: 'Renewal',
};

interface Props {
  contact: DashboardContact;
  deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>;
  onClose: () => void;
}

export default function UserSidePanel({ contact, deal, onClose }: Props) {
  const [mixpanel, setMixpanel] = useState<MixpanelUserActivity | null>(null);
  const [mixpanelLoading, setMixpanelLoading] = useState(false);
  const [draftType, setDraftType] = useState<DraftType>('inactive_user');
  const [draft, setDraft] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function pullMixpanel() {
    setMixpanelLoading(true);
    try {
      const res = await fetch('/api/mixpanel/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: [contact.email] }),
      });
      const data = await res.json();
      if (res.ok) setMixpanel(data[0] ?? null);
    } finally {
      setMixpanelLoading(false);
    }
  }

  async function generateDraft() {
    setDraftLoading(true);
    setDraft(null);
    try {
      const ctx: EmailDraftContext = {
        type: draftType,
        deal: { company: deal.name, renewalDate: deal.contractEndDate, amount: deal.amount, stage: deal.stage },
        contact: { name: contact.name, title: null, lastLogin: contact.lastLoginDate, tier: contact.tier },
        mixpanel: mixpanel ?? undefined,
      };
      const res = await fetch('/api/dashboard/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ctx),
      });
      const data = await res.json();
      if (res.ok) setDraft(data.draft);
    } finally {
      setDraftLoading(false);
    }
  }

  async function copy() {
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-foreground">{contact.name || contact.email}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{contact.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">&times;</button>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {/* Deal context */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-2">Deal</p>
            <p className="text-sm font-medium">{deal.name}</p>
            <div className="mt-1 text-xs text-gray-500 space-y-0.5">
              <p>Stage: {deal.stage}</p>
              {deal.amount != null && <p>Value: ${deal.amount.toLocaleString()}</p>}
              {fmtDate(deal.contractEndDate) && <p>Renewal: {fmtDate(deal.contractEndDate)}</p>}
            </div>
          </section>

          {/* Login status */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-2">Login Status</p>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_BADGE[contact.tier]}`}>
                {contact.tier}
              </span>
              <span className="text-xs text-gray-500">
                {fmtDate(contact.lastLoginDate) ? `Last: ${fmtDate(contact.lastLoginDate)}` : 'Never logged in'}
              </span>
            </div>
          </section>

          {/* Mixpanel */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-2">Product Activity</p>
            {!mixpanel ? (
              <button
                onClick={pullMixpanel}
                disabled={mixpanelLoading}
                className="text-xs px-3 py-1.5 rounded-lg bg-violet-50 text-brand-purple font-medium hover:bg-violet-100 disabled:opacity-50"
              >
                {mixpanelLoading ? 'Loading…' : 'Pull Mixpanel'}
              </button>
            ) : (
              <div className="space-y-1 text-xs text-gray-600">
                {([['Logins', 'loginSuccess'], ['Exports', 'exportButtonClicked'], ['Searches', 'TopSearchSubmit']] as [string, string][]).map(([label, key]) => (
                  <div key={key} className="flex justify-between">
                    <span>{label}</span>
                    <span className="font-medium">{mixpanel.events[key] ?? 0}</span>
                  </div>
                ))}
                {mixpanel.topSearches.length > 0 && (
                  <p className="text-gray-400 mt-1">Searches: {mixpanel.topSearches.slice(0, 5).join(', ')}</p>
                )}
                {mixpanel.healthSignals.map(s => (
                  <p key={s} className="text-amber-600 mt-0.5">⚠ {s}</p>
                ))}
              </div>
            )}
          </section>

          {/* Email draft */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple mb-2">Generate Draft</p>
            <div className="flex gap-1 flex-wrap mb-3">
              {(Object.keys(DRAFT_LABELS) as DraftType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setDraftType(t)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    draftType === t
                      ? 'bg-brand-purple text-white'
                      : 'bg-violet-50 text-brand-purple hover:bg-violet-100'
                  }`}
                >
                  {DRAFT_LABELS[t]}
                </button>
              ))}
            </div>
            <button
              onClick={generateDraft}
              disabled={draftLoading}
              className="w-full text-xs px-3 py-1.5 rounded-lg bg-brand-purple text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              {draftLoading ? 'Generating…' : 'Generate Draft'}
            </button>
            {draft && (
              <div className="mt-3">
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
              </div>
            )}
          </section>

          {/* HubSpot link */}
          <a
            href={contact.hubspotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-xs px-3 py-2 rounded-lg border border-violet-200 text-brand-purple font-medium hover:bg-violet-50"
          >
            Open in HubSpot →
          </a>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/UserSidePanel.tsx
git commit -m "feat: add UserSidePanel component"
```

---

## Task 10: Tab components

**Files:**
- Create: `components/dashboard/OverviewTab.tsx`
- Create: `components/dashboard/RenewalDealCard.tsx`
- Create: `components/dashboard/RenewalsTab.tsx`
- Create: `components/dashboard/OutreachTab.tsx`
- Create: `components/dashboard/SeatsTab.tsx`

- [ ] **Step 1: Create `OverviewTab`**

```tsx
// components/dashboard/OverviewTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { SummaryData, LoginTier } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import SeatTierStat from './SeatTierStat';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

function DistributionTile({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] ?? 1;
  const colors = ['bg-brand-purple', 'bg-brand-cyan', 'bg-brand-mint', 'bg-brand-pink'];
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
              <div className={`h-1.5 rounded-full ${colors[i % colors.length]}`} style={{ width: `${(count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  ownerId: string;
  onNavigateToSeats: (tier: LoginTier) => void;
}

export default function OverviewTab({ ownerId, onNavigateToSeats }: Props) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);
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

  if (loading) return <LoadingSpinner message="Loading overview…" />;
  if (error) return <p className="text-sm text-gray-500 py-4">{error}</p>;
  if (!data) return null;

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
        <DistributionTile title="By Business Type" counts={data.byBusinessType} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `RenewalDealCard`**

```tsx
// components/dashboard/RenewalDealCard.tsx
import type { DealWithQuote, DashboardContact, DashboardDeal } from '@/lib/dashboard';
import ContactChip from './ContactChip';
import QuoteStatusChip from './QuoteStatusChip';

interface Props {
  deal: DealWithQuote;
  onContactClick: (contact: DashboardContact, deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>) => void;
}

export default function RenewalDealCard({ deal, onContactClick }: Props) {
  const renewalDate = deal.contractEndDate
    ? new Date(deal.contractEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const quoteStatus = deal.quote ? deal.quote.status : 'none';
  const dealSnap = { id: deal.id, name: deal.name, stage: deal.stage, amount: deal.amount, contractEndDate: deal.contractEndDate };

  return (
    <div className="rounded-2xl p-4 bg-white border border-violet-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{deal.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{deal.stage}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">{renewalDate}</p>
          <p className="text-xs text-gray-400">{deal.daysUntilRenewal}d remaining</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {deal.amount != null && (
          <span className="text-xs text-gray-600">${deal.amount.toLocaleString()}</span>
        )}
        <QuoteStatusChip status={quoteStatus} />
        {deal.quote?.amount != null && (
          <span className="text-xs text-gray-600">
            Quote: ${deal.quote.amount.toLocaleString()}
            {deal.quote.percentChange != null && (
              <span className={deal.quote.percentChange >= 0 ? 'text-emerald-600 ml-1' : 'text-red-500 ml-1'}>
                ({deal.quote.percentChange >= 0 ? '+' : ''}{deal.quote.percentChange}%)
              </span>
            )}
          </span>
        )}
      </div>

      {deal.contacts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {deal.contacts.map(c => (
            <ContactChip key={c.id} contact={c} deal={dealSnap} onClick={onContactClick} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `RenewalsTab`**

```tsx
// components/dashboard/RenewalsTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { DealWithQuote, DashboardContact, DashboardDeal, LoginTier } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import RenewalDealCard from './RenewalDealCard';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

type Days = 30 | 60 | 90;

interface Props {
  ownerId: string;
  onContactClick: (contact: DashboardContact, deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>) => void;
}

export default function RenewalsTab({ ownerId, onContactClick }: Props) {
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<DealWithQuote[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);

  const load = useCallback(async (bust = false) => {
    const key = dashboardCacheKey('renewals', ownerId, days);
    if (bust) cacheClear(key);
    const cached = cacheGet<DealWithQuote[]>(key);
    if (cached) { setData(cached); setAgeMinutes(cacheAge(key)); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/dashboard/renewals?days=${days}&ownerId=${ownerId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      cacheSet(key, json); setData(json); setAgeMinutes(0);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [ownerId, days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {([30, 60, 90] as Days[]).map(d => (
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

      {loading && <LoadingSpinner message="Loading renewals…" />}
      {error && <p className="text-sm text-gray-500 py-4">{error}</p>}
      {data && !loading && (
        data.length === 0
          ? <p className="text-sm text-gray-400 py-4">No deals renewing in {days} days.</p>
          : <div className="space-y-3">
              {data.map(deal => (
                <RenewalDealCard key={deal.id} deal={deal} onContactClick={onContactClick} />
              ))}
            </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `OutreachTab`**

```tsx
// components/dashboard/OutreachTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { DashboardDeal } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

type Days = 30 | 45 | 60;

interface Props {
  ownerId: string;
  showOwnerColumn: boolean;
}

export default function OutreachTab({ ownerId, showOwnerColumn }: Props) {
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<DashboardDeal[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);

  const load = useCallback(async (bust = false) => {
    const key = dashboardCacheKey('outreach', ownerId, days);
    if (bust) cacheClear(key);
    const cached = cacheGet<DashboardDeal[]>(key);
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
          : <div className="rounded-2xl border border-violet-100 overflow-hidden">
              {data.map((deal, i) => (
                <a
                  key={deal.id}
                  href={`/client-health?dealId=${deal.id}`}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-violet-50 transition-colors ${i > 0 ? 'border-t border-violet-50' : ''}`}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{deal.name}</p>
                    {showOwnerColumn && (
                      <p className="text-xs text-gray-400">{deal.ownerName}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-700">{fmtDate(deal.lastContactedDate)}</p>
                    {daysSince(deal.lastContactedDate) != null && (
                      <p className="text-xs text-red-400">{daysSince(deal.lastContactedDate)}d ago</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `SeatsTab`**

```tsx
// components/dashboard/SeatsTab.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import type { DealWithContacts, DashboardContact, DashboardDeal, LoginTier } from '@/lib/dashboard';
import { cacheGet, cacheSet, cacheClear, cacheAge, dashboardCacheKey } from '@/lib/dashboard-cache';
import ContactChip from './ContactChip';
import SeatTierStat from './SeatTierStat';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface Props {
  ownerId: string;
  initialTierFilter?: LoginTier | null;
  onContactClick: (contact: DashboardContact, deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>) => void;
}

export default function SeatsTab({ ownerId, initialTierFilter, onContactClick }: Props) {
  const [data, setData] = useState<DealWithContacts[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ageMinutes, setAgeMinutes] = useState<number | null>(null);
  const [tierFilter, setTierFilter] = useState<LoginTier | null>(initialTierFilter ?? null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const key = dashboardCacheKey('seats', ownerId);

  const load = useCallback(async (bust = false) => {
    if (bust) cacheClear(key);
    const cached = cacheGet<DealWithContacts[]>(key);
    if (cached) { setData(cached); setAgeMinutes(cacheAge(key)); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/dashboard/seats?ownerId=${ownerId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      cacheSet(key, json); setData(json); setAgeMinutes(0);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [ownerId, key]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const filteredData = tierFilter
    ? data?.map(d => ({ ...d, contacts: d.contacts.filter(c => c.tier === tierFilter) })).filter(d => d.contacts.length > 0)
    : data;

  const allContacts = data?.flatMap(d => d.contacts) ?? [];
  const active = allContacts.filter(c => c.tier === 'Active').length;
  const inactive = allContacts.filter(c => c.tier === 'Inactive').length;
  const ghost = allContacts.filter(c => c.tier === 'Ghost').length;
  const totalSeats = data?.reduce((s, d) => s + d.seats, 0) ?? 0;
  const totalAssigned = allContacts.length;
  const openSeats = totalSeats - totalAssigned;

  if (loading) return <LoadingSpinner message="Loading seats…" />;
  if (error) return <p className="text-sm text-gray-500 py-4">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => load(true)} className="text-xs text-gray-400 hover:text-brand-purple">
          {ageMinutes != null ? `Updated ${ageMinutes}m ago · ` : ''}Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Seats', value: totalSeats },
          { label: 'Assigned', value: totalAssigned },
          { label: 'Open Seats', value: Math.max(0, openSeats) },
          { label: 'Inactive Pro Users', value: inactive + ghost },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 bg-white border border-violet-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">{s.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tier filter */}
      <div className="flex items-center gap-2">
        <div className="flex gap-2 flex-1">
          {(['Active', 'Inactive', 'Ghost'] as LoginTier[]).map(tier => (
            <SeatTierStat
              key={tier}
              tier={tier}
              count={tier === 'Active' ? active : tier === 'Inactive' ? inactive : ghost}
              onClick={t => setTierFilter(prev => prev === t ? null : t)}
            />
          ))}
        </div>
        {tierFilter && (
          <button onClick={() => setTierFilter(null)} className="text-xs text-gray-400 hover:text-brand-purple whitespace-nowrap">
            Clear filter
          </button>
        )}
      </div>

      {/* Deal list */}
      <div className="space-y-2">
        {(filteredData ?? []).map(deal => {
          const dealSnap = { id: deal.id, name: deal.name, stage: deal.stage, amount: deal.amount, contractEndDate: deal.contractEndDate };
          const isOpen = expanded.has(deal.id);
          const dealActive = deal.contacts.filter(c => c.tier === 'Active').length;
          const dealInactive = deal.contacts.filter(c => c.tier === 'Inactive').length;
          const dealOpen = Math.max(0, deal.seats - deal.contacts.length);
          return (
            <div key={deal.id} className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
              <button
                onClick={() => toggle(deal.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{deal.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {dealActive} active · {dealInactive} inactive · {dealOpen} open
                  </p>
                </div>
                <span className="text-gray-300 ml-4">{isOpen ? '▲' : '▼'}</span>
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
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/OverviewTab.tsx components/dashboard/RenewalDealCard.tsx components/dashboard/RenewalsTab.tsx components/dashboard/OutreachTab.tsx components/dashboard/SeatsTab.tsx
git commit -m "feat: add dashboard tab components"
```

---

## Task 11: Dashboard page, nav, and client shell

**Files:**
- Create: `components/dashboard/DashboardSubNav.tsx`
- Create: `components/dashboard/OwnerToggle.tsx`
- Create: `components/dashboard/DashboardClient.tsx`
- Create: `app/dashboard/page.tsx`
- Modify: `components/NavTabs.tsx`

- [ ] **Step 1: Create `DashboardSubNav`**

```tsx
// components/dashboard/DashboardSubNav.tsx
type Tab = 'overview' | 'renewals' | 'outreach' | 'seats';

const LABELS: Record<Tab, string> = {
  overview: 'Overview', renewals: 'Renewals', outreach: 'Outreach', seats: 'Seats',
};

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function DashboardSubNav({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 border-b border-violet-100 mb-6">
      {(Object.keys(LABELS) as Tab[]).map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            active === tab
              ? 'border-brand-purple text-brand-purple'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `OwnerToggle`**

```tsx
// components/dashboard/OwnerToggle.tsx
import { OWNER_NAMES } from '@/lib/hubspot';

interface Props {
  selected: string; // 'all' or a hubspot_owner_id
  onChange: (ownerId: string) => void;
  currentUserId: string; // Sydney's own hubspot_owner_id
}

export default function OwnerToggle({ selected, onChange, currentUserId }: Props) {
  const options = [
    { value: 'all', label: 'All' },
    { value: currentUserId, label: 'My Book' },
    ...Object.entries(OWNER_NAMES)
      .filter(([id]) => id !== currentUserId)
      .map(([id, name]) => ({ value: id, label: name.split(' ')[0] })),
  ];

  return (
    <div className="flex gap-1 mb-5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selected === opt.value
              ? 'bg-brand-purple text-white'
              : 'bg-violet-50 text-brand-purple hover:bg-violet-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

Note: `OWNER_NAMES` needs to be exported from `lib/hubspot.ts`. Currently it is not exported. Add `export` to its declaration:

In `lib/hubspot.ts`, change:
```ts
const OWNER_NAMES: Record<string, string> = {
```
to:
```ts
export const OWNER_NAMES: Record<string, string> = {
```

- [ ] **Step 3: Export `OWNER_NAMES` from `lib/hubspot.ts`**

Edit the `OWNER_NAMES` constant to be exported (it's around line 295).

- [ ] **Step 4: Create `DashboardClient`**

```tsx
// components/dashboard/DashboardClient.tsx
'use client';
import { useState } from 'react';
import type { DashboardContact, DashboardDeal, LoginTier } from '@/lib/dashboard';
import { PageHeader } from '@/components/ui';
import DashboardSubNav from './DashboardSubNav';
import OwnerToggle from './OwnerToggle';
import OverviewTab from './OverviewTab';
import RenewalsTab from './RenewalsTab';
import OutreachTab from './OutreachTab';
import SeatsTab from './SeatsTab';
import UserSidePanel from './UserSidePanel';

type Tab = 'overview' | 'renewals' | 'outreach' | 'seats';

interface Props {
  isManager: boolean;
  hubspotOwnerId: string;
}

export default function DashboardClient({ isManager, hubspotOwnerId }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [ownerId, setOwnerId] = useState<string>(isManager ? 'all' : hubspotOwnerId);
  const [pendingTierFilter, setPendingTierFilter] = useState<LoginTier | null>(null);
  const [panel, setPanel] = useState<{
    contact: DashboardContact;
    deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>;
  } | null>(null);

  function navigateToSeats(tier: LoginTier) {
    setPendingTierFilter(tier);
    setTab('seats');
  }

  function openPanel(
    contact: DashboardContact,
    deal: Pick<DashboardDeal, 'id' | 'name' | 'stage' | 'amount' | 'contractEndDate'>
  ) {
    setPanel({ contact, deal });
  }

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your book of business at a glance" />

      {isManager && (
        <OwnerToggle selected={ownerId} onChange={setOwnerId} currentUserId={hubspotOwnerId} />
      )}

      <DashboardSubNav active={tab} onChange={t => { setTab(t); if (t !== 'seats') setPendingTierFilter(null); }} />

      {tab === 'overview' && (
        <OverviewTab ownerId={ownerId} onNavigateToSeats={navigateToSeats} />
      )}
      {tab === 'renewals' && (
        <RenewalsTab ownerId={ownerId} onContactClick={openPanel} />
      )}
      {tab === 'outreach' && (
        <OutreachTab ownerId={ownerId} showOwnerColumn={isManager && ownerId === 'all'} />
      )}
      {tab === 'seats' && (
        <SeatsTab
          ownerId={ownerId}
          initialTierFilter={pendingTierFilter}
          onContactClick={openPanel}
        />
      )}

      {panel && (
        <UserSidePanel
          contact={panel.contact}
          deal={panel.deal}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `app/dashboard/page.tsx`**

```tsx
// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <DashboardClient
      isManager={session.user.is_manager}
      hubspotOwnerId={session.user.hubspot_owner_id}
    />
  );
}
```

- [ ] **Step 6: Add Dashboard to NavTabs**

In `components/NavTabs.tsx`, add to the `tabs` array:

```ts
const tabs = [
  { href: '/client-health', label: 'Client Health' },
  { href: '/chart-history', label: 'Chart History' },
  { href: '/guest-finder', label: 'Guest Finder' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/team', label: 'Team' },
];
```

- [ ] **Step 7: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: build completes without errors.

- [ ] **Step 8: Smoke test in browser**

```bash
npm run dev
```

Navigate to `http://localhost:3000/dashboard`:
- Overview tab loads pipeline stats
- Seat tier stat tiles are clickable → navigates to Seats tab with filter
- Renewals tab loads deal cards with quote status chips
- Contact chips open the side panel
- Side panel shows contact/deal context, Mixpanel pull button, draft type selector, Generate Draft button
- Sydney's account shows the owner toggle; regular rep account does not

- [ ] **Step 9: Commit**

```bash
git add components/dashboard/ app/dashboard/ components/NavTabs.tsx lib/hubspot.ts
git commit -m "feat: add CS dashboard page, tabs, and side panel"
```

---

## Done

All tasks complete. The dashboard is live at `/dashboard`.

**Verify end-to-end:**
1. Log in as a regular rep → see only own deals, no owner toggle
2. Log in as Sydney → see owner toggle, switching to "All" shows full pipeline
3. Click an inactive contact chip on a renewal card → side panel opens with deal context
4. Click "Pull Mixpanel" → activity data loads
5. Select "Inactive User" draft type, click "Generate Draft" → email draft appears
6. Click "Copy" → draft copies to clipboard; click "Open in HubSpot" → contact opens in new tab
7. Click Active seat count on Overview → navigates to Seats tab filtered to Active, "Clear filter" appears
