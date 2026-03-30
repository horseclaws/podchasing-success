import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  fetchDealById, fetchCompanyForDeal, fetchContactsForDeal,
  fetchNotesForDeal, fetchEmailsForDeal, ownerName,
} from '@/lib/hubspot';
import { fetchMixpanelActivity, computeHealthTier } from '@/lib/mixpanel';
import { generateClientSummary } from '@/lib/minimax';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { dealId, companyId: _cid, domain: _domain } = await req.json();
  if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 });

  let deal, company, contacts, notes, emails;
  try {
    [deal, company] = await Promise.all([
      fetchDealById(dealId),
      fetchCompanyForDeal(dealId),
    ]);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    [contacts, notes, emails] = await Promise.all([
      fetchContactsForDeal(deal.id),
      fetchNotesForDeal(deal.id),
      fetchEmailsForDeal(deal.id),
    ]);
  } catch (e) {
    return NextResponse.json({ error: `HubSpot fetch failed: ${(e as Error).message}` }, { status: 502 });
  }

  const healthTier = computeHealthTier(contacts);

  let mixpanel: Awaited<ReturnType<typeof fetchMixpanelActivity>> = [];
  try {
    mixpanel = await fetchMixpanelActivity(contacts.map(c => c.email).filter(Boolean));
  } catch {
    // non-fatal
  }

  const companyName = company?.name ?? deal.properties.dealname;
  const companyId = company?.id ?? null;
  const domain = company?.domain ?? null;

  let aiSummary = '';
  try {
    aiSummary = await generateClientSummary({
      companyName,
      deal: {
        stage: deal.properties.dealstage,
        contractEnd: deal.properties.contract_end_date,
        entitlements: Object.fromEntries(
          ['brand_safety','sponsor_history','transcript_search','tell_me_why','political_skew','list_making','seats','alerts']
            .map(k => [k, deal.properties[k]])
        ),
      },
      healthTier,
      contacts,
      mixpanel,
    });
  } catch {
    aiSummary = 'AI summary unavailable.';
  }

  return NextResponse.json({
    company: { id: companyId, name: companyName, domain },
    deal: {
      id: deal.id,
      name: deal.properties.dealname,
      stage: deal.properties.dealstage,
      pipeline: deal.properties.pipeline,
      owner: deal.properties.hubspot_owner_id,
      ownerName: ownerName(deal.properties.hubspot_owner_id),
      contractStart: deal.properties.contract_start_date ?? null,
      contractEnd: deal.properties.contract_end_date ?? null,
      entitlements: Object.fromEntries(
        ['brand_safety','sponsor_history','transcript_search','tell_me_why','political_skew','list_making','seats','alerts']
          .map(k => [k, deal.properties[k]])
      ),
    },
    contacts,
    notes,
    emails,
    healthTier,
    mixpanel,
    aiSummary,
    dealOwnerWarning: deal.properties.hubspot_owner_id !== session.user.hubspot_owner_id
      ? `This deal is owned by ${ownerName(deal.properties.hubspot_owner_id)}.`
      : null,
  });
}
