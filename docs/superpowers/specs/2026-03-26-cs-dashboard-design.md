# CS Dashboard — Design Spec
**Date:** 2026-03-26
**Status:** Approved

---

## Overview

A new `/dashboard` route in Podchaser Intelligence giving each CS team member a personalised view of their book of business. Sydney (CS manager) additionally gets an owner toggle to view the full team picture or any individual rep's view.

The dashboard replaces the need to manually poll Client Health for routine triage. It surfaces pipeline health, renewal urgency, outreach gaps, and seat engagement in one place — each section isolated behind a sub-navigation tab so the page stays fast and focused.

---

## Auth & Role Detection

- The logged-in user's `hubspot_owner_id` is already stored in the `users` table.
- A new `is_manager` boolean column is added to `users` to identify Sydney.
- Regular reps see only their own deals (filtered by `hubspot_owner_id`).
- Sydney sees an owner toggle above the sub-nav. Options: **All**, **My Book**, and each rep by name. The selected owner scope persists across all tabs and re-fetches the active tab on change.

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
- **Total Seats** — sum of the seats deal property across owned deals

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
Single `GET /api/dashboard/summary` call. Returns all of the above in one response. Fast — aggregates deal properties and contact login dates only, no quotes or deep contact fetches.

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
- A row of assigned pro user chips — each chip shows the contact's name and is color-coded by login tier (active = green, inactive = amber, ghost = red). Clicking a chip opens the User Side Panel.

### Data Source
`GET /api/dashboard/renewals?days=30` — fetches deals filtered by `contractEndDate` within the window, then calls HubSpot Quotes API for each deal's associated quotes. Quote amount and deal amount are compared to compute % change.

---

## Tab 3 — Outreach (loads on tab click)

**Purpose:** Identify deals that haven't been touched in too long.

### Controls
Day-range toggle: **30 / 45 / 60 days without contact**. Sorted by longest gap first.

### Deal Rows
Each row shows:
- Company name
- Owner name (visible in Sydney's All/per-rep views)
- Last contacted date (or "Never")
- Days since last contact
- Clicking a row opens the existing Client Health report for that deal (already built at `/client-health`)

### Data Source
`GET /api/dashboard/outreach?days=30` — filters deals where `lastContactedDate` is older than threshold or null.

---

## Tab 4 — Seats (loads on tab click)

**Purpose:** Spot open seat opportunities and identify inactive/ghost users to re-engage.

### Summary Stats Row
- **Total Contracted Seats** — sum of seats property across owned deals
- **Assigned Pro Users** — total contacts flagged as pro users across those deals
- **Open Seats** — contracted minus assigned (engagement opportunity)
- **Inactive Pro Users** — pro users with last login > 30 days

The Active / Inactive / Ghost tiles from the Overview also appear here. When navigated to this tab via a click-through from the Overview, the relevant tier is pre-filtered and a "Clear filter" control is shown.

### Deal List
Expandable rows — each deal shows its contracted seat count and a summary (e.g. "3 active, 1 inactive, 1 open"). Expanding reveals the individual contacts:

Each contact chip shows:
- Name, last login date
- Color-coded tier badge (active / inactive / ghost)
- Clicking opens the User Side Panel

### Data Source
`GET /api/dashboard/seats` — fetches all owned deals with their associated contacts and reads the `hubspot_owner_id`, seats deal property, and last login date from each contact.

---

## User Side Panel

Slides in from the right. The dashboard (and active tab) remains visible behind it. Dismissible via close button or clicking outside.

### Header
Contact name, job title, company name, email address.

### Deal Context
Renewal date, current deal amount, deal stage — so the rep always has the account context visible without navigating away.

### Login Status
Last login date (HubSpot), tier badge (Active / Inactive / Ghost).

### Mixpanel Enrichment (on demand)
A **"Pull Mixpanel"** button. Not called on panel open — only fires when clicked. Fetches 60-day event data (logins, exports, searches, health signals) via the existing `/api/mixpanel/usage` route. Results appear inline below the login status.

### Email Draft Generation
A **"Generate Draft"** button. Calls the existing `/api/minimax/summary` route with:
- Deal context (company, renewal date, amount, stage)
- Contact context (name, title, last login, login tier)
- Mixpanel signals if already pulled

The generated draft streams into a text area in the panel. A **Copy** button copies it to clipboard.

### HubSpot Link
An **"Open in HubSpot"** button that opens the contact's HubSpot record in a new tab (using the contact's HubSpot ID).

---

## New API Routes

| Route | Purpose |
|---|---|
| `GET /api/dashboard/summary` | Pipeline headline stats + seat tier counts |
| `GET /api/dashboard/renewals?days=30\|60\|90` | Renewing deals + HubSpot Quotes data |
| `GET /api/dashboard/outreach?days=30\|45\|60` | Deals not contacted within threshold |
| `GET /api/dashboard/seats` | Per-deal seat counts + contacts with login tiers |

### Reused Routes (no changes needed)
- `POST /api/mixpanel/usage` — on-demand Mixpanel enrichment in side panel
- `POST /api/minimax/summary` — email draft generation in side panel

### HubSpot Library Changes
- Add `fetchDealQuotes(dealId)` to `lib/hubspot.ts` — calls HubSpot Quotes API, returns status, amount, and last modified date for the most recent quote on a deal.

---

## Database Changes

- Add `is_manager BOOLEAN DEFAULT FALSE` column to the `users` table.
- Set `is_manager = true` for Sydney's user record.

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

## What Is Not In Scope

- **Stripe invoice integration** — future milestone. Quote data from HubSpot is the invoicing proxy for now.
- **Real-time updates** — data fetches on tab load/toggle change only. No polling or websockets.
- **Email sending** — the panel generates and copies a draft. Sending happens in HubSpot directly.
- **Mixpanel auto-enrichment** — only fires on explicit "Pull Mixpanel" click, never automatically.
