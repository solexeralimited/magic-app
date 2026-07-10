import { NextRequest, NextResponse } from 'next/server';
import { getDailyRunJobs, getTomorrowRunJobs } from '@/lib/db';
import { prisma } from '@/lib/prisma';

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

export async function PATCH(req: NextRequest) {
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
