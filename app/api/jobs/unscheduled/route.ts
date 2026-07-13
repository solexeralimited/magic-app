import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      where: { runType: 'Unscheduled' },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ success: true, data: jobs });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// Move a job into the Task Bar (mark as Unscheduled)
export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.job.update({ where: { id }, data: { runType: 'Unscheduled' } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// Assign a Task Bar job to a driver's daily run
export async function PATCH(req: NextRequest) {
  try {
    const { id, driverName, jobOrder } = await req.json();
    if (!id || !driverName) {
      return NextResponse.json({ success: false, error: 'id and driverName required' }, { status: 400 });
    }
    const order = jobOrder ?? (await prisma.job.count({ where: { driverName, runType: 'Daily' } })) + 1;
    await prisma.job.update({
      where: { id },
      data: { driverName, runType: 'Daily', jobOrder: order },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
