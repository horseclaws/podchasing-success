import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchDealById, fetchCompanyForDeal, fetchContactsForDeal } from '@/lib/hubspot';
import { fetchMixpanelActivity, computeHealthTier } from '@/lib/mixpanel';
import { fetchCompanyNews, annotateNewsRelevance } from '@/lib/serper';
import { generateClientSummary } from '@/lib/minimax';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { dealId, sources } = await req.json() as {
    dealId: string;
    sources: { mixpanel: boolean; chorus: boolean; news: boolean };
  };
  if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 });

  // Always fetch HubSpot base data
  let deal, company, contacts;
  try {
    [deal, company] = await Promise.all([
      fetchDealById(dealId),
      fetchCompanyForDeal(dealId),
    ]);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    contacts = await fetchContactsForDeal(deal.id);
  } catch (e) {
    return NextResponse.json({ error: `HubSpot fetch failed: ${(e as Error).message}` }, { status: 502 });
  }

  const companyName = company?.name ?? deal.properties.dealname;
  const emails = contacts.map(c => c.email).filter(Boolean);

  // Optional: Mixpanel (does NOT increment the usage counter — this is a summary generation call)
  let mixpanelData: { activity: Awaited<ReturnType<typeof fetchMixpanelActivity>>; healthTier: 'Active' | 'Drifting' | 'At Risk' } | null = null;
  if (sources.mixpanel) {
    try {
      const activity = await fetchMixpanelActivity(emails, contacts);
      mixpanelData = { activity, healthTier: computeHealthTier(activity) };
    } catch {
      // non-fatal — summary proceeds without Mixpanel data
    }
  }

  // Optional: News
  if (sources.news) {
    try {
      const rawArticles = await fetchCompanyNews(companyName, 5);
      await annotateNewsRelevance(rawArticles, companyName);
    } catch {
      // non-fatal
    }
  }

  let summary: string;
  try {
    summary = await generateClientSummary({
      companyName,
      deal: {
        stage: deal.properties.dealstage,
        contractEnd: deal.properties.contract_end_date ?? null,
        entitlements: Object.fromEntries(
          ['brand_safety','sponsor_history','transcript_search','tell_me_why',
           'political_skew','list_making','seats','alerts']
            .map(k => [k, deal.properties[k]])
        ),
      },
      contacts,
      healthTier: mixpanelData?.healthTier ?? null,
      mixpanel: mixpanelData?.activity,
      includesChorus: sources.chorus,
    });
  } catch (e) {
    return NextResponse.json({ error: `Summary generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  return NextResponse.json({ summary });
}
