import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Dispatch working-copy editing: everything here touches ONLY runType 'Tomorrow',
// so operational changes never leak into the Master schedule.

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      where: { runType: 'Tomorrow' },
      orderBy: [{ driverName: 'asc' }, { jobOrder: 'asc' }],
    });
    return NextResponse.json({ success: true, data: jobs });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// Add jobs to tomorrow's run:
// - { masterIds: [...] } pulls master jobs forward into the working copy
// - { job: {...} }       creates an adhoc job directly in the working copy
export async function POST(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();

    if (Array.isArray(body.masterIds) && body.masterIds.length > 0) {
      const masters = await prisma.job.findMany({ where: { id: { in: body.masterIds }, runType: 'Master' } });
      const existing = new Set(
        (await prisma.job.findMany({ where: { runType: 'Tomorrow' }, select: { id: true } })).map(j => j.id)
      );
      const toCreate = masters.filter(m => !existing.has(`tmr-${m.id}`));
      if (toCreate.length > 0) {
        await prisma.job.createMany({
          data: toCreate.map(m => ({
            id: `tmr-${m.id}`,
            driverName: m.driverName,
            jobOrder: m.jobOrder,
            day: m.day,
            jobType: m.jobType,
            customerName: m.customerName,
            address: m.address,
            phone: m.phone,
            items: m.items,
            quantity: m.quantity,
            notes: m.notes,
            frequency: m.frequency,
            nextServiceDate: m.nextServiceDate,
            mapLink: m.mapLink,
            callAhead: m.callAhead,
            status: 'Pending',
            runType: 'Tomorrow',
            sheetRowId: m.sheetRowId,
          })),
        });
      }
      return NextResponse.json({ success: true, data: { added: toCreate.length, skipped: masters.length - toCreate.length } });
    }

    if (body.job) {
      const j = body.job;
      if (!j.driverName || !j.customerName) {
        return NextResponse.json({ success: false, error: 'driverName and customerName required' }, { status: 400 });
      }
      const order = j.jobOrder
        ? parseInt(j.jobOrder)
        : (await prisma.job.count({ where: { driverName: j.driverName, runType: 'Tomorrow' } })) + 1;
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
          runType: 'Tomorrow',
        },
      });
      return NextResponse.json({ success: true, data: created });
    }

    return NextResponse.json({ success: false, error: 'Provide masterIds or job' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// Edit the working copy: reassign between drivers, or save a new order.
export async function PATCH(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();

    if (body.action === 'reassign') {
      const { jobIds, driverName } = body;
      if (!Array.isArray(jobIds) || jobIds.length === 0 || !driverName) {
        return NextResponse.json({ success: false, error: 'jobIds and driverName required' }, { status: 400 });
      }
      await prisma.job.updateMany({
        where: { id: { in: jobIds }, runType: 'Tomorrow' },
        data: { driverName },
      });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'reorder') {
      const updates = body.jobs as { id: string; jobOrder: number }[];
      await Promise.all(
        updates.map(u => prisma.job.updateMany({ where: { id: u.id, runType: 'Tomorrow' }, data: { jobOrder: u.jobOrder } }))
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// Push a job back out of tomorrow's run (removes only the working copy).
export async function DELETE(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await req.json();
    await prisma.job.deleteMany({ where: { id, runType: 'Tomorrow' } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
