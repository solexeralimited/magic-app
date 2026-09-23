import { prisma } from './prisma';
import { isJobDueForDate } from './utils';
import { Job, Driver, RunLogEntry, AdminMessage, NotificationLog, PushSubscriptionData } from '@/types';

export { isJobDueForDate };

// ─── Type mapping helpers ────────────────────────────────────────────────────

type PrismaJob = Awaited<ReturnType<typeof prisma.job.findFirst>>;

function toJob(p: NonNullable<PrismaJob>): Job {
  return {
    id: p.id,
    driverName: p.driverName,
    jobOrder: p.jobOrder,
    day: p.day,
    jobType: p.jobType,
    customerName: p.customerName,
    address: p.address,
    phone: p.phone,
    items: p.items,
    quantity: p.quantity ?? '',
    notes: p.notes,
    frequency: p.frequency as Job['frequency'],
    nextServiceDate: p.nextServiceDate,
    mapLink: p.mapLink,
    callAhead: p.callAhead,
    status: p.status as Job['status'],
    completionTime: p.completionTime?.toISOString(),
    issueNotes: p.issueNotes ?? undefined,
    sheetRowId: p.sheetRowId || undefined,
    notificationSentFlags: {
      driverNewRun: p.notifDriverNewRun,
      driverRunUpdated: p.notifDriverUpdated,
      adminIssue: p.notifAdminIssue,
      adminCantAccess: p.notifAdminCantAccess,
      customerCallAhead: p.notifCustomerCallAhead,
    },
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// ─── Drivers ─────────────────────────────────────────────────────────────────

export async function getDrivers(): Promise<Driver[]> {
  const rows = await prisma.driver.findMany({ orderBy: { name: 'asc' } });
  return rows.map(r => ({ id: r.id, name: r.name, email: r.email ?? undefined, phone: r.phone ?? undefined }));
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export async function getAllJobs(): Promise<Job[]> {
  const rows = await prisma.job.findMany({ orderBy: [{ driverName: 'asc' }, { jobOrder: 'asc' }] });
  return rows.map(toJob);
}

export async function getDailyRunJobs(driverName: string): Promise<Job[]> {
  const rows = await prisma.job.findMany({
    where: { driverName, runType: 'Daily' },
    orderBy: { jobOrder: 'asc' },
  });
  return rows.map(toJob);
}

export async function getTomorrowRunJobs(driverName: string): Promise<Job[]> {
  const rows = await prisma.job.findMany({
    where: { driverName, runType: 'Tomorrow' },
    orderBy: { jobOrder: 'asc' },
  });
  return rows.map(toJob);
}

export async function updateJobStatus(
  jobId: string,
  status: Job['status'],
  issueNotes?: string
): Promise<Job | null> {
  const existing = await prisma.job.findUnique({ where: { id: jobId } });
  if (!existing) return null;

  const now = new Date();
  let nextServiceDate = existing.nextServiceDate;

  if (status === 'Done') {
    const base = existing.nextServiceDate ? new Date(existing.nextServiceDate) : now;
    switch (existing.frequency) {
      case 'Fortnightly': base.setDate(base.getDate() + 14); break;
      case '3 Weekly':    base.setDate(base.getDate() + 21); break;
      case '4 Weekly':    base.setDate(base.getDate() + 28); break;
      default:            base.setDate(base.getDate() + 7);  break;
    }
    nextServiceDate = base.toISOString().split('T')[0];
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: {
      status,
      issueNotes: issueNotes ?? existing.issueNotes,
      completionTime: status === 'Done' ? now : existing.completionTime,
      nextServiceDate,
    },
  });

  // Daily/Tomorrow jobs are copies (id "tmr-<masterId>"); the recurrence schedule
  // lives on the master, so the advanced date must land there too or the job
  // will regenerate every week regardless of frequency.
  if (status === 'Done' && existing.runType !== 'Master' && existing.id.startsWith('tmr-')) {
    await prisma.job.updateMany({
      where: { id: existing.id.slice(4), runType: 'Master' },
      data: { nextServiceDate },
    });
  }

  if (status === 'Done' || status === 'NotRequired') {
    await prisma.runLog.upsert({
      where: { jobId },
      create: {
        jobId,
        driverName: updated.driverName,
        customerName: updated.customerName,
        address: updated.address,
        jobType: updated.jobType,
        completionTime: now,
        status,
        issueNotes: updated.issueNotes,
        day: updated.day,
      },
      update: { completionTime: now, status },
    });
  }

  return toJob(updated);
}

// ─── Run generation ───────────────────────────────────────────────────────────

function tomorrowDateString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

// Jobs from before `scheduledDate` existed have it empty — treat that as
// "belongs to the one active generated run" so old rows keep working.
function forRunDate(scheduledDate: string) {
  return { OR: [{ scheduledDate }, { scheduledDate: '' }] };
}

export async function tomorrowRunExists(): Promise<number> {
  return prisma.job.count({ where: { runType: 'Tomorrow', ...forRunDate(tomorrowDateString()) } });
}

// Undoes a Generate click: clears only tomorrow's own generated batch (and
// any dispatch edits made to it since), leaving adhoc jobs booked further
// out — still runType 'Tomorrow' but a later scheduledDate — untouched.
export async function resetTomorrowRun(): Promise<number> {
  const { count } = await prisma.job.deleteMany({
    where: { runType: 'Tomorrow', ...forRunDate(tomorrowDateString()) },
  });
  return count;
}

// Distinguishes "nothing to do, this batch is already live" from a genuine
// failure — callers use this to show a warning instead of an error.
export class AlreadyPromotedError extends Error {}

export async function generateTomorrowRuns(): Promise<Job[]> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayOfWeek = tomorrow.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new Error('Tomorrow is a weekend — no runs generated.');
  }

  const scheduledDate = tomorrow.toISOString().split('T')[0];
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOfWeek];
  const all = await getAllJobs();
  const due = all.filter(j => j.day === dayName && isJobDueForDate(j, tomorrow));

  if (due.length > 0) {
    // These ids are deterministic (tmr-<masterId>), so if this exact batch was
    // already generated and promoted, they now exist as Daily rows under the
    // same id — createMany would crash on the primary-key collision. Recognize
    // that state and say so, instead of reaching into an already-live run.
    const alreadyPromoted = await prisma.job.count({
      where: { id: { in: due.map(j => `tmr-${j.id}`) }, runType: 'Daily' },
    });
    if (alreadyPromoted > 0) {
      throw new AlreadyPromotedError(`Tomorrow's run has already been generated and promoted — ${alreadyPromoted} job(s) are live as today's Daily run. Nothing to regenerate until tomorrow.`);
    }
  }

  // Clear only tomorrow's previously generated run — adhoc jobs dispatched to
  // a different future date are left alone so regenerating doesn't wipe them.
  await prisma.job.deleteMany({ where: { runType: 'Tomorrow', ...forRunDate(scheduledDate) } });
  if (due.length > 0) {
    await prisma.job.createMany({
      data: due.map(j => ({
        id: `tmr-${j.id}`,
        driverName: j.driverName,
        jobOrder: j.jobOrder,
        day: j.day,
        jobType: j.jobType,
        customerName: j.customerName,
        address: j.address,
        phone: j.phone,
        items: j.items,
        quantity: j.quantity,
        notes: j.notes,
        frequency: j.frequency,
        nextServiceDate: j.nextServiceDate,
        mapLink: j.mapLink,
        callAhead: j.callAhead,
        status: 'Pending',
        runType: 'Tomorrow',
        scheduledDate,
        sheetRowId: j.sheetRowId ?? '',
      })),
    });
  }

  return due;
}

