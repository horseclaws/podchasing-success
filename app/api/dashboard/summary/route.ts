import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchDealsForDashboard, fetchContactsBatch, QUOTE_STALENESS_MS } from '@/lib/hubspot';
import { enforceOwnerAccess, loginTier, type SummaryData } from '@/lib/dashboard';

const CHUNK = 100;

async function batchDealContactIds(dealIds: string[]): Promise<Map<string, string[]>> {
  const chunks: string[][] = [];
  for (let i = 0; i < dealIds.length; i += CHUNK) chunks.push(dealIds.slice(i, i + CHUNK));

  const pages = await Promise.all(
    chunks.map(chunk =>
      fetch('https://api.hubapi.com/crm/v4/associations/deals/contacts/batch/read', {
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
  for (const page of pages) {
    for (const row of (page.results ?? [])) {
      const dealId: string = row.from?.id;
      const ids: string[] = (row.to ?? []).map((t: { toObjectId: number }) => String(t.toObjectId));
      if (dealId) map.set(dealId, ids);
    }
  }
  return map;
}

/** Returns a set of deal IDs that have at least one quote created within QUOTE_STALENESS_MS */
async function dealsWithRecentQuote(dealIds: string[]): Promise<Set<string>> {
  if (dealIds.length === 0) return new Set();

  // Phase 1: batch-fetch deal→quote associations
  const chunks: string[][] = [];
  for (let i = 0; i < dealIds.length; i += CHUNK) chunks.push(dealIds.slice(i, i + CHUNK));

  const assocPages = await Promise.all(
    chunks.map(chunk =>
      fetch('https://api.hubapi.com/crm/v4/associations/deals/quotes/batch/read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: chunk.map(id => ({ id })) }),
      }).then(r => r.ok ? r.json() : { results: [] })
    )
  );

  const dealToQuotes = new Map<string, string[]>(dealIds.map(id => [id, []]));
  for (const page of assocPages) {
    for (const row of (page.results ?? [])) {
      const dealId: string = row.from?.id;
      const qIds: string[] = (row.to ?? []).map((t: { toObjectId: number }) => String(t.toObjectId));
      if (dealId) dealToQuotes.set(dealId, qIds);
    }
  }

  // Phase 2: batch-read hs_createdate for all quote IDs
  const allQuoteIds = [...new Set([...dealToQuotes.values()].flat())];
  if (allQuoteIds.length === 0) return new Set();

  const qChunks: string[][] = [];
  for (let i = 0; i < allQuoteIds.length; i += CHUNK) qChunks.push(allQuoteIds.slice(i, i + CHUNK));

  const qPages = await Promise.all(
    qChunks.map(chunk =>
      fetch('https://api.hubapi.com/crm/v3/objects/quotes/batch/read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: chunk.map(id => ({ id })), properties: ['hs_createdate'] }),
      }).then(r => r.ok ? r.json() : { results: [] })
    )
  );

  const quoteFreshness = new Map<string, boolean>();
  for (const page of qPages) {
    for (const q of (page.results ?? [])) {
      const createDate = q.properties?.hs_createdate ?? '';
      const fresh = createDate ? Date.now() - new Date(createDate).getTime() <= QUOTE_STALENESS_MS : false;
      quoteFreshness.set(String(q.id), fresh);
    }
  }

  // Phase 3: a deal "has a quote" only if at least one associated quote is fresh
  const result = new Set<string>();
  for (const [dealId, qIds] of dealToQuotes) {
    if (qIds.some(qId => quoteFreshness.get(qId) === true)) result.add(dealId);
  }
  return result;
}

function daysUntil(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

  try {
    const deals = await fetchDealsForDashboard(ownerId);
    const dealIds = deals.map(d => d.id);

    // Build upcoming month buckets (current month + 2 ahead)
    const now = new Date();
    const months = [0, 1, 2].map(offset => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return { label: monthLabel(d), year: d.getFullYear(), month: d.getMonth() };
    });

    // Renewal pipeline buckets (deals renewing within N days, today onward)
    const renewalDeals = deals.filter(d => d.contractEndDate && daysUntil(d.contractEndDate) >= 0);
    const d30 = renewalDeals.filter(d => daysUntil(d.contractEndDate!) <= 30);
    const d60 = renewalDeals.filter(d => daysUntil(d.contractEndDate!) <= 60);
    const d90 = renewalDeals.filter(d => daysUntil(d.contractEndDate!) <= 90);

    // Renewals by month — parse date string directly to avoid UTC→local timezone shifts
    const renewalsByMonth = months.map(({ label, year, month }) => {
      const bucket = renewalDeals.filter(d => {
        const [dtYear, dtMonth] = d.contractEndDate!.split('-').map(Number);
        return dtYear === year && dtMonth - 1 === month;
      });
      return {
        label,
        count: bucket.length,
        amount: Math.round(bucket.reduce((s, d) => s + (d.amount ?? 0), 0)),
      };
    });

    // Top 10 accounts by amount
    const topAccounts = [...deals]
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
      .slice(0, 10)
      .map(d => ({ id: d.id, name: d.name, amount: Math.round(d.amount ?? 0), contractEndDate: d.contractEndDate, stage: d.stage }));

    // Batch contact + quote associations in parallel
    const d90DealIds = d90.map(d => d.id);
    const [dealContactIds, dealsWithQuote] = await Promise.all([
      batchDealContactIds(dealIds),
      dealsWithRecentQuote(d90DealIds),
    ]);

    // Quote coverage: how many 90d renewal deals have at least 1 fresh (≤90d) quote
    const quoteCoverage = {
      withQuote: d90DealIds.filter(id => dealsWithQuote.has(id)).length,
      total: d90.length,
    };

    // Batch-fetch pro_user contact properties
    const allContactIds = [...new Set([...dealContactIds.values()].flat())];
    const allContacts = await fetchContactsBatch(allContactIds);

    // Build tier counts
    let activeContacts = 0, inactiveContacts = 0, ghostContacts = 0;
    for (const c of allContacts) {
      const t = loginTier(c.lastLoginDate);
      if (t === 'Active') activeContacts++;
      else if (t === 'Inactive') inactiveContacts++;
      else ghostContacts++;
    }

    const totalSeats = deals.reduce((s, d) => s + d.seats, 0);
    const seatUtilizationPct = totalSeats > 0 ? Math.round((activeContacts / totalSeats) * 100) : 0;

    const byStage: Record<string, number> = {};
    const byBusinessType: Record<string, number> = {};
    for (const deal of deals) {
      byStage[deal.stage] = (byStage[deal.stage] ?? 0) + 1;
      byBusinessType[deal.businessType ?? 'Unknown'] = (byBusinessType[deal.businessType ?? 'Unknown'] ?? 0) + 1;
    }

    const data: SummaryData = {
      totalDeals: deals.length,
      totalContractValue: Math.round(deals.reduce((s, d) => s + (d.amount ?? 0), 0)),
      totalSeats,
      activeContacts,
      inactiveContacts,
      ghostContacts,
      byStage,
      byBusinessType,
      seatUtilizationPct,
      renewalPipeline: {
        d30: { count: d30.length, amount: Math.round(d30.reduce((s, d) => s + (d.amount ?? 0), 0)) },
        d60: { count: d60.length, amount: Math.round(d60.reduce((s, d) => s + (d.amount ?? 0), 0)) },
        d90: { count: d90.length, amount: Math.round(d90.reduce((s, d) => s + (d.amount ?? 0), 0)) },
      },
      quoteCoverage,
      renewalsByMonth,
      topAccounts,
    };

    return NextResponse.json(data);
  } catch (e) {
    console.error('[dashboard/summary]', e);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 502 });
  }
}
