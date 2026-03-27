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

  try {
    const deals = await fetchDealsForDashboard(ownerId);
    const contactArrays = await Promise.all(
      deals.map(d => fetchContactsForDeal(d.id).catch(() => []))
    );

    const result: DealWithContacts[] = deals.map((deal, i) => ({
      ...deal,
      contacts: enrichContacts(contactArrays[i]),
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error('[dashboard/seats]', e);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 502 });
  }
}
