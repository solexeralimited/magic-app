import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as never);

interface SeedJob {
  driver: string;
  jobOrder: number;
  day: string;
  jobType: string;
  customerName: string;
  address: string;
  phone: string;
  items: string;
  notes: string;
  frequency: string;
  nextServiceDate: string;
  mapLink: string;
  callAhead: boolean;
}

async function main() {
  // ── Drivers ──────────────────────────────────────────────────────────────────
  const driverNames = ['TK', 'PJ', 'George', 'Karl', 'Dom', 'Yard Run', 'Jimmy', 'Dean/Dylan'];
  for (const name of driverNames) {
    await prisma.driver.upsert({ where: { name }, create: { name }, update: {} });
  }
  console.log(`✅ Seeded ${driverNames.length} drivers`);

  // ── Jobs ─────────────────────────────────────────────────────────────────────
  const dataPath = path.join('/tmp', 'seed_data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('❌ /tmp/seed_data.json not found.');
    process.exit(1);
  }

  const jobs: SeedJob[] = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  await prisma.job.deleteMany({ where: { runType: 'Master' } });

  // Bulk insert in chunks of 100
  const CHUNK = 100;
  let count = 0;
  for (let i = 0; i < jobs.length; i += CHUNK) {
    const chunk = jobs.slice(i, i + CHUNK);
    await prisma.job.createMany({
      data: chunk.map(j => ({
        driverName: j.driver,
        jobOrder: j.jobOrder,
        day: j.day,
        jobType: j.jobType,
        customerName: j.customerName,
        address: j.address,
        phone: j.phone,
        items: j.items,
        notes: j.notes,
        frequency: j.frequency,
        nextServiceDate: j.nextServiceDate,
        mapLink: j.mapLink,
        callAhead: j.callAhead,
        status: 'Pending',
        runType: 'Master',
      })),
      skipDuplicates: true,
    });
    count += chunk.length;
    process.stdout.write(`\r  Inserted ${count}/${jobs.length} jobs...`);
  }

  console.log(`\n✅ Seeded ${count} jobs from Excel`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
