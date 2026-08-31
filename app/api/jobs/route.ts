import { NextRequest, NextResponse } from 'next/server';
import { getDailyRunJobs, getTomorrowRunJobs } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { requireAuth, resolveDriverScope } from '@/lib/auth';

export async function GET(req: NextRequest) {
  // A driver is pinned to their own run; the ?driver= parameter is only
  // honoured for admins, so it cannot be used to read someone else's jobs.
  const scope = await resolveDriverScope(req.nextUrl.searchParams.get('driver'));
  if (!scope) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const driver = scope.driverName;
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

// Reassigning jobs between drivers is a dispatch action
export async function PATCH(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { jobIds, driverName } = await req.json();
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
