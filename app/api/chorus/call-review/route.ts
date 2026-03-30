import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchCallListByRep, fetchCallsByRep, fetchSingleCallById } from '@/lib/chorus';
import type { ChorusCallMeta } from '@/lib/chorus';
import { generateCallReview } from '@/lib/minimax';

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = session.user.email;
  if (!email) return NextResponse.json({ error: 'No email on session' }, { status: 400 });

  const { searchParams } = req.nextUrl;
  const limitParam = Number(searchParams.get('limit'));
  const limit = [10, 20].includes(limitParam) ? limitParam : 10;

  // --- Mode: list only (fast, no transcripts) ---
  if (searchParams.get('mode') === 'list') {
    try {
      const calls = await fetchCallListByRep(email, limit);
      return NextResponse.json({ calls, debug: { emailUsed: email } });
    } catch (e) {
      console.error('[chorus/call-review list]', e);
      return NextResponse.json({ error: 'Failed to load call list', calls: [] }, { status: 502 });
    }
  }

  // --- Mode: single call deep dive ---
  const callId = searchParams.get('callId');
  if (callId) {
    const meta: ChorusCallMeta = {
      id: callId,
      title: searchParams.get('callTitle') ?? 'this call',
      date: searchParams.get('callDate') ?? '',
      durationSecs: 0,
    };
    try {
      const call = await fetchSingleCallById(callId, meta);
      if (!call.transcript) return NextResponse.json({ review: null, callCount: 0, debug: { emailUsed: email } });
      const review = await generateCallReview([call], session.user.name ?? 'the rep');
      return NextResponse.json({ review, callCount: 1, debug: { emailUsed: email } });
    } catch (e) {
      console.error('[chorus/call-review single]', e);
      return NextResponse.json({ error: 'Failed to generate review', debug: { emailUsed: email } }, { status: 502 });
    }
  }

  // --- Mode: review all ---
  try {
    const calls = await fetchCallsByRep(email, limit);
    if (calls.length === 0) {
      return NextResponse.json({ review: null, callCount: 0, debug: { emailUsed: email } });
    }
    const review = await generateCallReview(calls, session.user.name ?? 'the rep');
    return NextResponse.json({ review, callCount: calls.length, debug: { emailUsed: email } });
  } catch (e) {
    console.error('[chorus/call-review]', e);
    return NextResponse.json({ error: 'Failed to generate review', debug: { emailUsed: email } }, { status: 502 });
  }
}
