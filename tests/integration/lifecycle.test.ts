import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';

// Integration tests: run against a real Postgres (DATABASE_URL must point to a
// DISPOSABLE test database — every table is wiped). Skipped when unset.
const DB = process.env.DATABASE_URL;

describe.skipIf(!DB)('run lifecycle (integration)', async () => {
  const { prisma } = await import('@/lib/prisma');
  const { updateJobStatus, promoteToDailyRuns, generateTomorrowRuns, tomorrowRunExists, AlreadyPromotedError } = await import('@/lib/db');

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

    const result = await promoteToDailyRuns(); // used to throw: RunLog_jobId_fkey RESTRICT
    expect(result.status).toBe('promoted');

    expect(await prisma.job.count({ where: { runType: 'Daily' } })).toBe(0);
    expect(await prisma.runLog.count()).toBe(1); // history outlives the job row
  });

  it('promote flips Tomorrow → Daily', async () => {
    const m1 = await masterJob({ jobOrder: 1 });
    const m2 = await masterJob({ jobOrder: 2, customerName: 'Second Site', address: '2 Test St' });
    await copyOf(m1, 'Tomorrow');
    await copyOf(m2, 'Tomorrow', { jobOrder: 2 });

    const promoted = await promoteToDailyRuns();
    expect(promoted.status).toBe('promoted');
    if (promoted.status === 'promoted') expect(promoted.jobs).toHaveLength(2);
    expect(await prisma.job.count({ where: { runType: 'Tomorrow' } })).toBe(0);
    expect(await prisma.job.count({ where: { runType: 'Daily' } })).toBe(2);
    expect(await prisma.job.count({ where: { runType: 'Master' } })).toBe(2); // masters untouched
  });

  it('promote works when Generate and Promote happen the same day (regression)', async () => {
    // generateTomorrowRuns() stamps scheduledDate as tomorrow's date at
    // generate time. Promoting minutes later must not require that date to
    // equal "today" — it used to, and reported 0 jobs promoted every time.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    const master = await masterJob();
    await copyOf(master, 'Tomorrow', { scheduledDate: tomorrowDate });

    const promoted = await promoteToDailyRuns();
    expect(promoted.status).toBe('promoted');
    if (promoted.status === 'promoted') expect(promoted.jobs).toHaveLength(1);
    expect(await prisma.job.count({ where: { runType: 'Daily' } })).toBe(1);
  });

  it('promote leaves a far-future adhoc job in Tomorrow untouched', async () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekDate = nextWeek.toISOString().split('T')[0];

    const dueMaster = await masterJob();
    const dueCopy = await copyOf(dueMaster, 'Tomorrow', { scheduledDate: new Date(Date.now() + 86400000).toISOString().split('T')[0] });
    const futureMaster = await masterJob({ customerName: 'Next Week Adhoc', address: '9 Later St' });
    const futureCopy = await copyOf(futureMaster, 'Tomorrow', { scheduledDate: nextWeekDate });

    const promoted = await promoteToDailyRuns();
    expect(promoted.status).toBe('promoted');
    if (promoted.status === 'promoted') {
      expect(promoted.jobs).toHaveLength(1);
      expect(promoted.jobs[0].id).toBe(dueCopy.id);
    }
    expect(await prisma.job.count({ where: { runType: 'Daily' } })).toBe(1);

    const stillTomorrow = await prisma.job.findUnique({ where: { id: futureCopy.id } });
    expect(stillTomorrow?.runType).toBe('Tomorrow');
  });

  it('promote is a no-op when Tomorrow is empty (regression: used to wipe the live Daily run)', async () => {
    const master = await masterJob();
    await copyOf(master, 'Daily');

    const result = await promoteToDailyRuns();
    expect(result.status).toBe('skipped');
    expect(await prisma.job.count({ where: { runType: 'Daily' } })).toBe(1); // untouched
  });

  it('promote requires confirmation when Daily has unfinished driver work', async () => {
    const existingMaster = await masterJob();
    await copyOf(existingMaster, 'Daily', { status: 'Pending' });

    const newMaster = await masterJob({ customerName: 'New Batch', address: '5 New St' });
    await copyOf(newMaster, 'Tomorrow');

    const result = await promoteToDailyRuns();
    expect(result.status).toBe('requiresConfirm');
    if (result.status === 'requiresConfirm') expect(result.unfinishedCount).toBe(1);
    expect(await prisma.job.count({ where: { runType: 'Daily' } })).toBe(1); // untouched until forced

    const forced = await promoteToDailyRuns(true);
    expect(forced.status).toBe('promoted');
    if (forced.status === 'promoted') expect(forced.jobs).toHaveLength(1);
    expect(await prisma.job.count({ where: { runType: 'Daily' } })).toBe(1);
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

  it('generateTomorrowRuns throws a clean error instead of crashing when already promoted (regression)', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dow = tomorrow.getDay();
    if (dow === 0 || dow === 6) return; // no run generated on weekends, nothing to promote

    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow];
    const due = await masterJob({ day: dayName });
    await copyOf(due, 'Daily'); // simulates: generated, then promoted

    await expect(generateTomorrowRuns()).rejects.toThrow(/already been generated and promoted/);
    await expect(generateTomorrowRuns()).rejects.toBeInstanceOf(AlreadyPromotedError); // lets the route distinguish this from a real failure
    expect(await prisma.job.count({ where: { runType: 'Tomorrow' } })).toBe(0); // nothing deleted or crashed into
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
