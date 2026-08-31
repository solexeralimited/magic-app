import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Returns all jobs for a given run type (Daily or Tomorrow), ordered by driver then job order
export async function GET(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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
