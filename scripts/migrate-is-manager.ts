// scripts/migrate-is-manager.ts
import { neon } from '@neondatabase/serverless';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_manager BOOLEAN NOT NULL DEFAULT false`;
  console.log('Added is_manager column');
}

migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
