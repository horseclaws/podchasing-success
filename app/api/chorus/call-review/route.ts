import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchCallsByRep } from '@/lib/chorus';
import { generateCallReview } from '@/lib/minimax';

// Chorus + MiniMax can take a while on 20 calls
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limitParam = Number(req.nextUrl.searchParams.get('limit'));
  const limit = [10, 20].includes(limitParam) ? limitParam : 10;

  const email = session.user.email;
  if (!email) return NextResponse.json({ error: 'No email on session' }, { status: 400 });

  try {
    const calls = await fetchCallsByRep(email, limit);
    if (calls.length === 0) {
      return NextResponse.json({ review: null, callCount: 0 });
    }

    const review = await generateCallReview(calls, session.user.name ?? 'the rep');
    return NextResponse.json({ review, callCount: calls.length });
  } catch (e) {
    console.error('[chorus/call-review]', e);
    return NextResponse.json({ error: 'Failed to generate review' }, { status: 502 });
  }
}
