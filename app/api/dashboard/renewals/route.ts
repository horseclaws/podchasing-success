import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchRenewingDeals, fetchContactsBatch, mapQuoteStatus, QUOTE_STALENESS_MS } from '@/lib/hubspot';
import { enforceOwnerAccess, enrichContacts, type DealWithQuote } from '@/lib/dashboard';

const ASSOC_CHUNK = 100;

async function batchAssoc(objectType: 'contacts' | 'quotes', dealIds: string[]) {
  const chunks: string[][] = [];
  for (let i = 0; i < dealIds.length; i += ASSOC_CHUNK) chunks.push(dealIds.slice(i, i + ASSOC_CHUNK));

  const results = await Promise.all(
    chunks.map(chunk =>
      fetch(`https://api.hubapi.com/crm/v4/associations/deals/${objectType}/batch/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: chunk.map(id => ({ id })) }),
      }).then(r => r.ok ? r.json() : { results: [] })
    )
  );

  const map = new Map<string, string[]>(dealIds.map(id => [id, []]));
  for (const page of results) {
    for (const row of (page.results ?? [])) {
      const dealId: string = row.from?.id;
      const ids: string[] = (row.to ?? []).map((t: { toObjectId: number }) => String(t.toObjectId));
      if (dealId) map.set(dealId, ids);
    }
  }
  return map;
}

async function batchReadQuotes(quoteIds: string[]) {
  if (quoteIds.length === 0) return new Map<string, { properties: Record<string, string> }>();

  const chunks: string[][] = [];
  for (let i = 0; i < quoteIds.length; i += ASSOC_CHUNK) chunks.push(quoteIds.slice(i, i + ASSOC_CHUNK));

  const results = await Promise.all(
    chunks.map(chunk =>
      fetch('https://api.hubapi.com/crm/v3/objects/quotes/batch/read', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: chunk.map(id => ({ id })),
          properties: ['hs_quote_status', 'hs_total', 'hs_lastmodifieddate', 'hs_createdate'],
        }),
      }).then(r => r.ok ? r.json() : { results: [] })
    )
  );

  const map = new Map<string, { properties: Record<string, string> }>();
  for (const page of results) {
    for (const q of (page.results ?? [])) {
      map.set(String(q.id), q);
    }
  }
  return map;
}

function bestQuote(quoteIds: string[], quoteById: Map<string, { properties: Record<string, string> }>) {
  const quotes = quoteIds.flatMap(id => {
    const q = quoteById.get(id);
    return q ? [q] : [];
  });
  if (quotes.length === 0) return null;

  // Sort by createdate — lastmodifieddate can be bumped by the system on old quotes
  const sorted = quotes.sort((a, b) =>
    new Date(b.properties.hs_createdate ?? 0).getTime() -
    new Date(a.properties.hs_createdate ?? 0).getTime()
  );

  const q = sorted[0];
  const mappedStatus = mapQuoteStatus(q.properties.hs_quote_status ?? '');
  // Suppress quotes older than 90 days — no exceptions
  const createDate = q.properties.hs_createdate ?? '';
  if (createDate && Date.now() - new Date(createDate).getTime() > QUOTE_STALENESS_MS) return null;

  return {
    status: mappedStatus,
    amount: q.properties.hs_total != null && q.properties.hs_total !== ''
      ? parseFloat(q.properties.hs_total) : null,
  };
}

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
    const dealIds = deals.map(d => d.id);

    // Batch-fetch associations for contacts and quotes in parallel
    const [dealContactIds, dealQuoteIds] = await Promise.all([
      batchAssoc('contacts', dealIds),
      batchAssoc('quotes', dealIds),
    ]);

    // Batch-fetch contact and quote properties in parallel
    const allContactIds = [...new Set([...dealContactIds.values()].flat())];
    const allQuoteIds = [...new Set([...dealQuoteIds.values()].flat())];
    const [allContacts, quoteById] = await Promise.all([
      fetchContactsBatch(allContactIds),
      batchReadQuotes(allQuoteIds),
    ]);

    const contactById = new Map(enrichContacts(allContacts).map(c => [c.id, c]));

    const result: DealWithQuote[] = deals.map(deal => {
      const contacts = (dealContactIds.get(deal.id) ?? []).flatMap(id => {
        const c = contactById.get(id);
        return c ? [c] : [];
      });

      const q = bestQuote(dealQuoteIds.get(deal.id) ?? [], quoteById);
      const daysUntilRenewal = deal.contractEndDate
        ? Math.round((new Date(deal.contractEndDate).getTime() - Date.now()) / 86_400_000)
        : 0;

      const quote = q ? {
        status: q.status,
        amount: q.amount,
        percentChange: (deal.amount != null && deal.amount !== 0 && q.amount != null)
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
