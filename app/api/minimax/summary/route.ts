import { NextRequest, NextResponse } from 'next/server';
import { generateGuestPatternSummary } from '@/lib/minimax';

export async function POST(req: NextRequest) {
  const { podcastName, podcastDescription, episodes } = await req.json();
  const summary = await generateGuestPatternSummary(podcastName, podcastDescription, episodes);
  return NextResponse.json({ summary });
}
