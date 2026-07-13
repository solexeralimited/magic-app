import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Returns all jobs for a given run type (Daily or Tomorrow), ordered by driver then job order
export async function GET(req: NextRequest) {
  const runType = req.nextUrl.searchParams.get('runType') ?? 'Daily';
  try {
    const jobs = await prisma.job.findMany({
      where: { runType },
      orderBy: [{ driverName: 'asc' }, { jobOrder: 'asc' }],
    });
    return NextResponse.json({ success: true, data: jobs });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
