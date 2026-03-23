import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchCompanies } from '@/lib/hubspot';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const results = await searchCompanies(name);
  return NextResponse.json(
    results.map(r => ({ id: r.id, name: r.properties.name, domain: r.properties.domain }))
  );
}
