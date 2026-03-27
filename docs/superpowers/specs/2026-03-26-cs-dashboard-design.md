# CS Dashboard — Design Spec
**Date:** 2026-03-26
**Status:** In Review

---

## Overview

A new `/dashboard` route in Podchaser Intelligence giving each CS team member a personalised view of their book of business. Sydney (CS manager) additionally gets an owner toggle to view the full team picture or any individual rep's view.

The dashboard replaces the need to manually poll Client Health for routine triage. It surfaces pipeline health, renewal urgency, outreach gaps, and seat engagement in one place — each section isolated behind a sub-navigation tab so the page stays fast and focused.

---

## Auth & Role Detection

- The logged-in user's `hubspot_owner_id` is already stored in the `users` table.
- A new `is_manager BOOLEAN DEFAULT FALSE` column is added to `users` to identify Sydney. Set `is_manager = true` for Sydney's user record via a migration.
- `is_manager` must be threaded through the auth stack:
  1. Selected in `authorize()` in `lib/auth.ts` alongside existing fields
  2. Added to the `AppUser` interface in `types/next-auth.d.ts`
  3. Forwarded in the JWT callback (`token.is_manager = user.is_manager`)
  4. Exposed on the session object (`session.user.is_manager = token.is_manager`)
- Regular reps see only their own deals. Sydney sees an owner toggle above the sub-nav.
- **Owner Toggle options (Sydney only):** All | My Book | [Rep 1 name] | [Rep 2 name] | …
  - The rep list is sourced from the `OWNER_NAMES` map in `lib/hubspot.ts` (currently: Jon, Jules, Sydney). Adding a new rep means updating that map — no DB query needed.
  - **All** — queries with no owner filter (all deals in HubSpot)
  - **My Book** — queries filtered to Sydney's own `hubspot_owner_id`
  - **[Rep name]** — queries filtered to that rep's `hubspot_owner_id`
- The selected owner scope persists across all tabs and re-fetches the active tab on change.

---

## API Route Owner Parameter Contract

All four new dashboard API routes accept an optional `ownerId` query parameter:

- **Not present / omitted** — for regular reps (non-manager), the server enforces their own `hubspot_owner_id` from the session, ignoring any client-supplied value.
- `ownerId=all` — Sydney only; returns all deals regardless of owner. Non-manager requests with `ownerId=all` are rejected with 403.
- `ownerId={hubspot_owner_id}` — filters to a specific owner. Non-manager requests for a different owner's ID are rejected with 403.

Server-side: all four routes read `session.user.is_manager` and `session.user.hubspot_owner_id` to enforce this. A non-manager can never retrieve another rep's data regardless of what they pass in the query string.

---

## Page Structure

```
[Main Nav] … | Dashboard | …

[Owner Toggle — Sydney only]  All  |  My Book  |  Rep 1  |  Rep 2  | …

[Sub-Nav]  Overview  |  Renewals  |  Outreach  |  Seats

[Tab Content]
```

Sub-nav tabs load their data on first click (on-demand), not on page load. The Overview tab loads immediately on page render. Switching the owner toggle re-fetches the currently active tab only.

---

## Tab 1 — Overview (default, loads on page render)

**Purpose:** Clean landing page. A rep can answer "how is my book doing right now?" in under 10 seconds.

### Headline Stats Row
Three stat tiles:
- **Total Deals** — count of owned deals
- **Total Contract Value** — sum of deal `amount` across owned deals
- **Total Seats** — sum of the `seats` deal property across owned deals

### Seat Activity Row
Three stat tiles, each **clickable** — clicking navigates to the Seats tab with that tier pre-filtered:
- **Active** — contacts whose HubSpot last login is < 30 days ago
- **Inactive** — last login 31–90 days ago
- **Ghost** — last login > 90 days ago, or never logged in

### Distribution Tiles
Two tiles matching the existing `ResultsDashboard` visual style:
- **By Deal Stage** — bar chart of deal count per stage
- **By Business Type** — bar chart of deal count per business type

