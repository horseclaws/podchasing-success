import { NextRequest, NextResponse } from 'next/server';
import { fetchPodcastProfile } from '@/lib/podchaser';

export async function POST(req: NextRequest) {
  const { podcastId } = await req.json();
  const profile = await fetchPodcastProfile(podcastId);
  return NextResponse.json(profile);
}
