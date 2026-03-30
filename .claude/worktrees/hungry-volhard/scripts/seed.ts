import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const sql = neon(process.env.DATABASE_URL);

const TEMP_PASSWORD = 'podchaser2026';

const users = [
  { name: 'Jon Dispenza', email: 'jon@podchaser.com', hubspot_owner_id: '1774818015' },
  { name: 'Jules Thill', email: 'jules@podchaser.com', hubspot_owner_id: '184892201' },
  { name: 'Sydney Stern', email: 'sydney@podchaser.com', hubspot_owner_id: '157100429' },
];

async function seed() {
  const hash = await bcrypt.hash(TEMP_PASSWORD, 12);
  for (const u of users) {
    await sql`
      INSERT INTO users (name, email, password_hash, hubspot_owner_id, must_change_password)
      VALUES (${u.name}, ${u.email}, ${hash}, ${u.hubspot_owner_id}, true)
      ON CONFLICT (email) DO NOTHING
    `;
    console.log(`Seeded: ${u.email}`);
  }
  console.log('Seed complete');
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
