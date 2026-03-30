import { NextRequest, NextResponse } from 'next/server';
import { fetchChartEntries } from '@/lib/podchaser';

export async function POST(req: NextRequest) {
  try {
    const { category, date } = await req.json();
    const entries = await fetchChartEntries(category, date);
    return NextResponse.json(entries);
  } catch (err) {
    console.error('Chart route error:', err);
    return NextResponse.json([], { status: 200 }); // Return empty on error — gap day
  }
}
