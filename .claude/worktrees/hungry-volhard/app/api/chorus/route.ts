import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchChorusAccount, fetchRecentCallTranscripts, extractChorusInsights } from '@/lib/chorus';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const company = new URL(req.url).searchParams.get('company');
  if (!company) return NextResponse.json({ insights: null }, { status: 200 });

  try {
    const accountId = await searchChorusAccount(company);
    if (!accountId) return NextResponse.json({ insights: null });

    const calls = await fetchRecentCallTranscripts(accountId, 3);
    if (calls.length === 0) return NextResponse.json({ insights: null });

    const transcriptText = calls
      .map((c, i) => `--- Call ${i + 1} (${c.date}) ---\n${c.transcript}`)
      .join('\n\n');
    const latestCallDate = calls[0].date;

    const insights = await extractChorusInsights(transcriptText, calls.length, latestCallDate);
    return NextResponse.json({ insights });
  } catch {
    return NextResponse.json({ insights: null });
  }
}
