import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchDeals } from '@/lib/hubspot';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  try {
    const deals = await searchDeals(name);
    return NextResponse.json({ deals });
  } catch (err) {
    console.error('[search] searchDeals threw:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
