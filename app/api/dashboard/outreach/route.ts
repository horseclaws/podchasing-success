import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchOutreachDeals, fetchContactsBatch } from '@/lib/hubspot';
import { enforceOwnerAccess, enrichContacts, type DealWithContacts } from '@/lib/dashboard';

const ASSOC_CHUNK = 100;

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

    // Phase 1: batch-fetch all deal→contact associations
    const dealChunks: typeof deals[] = [];
    for (let i = 0; i < deals.length; i += ASSOC_CHUNK) dealChunks.push(deals.slice(i, i + ASSOC_CHUNK));

    const assocChunkResults = await Promise.all(
      dealChunks.map(chunk =>
        fetch('https://api.hubapi.com/crm/v4/associations/deals/contacts/batch/read', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: chunk.map(d => ({ id: d.id })) }),
        }).then(r => r.ok ? r.json() : { results: [] })
      )
    );

    const dealContactIds = new Map<string, string[]>(deals.map(d => [d.id, []]));
    for (const page of assocChunkResults) {
      for (const row of (page.results ?? [])) {
        const dealId: string = row.from?.id;
        const contactIds: string[] = (row.to ?? []).map((t: { toObjectId: number }) => String(t.toObjectId));
        if (dealId) dealContactIds.set(dealId, contactIds);
      }
    }

    // Phase 2: batch-fetch all contact properties
    const allContactIds = [...new Set([...dealContactIds.values()].flat())];
    const allContacts = await fetchContactsBatch(allContactIds);
    const contactById = new Map(enrichContacts(allContacts).map(c => [c.id, c]));

    const result: DealWithContacts[] = deals.map(deal => ({
      ...deal,
      contacts: (dealContactIds.get(deal.id) ?? []).flatMap(id => {
        const c = contactById.get(id);
        return c ? [c] : [];
      }),
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error('[dashboard/outreach]', e);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 502 });
  }
}
