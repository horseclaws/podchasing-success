import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchCompanyNews, annotateNewsRelevance } from '@/lib/serper';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const company = new URL(req.url).searchParams.get('company');
  if (!company) return NextResponse.json({ articles: null });

  try {
    const raw = await fetchCompanyNews(company, 5);
    if (raw.length === 0) return NextResponse.json({ articles: null });

    const articles = await annotateNewsRelevance(raw, company);
    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json({ articles: null });
  }
}
