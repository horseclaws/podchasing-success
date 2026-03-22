import { NextRequest, NextResponse } from 'next/server';
import { searchPodcasts } from '@/lib/podchaser';

export async function POST(req: NextRequest) {
  const { term } = await req.json();
  const results = await searchPodcasts(term);
  return NextResponse.json(results);
}
