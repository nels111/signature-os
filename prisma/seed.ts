import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  const nelsonPassword = await bcrypt.hash('admin123', 12);
  const nickPassword = await bcrypt.hash('sales123', 12);

  await pool.query(`
    INSERT INTO users (id, name, email, password, role, "ionosEmail", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'Nelson Iseguan', 'nelson@signature-cleans.co.uk', $1, 'admin', 'nelson@signature-cleans.co.uk', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
  `, [nelsonPassword]);

  await pool.query(`
    INSERT INTO users (id, name, email, password, role, "ionosEmail", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'Nick Stentiford', 'nick@signature-cleans.co.uk', $1, 'sales', 'nick@signature-cleans.co.uk', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
  `, [nickPassword]);

  const result = await pool.query('SELECT id, name, email, role FROM users');
  console.log('Seeded users:', result.rows);
  
  await pool.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