### Data Source
Single `GET /api/dashboard/summary?ownerId=…` call. Returns all of the above in one response. Fast — aggregates deal properties and contact login dates only, no quotes or deep contact fetches.

> **Implementation note:** The `seats` deal property is present in `ENTITLEMENT_PROPS` in `lib/hubspot.ts` but absent from `SEARCH_PROPS`. The new summary route must explicitly include `seats` in its HubSpot property request — it cannot reuse the existing `SEARCH_PROPS` array as-is.

---

## Tab 2 — Renewals (loads on tab click)

**Purpose:** See which deals are renewing soon and whether a quote is in motion.

### Controls
Day-range toggle: **30 / 60 / 90 days**. Changing the toggle re-fetches. Deals are sorted by soonest renewal first.

### Deal Cards
Each card shows:
- Company name, deal stage
- Renewal date + days remaining (e.g. "Apr 1 · 6 days")
- Current deal amount
- **Quote status chip**: No Quote / Draft / Sent / Accepted (from HubSpot Quotes API)
- **Quote amount** + **% change** vs current deal value (e.g. +12%, –5%, or — if no quote)
- A row of assigned pro user chips — each chip shows the contact's name and is color-coded by login tier (active = green, inactive = amber, ghost = red). Clicking a chip opens the User Side Panel with this deal as the context.

### Data Source
`GET /api/dashboard/renewals?days=30&ownerId=…` — fetches deals filtered by `contractEndDate` within the window, then calls HubSpot Quotes API for each deal's associated quotes. Quote amount and deal amount are compared to compute % change.

---

## Tab 3 — Outreach (loads on tab click)

**Purpose:** Identify deals that haven't been touched in too long.

### Controls
Day-range toggle: **30 / 45 / 60 days without contact**. Sorted by longest gap first.

### Deal Rows
Each row shows:
- Company name
- Owner name (visible in Sydney's All and per-rep views; hidden in Sydney's "My Book" view and all regular rep views, since every row would be the same name)
- Last contacted date (or "Never")
- Days since last contact
- Clicking a row opens the existing Client Health report for that deal (already built at `/client-health`)

### Data Source
`GET /api/dashboard/outreach?days=30&ownerId=…` — filters deals where `lastContactedDate` is older than the threshold or null.

> **Implementation note:** The existing `pollDeals` function in `lib/hubspot.ts` only handles a hardcoded 45-day outreach threshold and is not parameterised. The new outreach route requires a fresh parameterised HubSpot query — `pollDeals` cannot be reused as-is for the 30 and 60 day variants.

---

## Tab 4 — Seats (loads on tab click)

**Purpose:** Spot open seat opportunities and identify inactive/ghost users to re-engage.

### Summary Stats Row
- **Total Contracted Seats** — sum of `seats` property across owned deals
- **Assigned Pro Users** — total contacts flagged as pro users across those deals
- **Open Seats** — contracted minus assigned (engagement opportunity)
- **Inactive Pro Users** — pro users with last login > 30 days

The Active / Inactive / Ghost tiles from the Overview also appear here. When navigated to this tab via a click-through from the Overview, the relevant tier is pre-filtered and a "Clear filter" control is shown.

### Deal List
Expandable rows — each deal shows its contracted seat count and a summary (e.g. "3 active, 1 inactive, 1 open"). Expanding reveals the individual contacts:

Each contact chip shows:
- Name, last login date
- Color-coded tier badge (active / inactive / ghost)
- Clicking opens the User Side Panel, with that contact's parent deal passed as context

### Data Source
`GET /api/dashboard/seats?ownerId=…` — fetches all owned deals with their associated contacts, reading the `seats` deal property and last login date from each contact.

> **Implementation note:** Same as the summary route — `seats` must be explicitly included in the HubSpot property request, as it is absent from `SEARCH_PROPS`. Use the existing `fetchContactsForDeal(dealId)` in `lib/hubspot.ts` to retrieve contacts — it already filters to pro users only (`pro_user === 'true'`), which is the correct behaviour for both the Seats and Renewals tabs.

---

## User Side Panel

