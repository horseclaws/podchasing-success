import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchDealsForDashboard, fetchContactsForDeal } from '@/lib/hubspot';
import { enforceOwnerAccess, loginTier, type SummaryData } from '@/lib/dashboard';

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
