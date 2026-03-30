import { NextRequest, NextResponse } from 'next/server';
import { auth, hashPassword, verifyPassword } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`
    SELECT id, name, email, hubspot_owner_id, created_at FROM users ORDER BY created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, email, password, hubspot_owner_id } = await req.json();
  if (!name || !email || !password || !hubspot_owner_id) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  const password_hash = await hashPassword(password);
  try {
    const rows = await sql`
      INSERT INTO users (name, email, password_hash, hubspot_owner_id, must_change_password)
      VALUES (${name}, ${email}, ${password_hash}, ${hubspot_owner_id}, true)
      RETURNING id, name, email, hubspot_owner_id, created_at
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }
    throw error;
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Both current and new password required' }, { status: 400 });
  }

  const rows = await sql`SELECT password_hash FROM users WHERE id = ${session.user.id}`;
  if (rows.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const valid = await verifyPassword(currentPassword, rows[0].password_hash);
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

  const newHash = await hashPassword(newPassword);
  await sql`
    UPDATE users SET password_hash = ${newHash}, must_change_password = false WHERE id = ${session.user.id}
  `;
  return NextResponse.json({ success: true });
}
