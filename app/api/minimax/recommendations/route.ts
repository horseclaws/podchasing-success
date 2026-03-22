import { NextRequest, NextResponse } from 'next/server';
import { generateRecommendations } from '@/lib/minimax';

export async function POST(req: NextRequest) {
  const { tier, podcasts, clientDescription } = await req.json();
  const cards = await generateRecommendations(tier, podcasts, clientDescription);
  return NextResponse.json(cards);
}
