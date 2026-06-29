import { NextRequest, NextResponse } from 'next/server';
import { generateTomorrowRuns } from '@/lib/db';
import { sendRunReadyEmail } from '@/lib/notifications';

function authorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobs = await generateTomorrowRuns();
    await sendRunReadyEmail(jobs);
    return NextResponse.json({ success: true, data: { count: jobs.length } });
  } catch (err) {
    const msg = String(err);
    if (msg.includes('weekend')) {
      return NextResponse.json({ success: true, data: { count: 0, skipped: 'weekend' } });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