Slides in from the right. The dashboard (and active tab) remains visible behind it. Dismissible via close button or clicking outside.

### Header
Contact name, job title, company name, email address.

### Deal Context
The deal associated with the contact chip that was clicked — passed as a prop when the chip is rendered. In the Renewals tab this is the deal card the chip belongs to. In the Seats tab this is the deal row the chip is expanded under. In both cases the deal is unambiguous at render time.

Displays: renewal date, current deal amount, deal stage.

### Login Status
Last login date (HubSpot), tier badge (Active / Inactive / Ghost).

### Mixpanel Enrichment (on demand)
A **"Pull Mixpanel"** button. Not called on panel open — only fires when clicked. Posts `{ emails: [contact.email] }` to the existing `POST /api/mixpanel/usage` route. The route returns `MixpanelUserActivity[]` (an array). Since the panel sends a single email, use `result[0]`. The `MixpanelUserActivity` shape (defined in `lib/mixpanel.ts`):

```ts
{
  email: string;
  events: Record<string, number>;   // event name → count over 60 days
  topSearches: string[];             // top 10 search terms
  healthSignals: string[];           // e.g. "No logins in 60 days"
}
```

The panel renders: event counts for the `TRACKED_EVENTS` labels (Logins, Exports, Searches, etc.), top searches as pills, and health signal warnings.

### Email Draft Generation
A **"Generate Draft"** button with a context selector. Options:
- **Inactive User** — re-engagement email for a contact who hasn't logged in recently
- **Open Seats** — outreach to ask if anyone else on the account wants a seat
- **Renewal** — renewal discussion email with deal context

Each context maps to a distinct prompt template. This calls a **new** `POST /api/dashboard/draft` route (not the existing `/api/minimax/summary`, which is purpose-built for deal health summaries and does not accept email draft inputs). The new route accepts:

```ts
{
  context: 'inactive_user' | 'open_seats' | 'renewal';
  deal: { company: string; renewalDate: string | null; amount: number | null; stage: string };
  contact: { name: string; title: string | null; lastLogin: string | null; tier: 'Active' | 'Inactive' | 'Ghost' };
  mixpanel?: MixpanelUserActivity;  // included only if already pulled
}
```

It calls `lib/minimax.ts` with the appropriate prompt template for the context type and returns `{ draft: string }`. The route requires an active session and returns 401 if absent, consistent with all other routes in the project.

The generated draft appears in a text area in the panel. A **Copy** button copies it to clipboard.

> **Future refinement:** Prompt templates should be reviewed and tuned after initial testing. The right framing for each context type (tone, what data to emphasise, call-to-action) will become clearer once reps use the feature in practice.

### HubSpot Link
An **"Open in HubSpot"** button that opens the contact's HubSpot record in a new tab (using the contact's HubSpot contact ID).

---

## New API Routes

| Route | Purpose |
|---|---|
| `GET /api/dashboard/summary?ownerId=…` | Pipeline headline stats + seat tier counts |
| `GET /api/dashboard/renewals?days=30\|60\|90&ownerId=…` | Renewing deals + HubSpot Quotes data |
| `GET /api/dashboard/outreach?days=30\|45\|60&ownerId=…` | Deals not contacted within threshold |
| `GET /api/dashboard/seats?ownerId=…` | Per-deal seat counts + contacts with login tiers |
| `POST /api/dashboard/draft` | Email draft generation for the side panel |

All GET routes enforce the owner parameter contract described above. Non-manager users cannot query other owners' data.

### Reused Routes (no changes needed)
- `POST /api/mixpanel/usage` — on-demand Mixpanel enrichment in side panel

### HubSpot Library Changes
- Add `fetchDealQuotes(dealId)` to `lib/hubspot.ts` — calls the HubSpot Quotes API (`/crm/v3/objects/quotes`), returns the single most recent quote by `hs_lastmodifieddate` with fields: `hs_quote_status` (draft/sent/accepted), `hs_total` (amount), `hs_lastmodifieddate`. Returns `null` when the deal has no associated quotes (renders the "No Quote" chip).

