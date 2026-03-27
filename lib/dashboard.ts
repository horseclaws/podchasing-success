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
