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
| `--color-insight-yellow` | `#FFD700` | Reserved — data emphasis in future modules |
| `--color-brand-mint` | `#2BDA9F` | Success states (✓ Loaded, ✓ Saved) |
| `--color-brand-pink` | `#FB0467` | Error states |

All other colors use standard Tailwind utilities (`text-gray-400`, `bg-white`, `border-gray-200`, etc.).

## Components

### New: `PageHeader`

A reusable component replacing the bare `<h1>` on every page.

- Deep-violet (`#2D034F`) left accent bar (4px wide, full height, rounded)
- Bold `text-2xl font-bold` title
- Optional `text-sm text-gray-500` subtitle
- Props: `title: string`, `subtitle?: string`
- Location: `components/ui/PageHeader.tsx`

### Updated: `InsightCard`

Already created. Adopt across all white card panels in the app:
- `HealthReportView` section panels (Mixpanel, Chorus, News, AI Summary, company header)
- `DealResultCard`
- `PodcastProfilePanel`
- `LeaderboardTable` wrapper
- `GuestFinderResults` tier sections

### Updated: `PillBadge`

Already created. Adopt for:
- `HealthTierBadge` — map `Active → green`, `Drifting → yellow`, `At Risk → magenta`
- Any inline status text that currently uses colored `<span>` elements

### Updated: `CalloutBlock`

Already created. Adopt for:
- `AISummary` output (dark bg, magenta left border, "Key Takeaways" label)

### Updated: `Highlight`

Already created. Use for bold magenta keyword emphasis in AI-generated text rendered via `AISummary`.

## Per-Page Changes

### NavTabs
- Color unchanged (`#4A027D`)
- Convert all `style={}` to Tailwind: `bg-brand-purple`, `text-brand-yellow`, etc.

### Client Health (`/client-health`)
- Add `PageHeader` with title "Client Health", subtitle "Search accounts or run a pipeline poll"
- `HealthReportView` company header panel → `InsightCard`
- Mixpanel, Chorus, News, AI Summary section panels → `InsightCard`
- AI Summary content → `CalloutBlock`
- `HealthTierBadge` → `PillBadge` with mapped variants
- All `style={{ color: ... }}` → Tailwind utilities

### Chart History (`/chart-history`)
- Add `PageHeader` with title "Chart History", subtitle "Leaderboard rankings across podcast categories"
- Run button: `bg-blue-600` → `bg-brand-purple`
- Cancel button: `border-gray-300 hover:bg-gray-100` → keep (secondary style is correct)
- Export CSV button: keep secondary style
- `LeaderboardTable` — wrap in `InsightCard`
- All `style={}` → Tailwind utilities

### Guest Finder (`/guest-finder`)
- Add `PageHeader` with title "Guest Finder", subtitle "Find podcast placement opportunities for your clients"
- Export CSV button: keep secondary style
- `GuestFinderResults` tier cards → `InsightCard`
- All `style={}` → Tailwind utilities

### Team (`/team`)
- Add `PageHeader` with title "Team", subtitle "Manage members and access"
- `TeamMemberList`, `AddMemberForm`, `ChangePasswordForm` panels → `InsightCard`
- All `style={}` → Tailwind utilities

### Login
- No changes — login page has intentional full-screen gradient, separate from the app chrome

## Shared Components

### `LoadingSpinner`
- `border-blue-600` → `border-brand-purple`

### `PodcastProfilePanel`
- Adopt `InsightCard` wrapper
- Convert `style={}` to Tailwind utilities

### `ClientSearchBar`, `PollButtons`, `OwnerFilter`
- Convert `style={}` to Tailwind utilities
- Button styles consistent with purple primary pattern

## Inline Style Elimination

All `style={{ color: '#...' }}` and `style={{ backgroundColor: '#...' }}` props replaced with Tailwind utility classes. Where a color doesn't map to a CSS variable, use the closest Tailwind gray/utility.

**Mapping guide:**
| Inline value | Tailwind replacement |
|---|---|
| `color: '#1a1a2e'` | `text-foreground` |
| `color: '#9ca3af'` | `text-gray-400` |
| `color: '#6b7280'` | `text-gray-500` |
| `color: '#4A027D'` | `text-brand-purple` |
| `color: '#FB0467'` | `text-brand-pink` |
| `color: '#2BDA9F'` | `text-brand-mint` |
| `backgroundColor: '#ffffff'` | `bg-white` |
| `backgroundColor: '#F3F0F8'` | `bg-violet-50` |
| `backgroundColor: '#4A027D'` | `bg-brand-purple` |
| `border: '1px solid #ede9f5'` | `border border-violet-100` |

## Spacing & Typography

- All headers: `font-bold` (not `font-semibold`)
- Body text: `text-sm`
- Meta/secondary text: `text-xs text-gray-400`
- Section label caps: `text-xs font-semibold uppercase tracking-wide text-brand-purple`
- Consistent card padding: `p-5` for content panels, `p-4` for compact panels

## Out of Scope

- Layout changes (no column restructuring)
- Data or API changes
- Login page redesign
- New features
- Animation or transition changes
