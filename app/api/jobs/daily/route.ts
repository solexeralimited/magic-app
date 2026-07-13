import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Returns all daily jobs across all drivers, ordered by driver then job order
export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      where: { runType: 'Daily' },
      orderBy: [{ driverName: 'asc' }, { jobOrder: 'asc' }],
    });
    return NextResponse.json({ success: true, data: jobs });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
