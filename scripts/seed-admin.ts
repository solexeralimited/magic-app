import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const email = (process.env.ADMIN_EMAIL ?? 'admin@thunderbox.co.nz').toLowerCase();
  const name = 'Admin';
  const password = process.argv[2] ?? 'Thunderbox2024!';

  const { rows } = await pool.query('SELECT id FROM "AdminUser" WHERE email = $1', [email]);
  if (rows.length > 0) {
    console.log(`Admin user already exists: ${email}`);
    await pool.end();
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  await pool.query(
    'INSERT INTO "AdminUser" (id, email, name, password, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, now(), now())',
    [email, name, hashed]
  );
  console.log(`✅ Created admin user`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
