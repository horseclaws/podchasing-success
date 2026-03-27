import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateEmailDraft } from '@/lib/minimax';
import type { EmailDraftContext } from '@/lib/dashboard';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: EmailDraftContext;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.type || !body.deal || !body.contact) {
    return NextResponse.json({ error: 'type, deal, and contact are required' }, { status: 400 });
  }

  const draft = await generateEmailDraft(body);
  return NextResponse.json({ draft });
}
