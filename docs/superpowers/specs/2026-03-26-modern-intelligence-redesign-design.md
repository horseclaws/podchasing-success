# Modern Intelligence — Full System Redesign

**Date:** 2026-03-26
**Status:** Approved

## Overview

Apply the "Modern Intelligence" design system consistently across the entire app. This is a full-system pass: color tokens, component library adoption, inline style elimination, and off-brand color fixes. No new features — purely visual consistency.

## Color Token Roles

| CSS Variable | Hex | Role |
|---|---|---|
| `--color-deep-violet` | `#2D034F` | Page header accent bars |
| `--color-brand-purple` | `#4A027D` | Nav bar, all primary buttons, section labels |
| `--color-brand-magenta` | `#FF007A` | `CalloutBlock` left borders, `Highlight` keyword text |
| `--color-brand-yellow` | `#FFEF70` | Active nav tab highlight (existing, keep as-is) |
| `--color-insight-yellow` | `#FFD700` | Reserved — data emphasis in future modules |
| `--color-brand-mint` | `#2BDA9F` | Success states (✓ Loaded, ✓ Saved) |
| `--color-brand-pink` | `#FB0467` | Error states |
| `--color-brand-cyan` | `#0DAAC9` | Permitted for brand-cyan accents (Chorus, RecentNews links) |

**Note on yellows:** `--color-brand-yellow` (`#FFEF70`) is the canonical active-tab yellow. `--color-insight-yellow` (`#FFD700`) is reserved for future data visualization use only.

## Components

### New: `PageHeader`

A reusable component replacing the bare `<h1>` on every page.

- Deep-violet (`#2D034F`) left accent bar: `w-1 rounded self-stretch bg-deep-violet` (4px wide, full height)
- Bold `text-2xl font-bold text-foreground` title
- Optional `text-sm text-gray-500` subtitle
- Props: `title: string`, `subtitle?: string`
- Location: `components/ui/PageHeader.tsx`
- Creating `PageHeader.tsx` includes adding it to `components/ui/index.ts` as part of the same task

### Updated: `InsightCard`

Already created. Adopt across all white card panels in the app (see per-page details below). Pattern: `bg-white rounded-2xl border border-violet-100 p-5`.

### Updated: `PillBadge`

Already created. Adopt for `HealthTierBadge`. Variant mapping:
- `Active` → `green` variant
- `Drifting` → `yellow` variant
- `At Risk` → `magenta` variant (uses standard Tailwind `bg-pink-100 text-pink-700` — intentional approximation, not exact brand-magenta fill)

### Updated: `CalloutBlock`

Already created. Adopt for `AISummary` output (dark bg, magenta left border).

### Updated: `Highlight`

Already created. Use for bold magenta keyword emphasis in AI-generated text.

### Dormant (no current usage): `HeroSummary`, `DataDetail`, `StatGrid`

These components are built and exported but not used in this redesign pass. They are reserved for the Client Success Dashboard feature. Do not add them to any existing page.

## Per-Page Changes

### NavTabs
- Color unchanged (`#4A027D`)
- Convert `style={}` to Tailwind: `bg-brand-purple`, `text-brand-yellow` (active), `text-white/60` (inactive)
- Active tab background: `bg-white/10` (Tailwind v4 opacity modifier for `rgba(255,255,255,0.1)`)
- Inactive tab background: `bg-transparent`

### Client Health (`/client-health`)
- Add `PageHeader title="Client Health" subtitle="Search accounts or run a pipeline poll"`
- `HealthReportView` company header panel → `InsightCard`
- `FeatureEntitlements` wrapper → `InsightCard`; inline dot colors: `enabled ? 'bg-brand-mint' : 'bg-gray-200'` (`#e5e7eb` = `gray-200`); all other `style={}` → Tailwind
- `UserActivityTable` wrapper → `InsightCard`; amber warning `#d97706` → `text-amber-600`; all `style={}` → Tailwind
- `ResultsDashboard` summary tile cards → `InsightCard` per tile; `BAR_COLORS` drives inline `style={{ backgroundColor }}` on plain `<div>` progress bars — these are not a chart library, so apply the inline style mapping table: `#4A027D` → `bg-brand-purple`, `#0DAAC9` → `bg-brand-cyan`, `#2BDA9F` → `bg-brand-mint`, `#FB0467` → `bg-brand-pink`
- Mixpanel, Chorus, News section panels → `InsightCard`
- AI Summary content → `CalloutBlock` with `title="Key Takeaways"`
- `HealthTierBadge` → `PillBadge` with mapped variants
- `ChorusInsights` `#0DAAC9` labels → `text-brand-cyan` (permitted, see color token table)
- All remaining `style={}` → Tailwind utilities