export type PromoteResult =
  | { status: 'skipped' }
  | { status: 'requiresConfirm'; unfinishedCount: number }
  | { status: 'promoted'; jobs: Job[] };

// `force` skips the "drivers still have unfinished work" guard below. It never
// bypasses the "nothing to promote" case — there is nothing to force there.
export async function promoteToDailyRuns(force = false): Promise<PromoteResult> {
  const tomorrowCount = await prisma.job.count({ where: { runType: 'Tomorrow' } });
  if (tomorrowCount === 0) {
    // Nothing queued — most likely this run was already promoted. Leave the
    // current Daily rows (and any driver progress on them) untouched.
    return { status: 'skipped' };
  }

  if (!force) {
    const unfinishedCount = await prisma.job.count({
      where: { runType: 'Daily', status: { notIn: ['Done', 'NotRequired'] } },
    });
    if (unfinishedCount > 0) {
      return { status: 'requiresConfirm', unfinishedCount };
    }
  }

  // Archive any remaining daily runs that weren't completed
  await prisma.job.deleteMany({ where: { runType: 'Daily' } });

  // Promote only the nearest scheduled run. "Nearest" is whatever's actually
  // in Tomorrow right now, not the literal wall-clock date — Generate and
  // Promote don't have to be clicked on different days for this to work.
  // Jobs dispatched further ahead (e.g. an adhoc job booked for next week)
  // stay in 'Tomorrow' until their own date becomes the nearest one.
  const dates = (await prisma.job.findMany({
    where: { runType: 'Tomorrow' },
    select: { scheduledDate: true },
    distinct: ['scheduledDate'],
  })).map(j => j.scheduledDate).filter(d => d !== '').sort();
  const nearestDate = dates[0];

  await prisma.job.updateMany({
    where: { runType: 'Tomorrow', ...(nearestDate !== undefined ? forRunDate(nearestDate) : {}) },
    data: { runType: 'Daily' },
  });

  const jobs = await prisma.job.findMany({
    where: { runType: 'Daily' },
    orderBy: [{ driverName: 'asc' }, { jobOrder: 'asc' }],
  });

  return { status: 'promoted', jobs: jobs.map(toJob) };
}

