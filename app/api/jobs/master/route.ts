import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const driver = req.nextUrl.searchParams.get('driver');
  const day = req.nextUrl.searchParams.get('day');
  try {
    const jobs = await prisma.job.findMany({
      where: {
        runType: 'Master',
        ...(driver ? { driverName: driver } : {}),
        ...(day ? { day } : {}),
      },
      orderBy: [{ driverName: 'asc' }, { day: 'asc' }, { jobOrder: 'asc' }],
    });
    return NextResponse.json({ success: true, data: jobs });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const job = await prisma.job.create({
      data: {
        driverName: body.driverName,
        jobOrder: parseInt(body.jobOrder) || 1,
        day: body.day,
        jobType: body.jobType || 'Service',
        customerName: body.customerName,
        address: body.address || '',
        phone: body.phone || '',
        items: body.items || '',
        quantity: body.quantity || '',
        notes: body.notes || '',
        frequency: body.frequency || '',
        nextServiceDate: body.nextServiceDate || '',
        mapLink: body.mapLink || '',
        callAhead: body.callAhead || false,
        status: 'Pending',
        runType: 'Master',
      },
    });
    return NextResponse.json({ success: true, data: job });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { id, ...data } = body;
    const job = await prisma.job.update({
      where: { id },
      data: {
        driverName: data.driverName,
        jobOrder: parseInt(data.jobOrder) || 1,
        day: data.day,
        jobType: data.jobType,
        customerName: data.customerName,
        address: data.address || '',
        phone: data.phone || '',
        items: data.items || '',
        quantity: data.quantity || '',
        notes: data.notes || '',
        frequency: data.frequency || '',
        nextServiceDate: data.nextServiceDate || '',
        mapLink: data.mapLink || '',
        callAhead: data.callAhead || false,
      },
    });
    return NextResponse.json({ success: true, data: job });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action === 'reorder') {
      const updates = body.jobs as { id: string; jobOrder: number }[];
      await Promise.all(
        updates.map(u => prisma.job.update({ where: { id: u.id }, data: { jobOrder: u.jobOrder } }))
      );
      return NextResponse.json({ success: true });
    }
    if (body.action === 'batch-move') {
      const { ids, driverName, day } = body as { action: string; ids: string[]; driverName?: string; day?: string };
      if (!Array.isArray(ids) || ids.length === 0 || (!driverName && !day)) {
        return NextResponse.json({ success: false, error: 'ids and driverName or day required' }, { status: 400 });
      }
      await prisma.job.updateMany({
        where: { id: { in: ids }, runType: 'Master' },
        data: { ...(driverName ? { driverName } : {}), ...(day ? { day } : {}) },
      });
      return NextResponse.json({ success: true, data: { moved: ids.length } });
    }
    if (body.action === 'batch-delete') {
      const { ids } = body as { action: string; ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ success: false, error: 'ids required' }, { status: 400 });
      }
      const { count } = await prisma.job.deleteMany({ where: { id: { in: ids }, runType: 'Master' } });
      return NextResponse.json({ success: true, data: { deleted: count } });
    }
    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await req.json();
    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
