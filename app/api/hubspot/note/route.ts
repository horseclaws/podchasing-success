import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeHealthNote, ownerName } from '@/lib/hubspot';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { dealId, dealOwnerId, companyName, aiSummary, healthTier } = await req.json();
  if (!dealId || !aiSummary) return NextResponse.json({ error: 'dealId and aiSummary required' }, { status: 400 });

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const userName = session.user.name;
  const ownerNote = dealOwnerId && dealOwnerId !== session.user.hubspot_owner_id
    ? ` Deal owner: ${ownerName(dealOwnerId)}.`
    : '';

  // HubSpot note bodies require HTML — newlines render as literal whitespace.
  // Convert the AI summary's paragraph breaks to <br> tags, then wrap the
  // whole body in a structure that uses <br> instead of newlines.
  const summaryHtml = aiSummary
    .split(/\n\n+/)
    .map((para: string) => para.replace(/\n/g, '<br>'))
    .join('<br><br>');

  const body = `<b>CS Workspace Health Check — ${date}</b><br><br>Company: ${companyName}<br>Health Tier: ${healthTier}<br><br>${summaryHtml}<br><br><i>CS Workspace health check by ${userName}.${ownerNote}</i>`;

  try {
    const noteId = await writeHealthNote(dealId, body, session.user.hubspot_owner_id);
    return NextResponse.json({ noteId });
  } catch (e) {
    return NextResponse.json({ error: `Failed to save note: ${(e as Error).message}` }, { status: 502 });
  }
}