// ─── Run Log ─────────────────────────────────────────────────────────────────

export async function getRunLog(days = 14): Promise<RunLogEntry[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const rows = await prisma.runLog.findMany({
    where: { date: { gte: cutoff } },
    orderBy: { date: 'desc' },
  });
  return rows.map(r => ({
    id: r.id,
    jobId: r.jobId,
    driverName: r.driverName,
    customerName: r.customerName,
    address: r.address,
    jobType: r.jobType,
    completionTime: r.completionTime.toISOString(),
    status: r.status as Job['status'],
    issueNotes: r.issueNotes ?? undefined,
    day: r.day,
    date: r.date.toISOString().split('T')[0],
  }));
}

// ─── Push subscriptions ───────────────────────────────────────────────────────

export async function savePushSubscription(driverName: string, sub: PushSubscriptionData): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { driverName },
    create: { driverName, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function getPushSubscription(driverName: string): Promise<PushSubscriptionData | null> {
  const row = await prisma.pushSubscription.findUnique({ where: { driverName } });
  if (!row) return null;
  return { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
}

export async function getAllPushSubscriptions(): Promise<{ driverName: string; subscription: PushSubscriptionData }[]> {
  const rows = await prisma.pushSubscription.findMany();
  return rows.map(r => ({
    driverName: r.driverName,
    subscription: { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
  }));
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function saveMessage(msg: Omit<AdminMessage, 'id'>): Promise<AdminMessage> {
  const row = await prisma.adminMessage.create({
    data: { to: msg.to, message: msg.message },
  });
  return { id: row.id, to: row.to, message: row.message, sentAt: row.sentAt.toISOString() };
}

export async function getMessagesForDriver(driverName: string): Promise<AdminMessage[]> {
  const rows = await prisma.adminMessage.findMany({
    where: { OR: [{ to: driverName }, { to: 'all' }] },
    orderBy: { sentAt: 'desc' },
    take: 20,
  });
  return rows.map(r => ({
    id: r.id,
    to: r.to,
    message: r.message,
    sentAt: r.sentAt.toISOString(),
    readAt: r.readAt?.toISOString(),
  }));
}

// ─── Notification log ─────────────────────────────────────────────────────────

export async function logNotification(entry: Omit<NotificationLog, 'id'>): Promise<void> {
  await prisma.notificationLog.create({
    data: {
      type: entry.type,
      recipient: entry.recipient,
      subject: entry.subject,
      body: entry.body.substring(0, 500),
      status: entry.status,
      error: entry.error,
    },
  });
}

export async function getNotificationLog(): Promise<NotificationLog[]> {
  const rows = await prisma.notificationLog.findMany({
    orderBy: { sentAt: 'desc' },
    take: 100,
  });
  return rows.map(r => ({
    id: r.id,
    type: r.type as NotificationLog['type'],
    recipient: r.recipient,
    subject: r.subject,
    body: r.body,
    status: r.status as NotificationLog['status'],
    error: r.error ?? undefined,
    sentAt: r.sentAt.toISOString(),
  }));
}
