import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}
const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name             TEXT NOT NULL,
      email            TEXT UNIQUE NOT NULL,
      password_hash    TEXT NOT NULL,
      hubspot_owner_id TEXT NOT NULL,
      must_change_password BOOLEAN NOT NULL DEFAULT true,
      created_at       TIMESTAMPTZ DEFAULT now()
    )
  `;
  console.log('Migration complete');
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
