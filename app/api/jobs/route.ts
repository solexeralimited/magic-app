import { NextRequest, NextResponse } from 'next/server';
import { getDailyRunJobs, getTomorrowRunJobs } from '@/lib/db';

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
