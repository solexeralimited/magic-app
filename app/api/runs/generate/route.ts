import { NextRequest, NextResponse } from 'next/server';
import { generateTomorrowRuns } from '@/lib/db';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && auth !== process.env.CRON_SECRET) {
    const body = await req.json().catch(() => ({}));
    if (body.adminOverride !== true) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }
  try {
    const jobs = await generateTomorrowRuns();
    return NextResponse.json({ success: true, data: { count: jobs.length, jobs } });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
