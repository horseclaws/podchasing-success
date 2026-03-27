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

  try {
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
  } catch (e) {
    console.error('[dashboard/renewals]', e);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 502 });
  }
}
