import { NextRequest, NextResponse } from 'next/server';
import { promoteToDailyRuns, getAllPushSubscriptions } from '@/lib/db';
import { sendPushNotification } from '@/lib/notifications';

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
    const jobs = await promoteToDailyRuns();

    if (jobs.length === 0) {
      return NextResponse.json({ success: true, data: { count: 0, skipped: 'no jobs to promote' } });
    }

    void (async () => {
      const subs = await getAllPushSubscriptions();
      for (const { driverName, subscription } of subs) {
        const driverJobs = jobs.filter(j => j.driverName === driverName);
        if (driverJobs.length > 0) {
          await sendPushNotification(
            subscription,
            '🚚 Your jobs for today are ready',
            `You have ${driverJobs.length} job${driverJobs.length !== 1 ? 's' : ''} today`,
            { driverName, type: 'newRun' }
          );
        }
      }
    })();

    return NextResponse.json({ success: true, data: { count: jobs.length } });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