### Minimax Library Changes
- Add `generateEmailDraft(context, deal, contact, mixpanel?)` to `lib/minimax.ts` — accepts a context type and builds the appropriate prompt, returning a draft string. Three prompt templates, one per context type.

---

## Database Changes

- Add `is_manager BOOLEAN DEFAULT FALSE` column to the `users` table.
- Set `is_manager = true` for Sydney's user record.
- Update `lib/auth.ts`: select `is_manager` in `authorize()`, add to `AppUser`, forward through JWT and session callbacks.
- Update `types/next-auth.d.ts`: add `is_manager: boolean` to both the `Session.user` augmentation block and the `JWT` augmentation block, or TypeScript will reject any access to `session.user.is_manager` across the codebase.

---

## New Components

| Component | Location | Purpose |
|---|---|---|
| `DashboardPage` | `app/dashboard/page.tsx` | Route entry, auth check, owner toggle for manager |
| `DashboardSubNav` | `components/dashboard/DashboardSubNav.tsx` | Tab sub-navigation |
| `OwnerToggle` | `components/dashboard/OwnerToggle.tsx` | Manager-only owner selector |
| `OverviewTab` | `components/dashboard/OverviewTab.tsx` | Pipeline headline + seat tiers + distributions |
| `RenewalsTab` | `components/dashboard/RenewalsTab.tsx` | Renewal deal cards with quote status |
| `OutreachTab` | `components/dashboard/OutreachTab.tsx` | Outreach gap deal list |
| `SeatsTab` | `components/dashboard/SeatsTab.tsx` | Seat summary + expandable deal/contact list |
| `UserSidePanel` | `components/dashboard/UserSidePanel.tsx` | Contact detail, Mixpanel pull, email draft |
| `RenewalDealCard` | `components/dashboard/RenewalDealCard.tsx` | Individual deal card in Renewals tab |
| `ContactChip` | `components/dashboard/ContactChip.tsx` | Clickable contact chip used in Renewals + Seats |
| `QuoteStatusChip` | `components/dashboard/QuoteStatusChip.tsx` | No Quote / Draft / Sent / Accepted badge |
| `SeatTierStat` | `components/dashboard/SeatTierStat.tsx` | Clickable stat tile for Active/Inactive/Ghost |

---

## Client-Side Caching

Each tab's data is cached in `localStorage` with a 4-hour TTL. Cache keys are scoped by tab, owner, and (where applicable) day range.

**Key format:** `dashboard:{tab}:{ownerId}` or `dashboard:{tab}:{ownerId}:{days}`

**`ownerId` values in cache keys:**
- Regular rep: their numeric `hubspot_owner_id` string (e.g. `dashboard:overview:157100429`)
- Sydney — All: literal string `all` (e.g. `dashboard:overview:all`)
- Sydney — My Book: her own `hubspot_owner_id` string (same format as a regular rep)
- Sydney — specific rep: that rep's `hubspot_owner_id` string

**Examples:**
- `dashboard:overview:157100429`
- `dashboard:renewals:all:60`
- `dashboard:outreach:157100429:45`
- `dashboard:seats:157100429`

On tab load:
1. Check `localStorage` for a valid (< 4 hours old) cache entry for the current key.
2. If valid: render from cache immediately, no API call.
3. If missing or expired: fetch from the API, render, and write result + timestamp to cache.

Each tab shows a small **"Last updated X mins ago · Refresh"** indicator in the top-right corner. Clicking **Refresh** clears the cache entry for that tab/owner/range combination and re-fetches live data.

Changing the owner toggle or day-range toggle does not invalidate other cached entries — each combination is independently cached.

---

## What Is Not In Scope

- **Stripe invoice integration** — future milestone. Quote data from HubSpot is the invoicing proxy for now.
- **Real-time updates** — data fetches on tab load/toggle change only. No polling or websockets.
- **Email sending** — the panel generates and copies a draft. Sending happens in HubSpot directly.
- **Mixpanel auto-enrichment** — only fires on explicit "Pull Mixpanel" click, never automatically.
