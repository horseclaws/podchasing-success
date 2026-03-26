import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pollDeals } from '@/lib/hubspot';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type } = await req.json();
  if (!['renew_30', 'renew_60', 'contacted_45'].includes(type)) {
    return NextResponse.json(
      { error: 'type must be renew_30, renew_60, or contacted_45' },
      { status: 400 }
    );
  }

  try {
    const deals = await pollDeals(type as 'renew_30' | 'renew_60' | 'contacted_45');
    return NextResponse.json({ deals });
  } catch (err) {
    console.error('[poll] pollDeals threw:', err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
