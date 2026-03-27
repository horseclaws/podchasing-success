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

  try {
    const deals = await fetchOutreachDeals(days, ownerId);
    return NextResponse.json(deals);
  } catch (e) {
    console.error('[dashboard/outreach]', e);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 502 });
  }
}
