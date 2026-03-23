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

  const body = `<b>CS Workspace Health Check — ${date}</b>

Company: ${companyName}
Health Tier: ${healthTier}

${aiSummary}

[CS Workspace health check by ${userName}.${ownerNote}]`;

  const noteId = await writeHealthNote(dealId, body, session.user.hubspot_owner_id);
  return NextResponse.json({ noteId });
}
