import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchMixpanelActivity } from '@/lib/mixpanel';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { emails } = await req.json();
  if (!emails?.length) return NextResponse.json({ error: 'emails required' }, { status: 400 });

  const activity = await fetchMixpanelActivity(emails);
  return NextResponse.json(activity);
}
