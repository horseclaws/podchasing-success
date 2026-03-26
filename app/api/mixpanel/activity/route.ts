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
