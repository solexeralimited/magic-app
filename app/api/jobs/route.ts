import { NextRequest, NextResponse } from 'next/server';
import { getDailyRunJobs, getTomorrowRunJobs } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const driver = req.nextUrl.searchParams.get('driver');
  if (!driver) {
    return NextResponse.json({ success: false, error: 'driver param required' }, { status: 400 });
  }
  try {
    const type = req.nextUrl.searchParams.get('type');
    const jobs = type === 'tomorrow'
      ? await getTomorrowRunJobs(driver)
      : await getDailyRunJobs(driver);
    return NextResponse.json({ success: true, data: jobs });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

// Create an ad hoc job directly in today's live Daily run — for something
// that comes up mid-day, after a run has already been promoted. Mirrors
// POST /api/jobs/tomorrow's adhoc path, minus scheduledDate (always today).
export async function POST(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const j = body.job;
    if (!j || !j.driverName || !j.customerName) {
      return NextResponse.json({ success: false, error: 'driverName and customerName required' }, { status: 400 });
    }

    const order = j.jobOrder
      ? parseInt(j.jobOrder)
      : (await prisma.job.count({ where: { driverName: j.driverName, runType: 'Daily' } })) + 1;
    const created = await prisma.job.create({
      data: {
        driverName: j.driverName,
        jobOrder: Math.max(1, order || 1),
        day: j.day || '',
        jobType: j.jobType || 'Adhoc',
        customerName: j.customerName,
        address: j.address || '',
        phone: j.phone || '',
        items: j.items || '',
        quantity: j.quantity || '',
        notes: j.notes || '',
        frequency: j.frequency || '',
        nextServiceDate: j.nextServiceDate || '',
        mapLink: j.mapLink || '',
        callAhead: j.callAhead || false,
        status: 'Pending',
        runType: 'Daily',
        scheduledDate: todayDateString(),
      },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// Fields a one-off, day-specific edit is allowed to touch. Deliberately
// excludes driverName (reassign's job), jobOrder (reorder's job), and
// scheduling fields — those drive the recurring Master schedule, not this
// single day's copy.
const EDITABLE_FIELDS = ['jobType', 'address', 'phone', 'items', 'quantity', 'notes', 'mapLink', 'callAhead'] as const;

export async function PATCH(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    if (body.action === 'edit') {
      const { id, fields } = body;
      if (!id || typeof fields !== 'object' || fields === null) {
        return NextResponse.json({ success: false, error: 'id and fields required' }, { status: 400 });
      }
      const data: Record<string, unknown> = {};
      for (const key of EDITABLE_FIELDS) {
        if (key in fields) data[key] = fields[key];
      }
      await prisma.job.updateMany({ where: { id, runType: 'Daily' }, data });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'reorder') {
      const updates = body.jobs as { id: string; jobOrder: number }[];
      await Promise.all(
        updates.map(u => prisma.job.updateMany({ where: { id: u.id, runType: 'Daily' }, data: { jobOrder: u.jobOrder } }))
      );
      return NextResponse.json({ success: true });
    }

    const { jobIds, driverName } = body;
    if (!Array.isArray(jobIds) || jobIds.length === 0 || !driverName) {
      return NextResponse.json({ success: false, error: 'jobIds and driverName required' }, { status: 400 });
    }
    await prisma.job.updateMany({
      where: { id: { in: jobIds }, runType: 'Daily' },
      data: { driverName },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