### Chart History (`/chart-history`)
- Add `PageHeader title="Chart History" subtitle="Leaderboard rankings across podcast categories"`
- Run button: `bg-blue-600 hover:bg-blue-700` → `bg-brand-purple hover:opacity-90`
- Cancel and Export CSV buttons: keep existing secondary style (`border border-gray-300 hover:bg-gray-100`)
- `LeaderboardTable` → wrap in `InsightCard`
- All `style={}` → Tailwind utilities

### Guest Finder (`/guest-finder`)
- Add `PageHeader title="Guest Finder" subtitle="Find podcast placement opportunities for your clients"`
- `ClientDescriptionForm` primary button: `bg-blue-600 hover:bg-blue-700` → `bg-brand-purple hover:opacity-90`; `focus:ring-blue-500` → `focus:ring-brand-purple`
- Export CSV button: keep secondary style
- `GuestFinderResults` tier section wrappers → `InsightCard`
- All `style={}` → Tailwind utilities

### Team (`/team`)
- Add `PageHeader title="Team" subtitle="Manage members and access"`
- `TeamMemberList`, `AddMemberForm`, `ChangePasswordForm` panels → `InsightCard`
- All `style={}` → Tailwind utilities

### Login
- **Entirely excluded.** `app/login/` and `components/LoginForm.tsx` are intentional one-off designs and must not be changed.

## Shared Components

### `LoadingSpinner`
- `border-blue-600 border-t-transparent` → `border-brand-purple border-t-transparent`

### `PodcastProfilePanel`
- Adopt `InsightCard` wrapper
- Convert `style={}` to Tailwind utilities

### `ClientSearchBar`, `PollButtons`, `OwnerFilter`
- Convert `style={}` to Tailwind utilities
- Button styles: primary → `bg-brand-purple text-white`; secondary/outline → `border border-gray-200 text-gray-600 hover:bg-gray-50`

## Inline Style Elimination

Replace all `style={{ color: '...' }}` and `style={{ backgroundColor: '...' }}` props with Tailwind utility classes.

**Complete mapping guide:**

| Inline value | Tailwind replacement |
|---|---|
| `color: '#1a1a2e'` | `text-foreground` |
| `color: '#9ca3af'` | `text-gray-400` |
| `color: '#6b7280'` | `text-gray-500` |
| `color: '#374151'` | `text-gray-700` |
| `color: '#4A027D'` | `text-brand-purple` |
| `color: '#FB0467'` | `text-brand-pink` |
| `color: '#2BDA9F'` | `text-brand-mint` |
| `color: '#0DAAC9'` | `text-brand-cyan` |
| `color: '#d97706'` | `text-amber-600` |
| `backgroundColor: '#ffffff'` | `bg-white` |
| `backgroundColor: '#F9F7FC'` | `bg-background` |
| `backgroundColor: '#F3F0F8'` | `bg-violet-50` (intentional approximation — Tailwind default `#f5f3ff` is close enough) |
| `backgroundColor: '#4A027D'` | `bg-brand-purple` |
| `border: '1px solid #ede9f5'` | `border border-violet-100` |
| `rgba(255,255,255,0.1)` bg | `bg-white/10` |
| `rgba(255,255,255,0.6)` text | `text-white/60` |
| `rgba(255,255,255,0.85)` text | `text-white/85` |
| `fontSize: '10px'` | `text-[10px]` |
| `boxShadow: '0 2px 8px rgba(74,2,125,0.05)'` | drop entirely — `InsightCard` border provides sufficient separation |
| `boxShadow: '0 2px 12px rgba(74,2,125,0.08)'` | drop entirely — same rationale |
| `boxShadow: '0 2px 12px rgba(74,2,125,0.06)'` | drop entirely — same rationale |
| `backgroundColor: '#e5e7eb'` | `bg-gray-200` |
| `onMouseEnter/Leave` hover border JS | `hover:border-brand-purple transition-colors` Tailwind classes |

## Spacing & Typography

- All page titles: `text-2xl font-bold` (via `PageHeader`)
- Section label caps: `text-xs font-semibold uppercase tracking-wide text-brand-purple`
- Body text: `text-sm`
- Meta/secondary text: `text-xs text-gray-400`
- Consistent card padding: `p-5` for content panels, `p-4` for compact panels

## Out of Scope

- Layout changes (no column restructuring)
- Data or API changes
- Login page and `LoginForm.tsx`
- `HeroSummary`, `DataDetail`, `StatGrid` adoption (reserved for Client Success Dashboard)
- Animation or transition changes beyond hover states already present
