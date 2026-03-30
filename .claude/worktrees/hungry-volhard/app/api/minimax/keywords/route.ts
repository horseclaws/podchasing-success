import { NextRequest, NextResponse } from 'next/server';
import { extractKeywords } from '@/lib/minimax';

export async function POST(req: NextRequest) {
  const { description } = await req.json();
  const keywords = await extractKeywords(description);
  return NextResponse.json({ keywords });
}
