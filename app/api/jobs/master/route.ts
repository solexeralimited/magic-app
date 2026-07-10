import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json();
    if (body.action === 'reorder') {
      const updates = body.jobs as { id: string; jobOrder: number }[];
      await Promise.all(
        updates.map(u => prisma.job.update({ where: { id: u.id }, data: { jobOrder: u.jobOrder } }))
      );
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
