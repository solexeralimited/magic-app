import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';

// Integration tests: run against a real Postgres (DATABASE_URL must point to a
// DISPOSABLE test database — every table is wiped). Skipped when unset.
const DB = process.env.DATABASE_URL;

describe.skipIf(!DB)('run lifecycle (integration)', async () => {
  const { prisma } = await import('@/lib/prisma');
  const { updateJobStatus, promoteToDailyRuns, generateTomorrowRuns, tomorrowRunExists } = await import('@/lib/db');

  const wipe = async () => {
    await prisma.runLog.deleteMany({});
    await prisma.job.deleteMany({});
  };

  beforeAll(async () => {
    await wipe();
    await prisma.driver.upsert({
      where: { name: 'Test Driver' },
      create: { name: 'Test Driver', isActive: true },
      update: { isActive: true },
    });
  });

  beforeEach(wipe);

  afterAll(async () => {
    await wipe();
    await prisma.$disconnect();
  });

  const masterJob = (over: Record<string, unknown> = {}) =>
    prisma.job.create({
      data: {
        driverName: 'Test Driver', jobOrder: 1, day: 'Monday', jobType: 'Service',
        customerName: 'Integration Test Co', address: '1 Test St',
        status: 'Pending', runType: 'Master',
        ...over,
      },
    });

  const copyOf = (master: { id: string }, runType: 'Tomorrow' | 'Daily', over: Record<string, unknown> = {}) =>
    prisma.job.create({
      data: {
        id: `tmr-${master.id}`,
        driverName: 'Test Driver', jobOrder: 1, day: 'Monday', jobType: 'Service',
        customerName: 'Integration Test Co', address: '1 Test St',
        status: 'Pending', runType,
        ...over,
      },
    });

  it('completing a fortnightly daily job advances the MASTER next-service date', async () => {
    const master = await masterJob({ frequency: 'Fortnightly', nextServiceDate: '2026-07-27' });
    await copyOf(master, 'Daily', { frequency: 'Fortnightly', nextServiceDate: '2026-07-27' });

    const updated = await updateJobStatus(`tmr-${master.id}`, 'Done');
    expect(updated?.status).toBe('Done');
    expect(updated?.nextServiceDate).toBe('2026-08-10'); // +14 days on the copy

    const freshMaster = await prisma.job.findUnique({ where: { id: master.id } });
    expect(freshMaster?.nextServiceDate).toBe('2026-08-10'); // and on the master (regression: it used to stay put)

    const log = await prisma.runLog.findUnique({ where: { jobId: `tmr-${master.id}` } });
    expect(log?.status).toBe('Done');
  });

  it('NotRequired is recorded in history but does NOT advance the schedule', async () => {
    const master = await masterJob({ frequency: 'Fortnightly', nextServiceDate: '2026-07-27' });
    await copyOf(master, 'Daily', { frequency: 'Fortnightly', nextServiceDate: '2026-07-27' });

    const updated = await updateJobStatus(`tmr-${master.id}`, 'NotRequired');
    expect(updated?.status).toBe('NotRequired');
    expect(updated?.nextServiceDate).toBe('2026-07-27'); // unchanged

    const log = await prisma.runLog.findUnique({ where: { jobId: `tmr-${master.id}` } });
    expect(log?.status).toBe('NotRequired');
  });

  it('Issue status keeps issue notes and creates no history entry', async () => {
    const master = await masterJob();
    await copyOf(master, 'Daily');

    const updated = await updateJobStatus(`tmr-${master.id}`, 'Issue', 'Unit blocked by scaffolding');
    expect(updated?.status).toBe('Issue');
    expect(updated?.issueNotes).toBe('Unit blocked by scaffolding');
    expect(await prisma.runLog.findUnique({ where: { jobId: `tmr-${master.id}` } })).toBeNull();
  });

  it('promote clears completed daily jobs WITHOUT a foreign-key error, history survives (regression)', async () => {
    const master = await masterJob();
    await copyOf(master, 'Daily');
    await updateJobStatus(`tmr-${master.id}`, 'Done'); // creates a RunLog row pointing at the daily job

    await expect(promoteToDailyRuns()).resolves.toBeDefined(); // used to throw: RunLog_jobId_fkey RESTRICT

    expect(await prisma.job.count({ where: { runType: 'Daily' } })).toBe(0);
    expect(await prisma.runLog.count()).toBe(1); // history outlives the job row
  });

  it('promote flips Tomorrow → Daily', async () => {
    const m1 = await masterJob({ jobOrder: 1 });
    const m2 = await masterJob({ jobOrder: 2, customerName: 'Second Site', address: '2 Test St' });
    await copyOf(m1, 'Tomorrow');
    await copyOf(m2, 'Tomorrow', { jobOrder: 2 });

    const promoted = await promoteToDailyRuns();
    expect(promoted).toHaveLength(2);
    expect(await prisma.job.count({ where: { runType: 'Tomorrow' } })).toBe(0);
    expect(await prisma.job.count({ where: { runType: 'Daily' } })).toBe(2);
    expect(await prisma.job.count({ where: { runType: 'Master' } })).toBe(2); // masters untouched
  });

  it('tomorrowRunExists powers the generate guard', async () => {
    expect(await tomorrowRunExists()).toBe(0);
    const master = await masterJob();
    await copyOf(master, 'Tomorrow');
    expect(await tomorrowRunExists()).toBe(1);
  });

  it('generateTomorrowRuns copies due jobs for tomorrow (or refuses on weekends)', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dow = tomorrow.getDay();

    if (dow === 0 || dow === 6) {
      await expect(generateTomorrowRuns()).rejects.toThrow(/weekend/);
      return;
    }

    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow];
    const due = await masterJob({ day: dayName });
    await masterJob({ day: dayName, customerName: 'Not Due Yet', address: '3 Test St', frequency: 'Fortnightly', nextServiceDate: '2099-01-01' });

    const generated = await generateTomorrowRuns();
    expect(generated).toHaveLength(1); // the fortnightly job with a future date is skipped
    const copy = await prisma.job.findUnique({ where: { id: `tmr-${due.id}` } });
    expect(copy?.runType).toBe('Tomorrow');
    expect(copy?.status).toBe('Pending');
  });

  it('data reset order: history first, then jobs (what the Danger Zone does)', async () => {
    const master = await masterJob();
    await copyOf(master, 'Daily');
    await updateJobStatus(`tmr-${master.id}`, 'Done');

    await prisma.runLog.deleteMany({});
    await prisma.job.deleteMany({});

    expect(await prisma.job.count()).toBe(0);
    expect(await prisma.runLog.count()).toBe(0);
    expect(await prisma.driver.count({ where: { name: 'Test Driver' } })).toBe(1); // drivers kept
  });
});
