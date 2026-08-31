import { NextRequest, NextResponse } from 'next/server';
import { promoteToDailyRuns, getAllPushSubscriptions, NothingToPromoteError } from '@/lib/db';
import { sendPushNotification } from '@/lib/notifications';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('x-cron-secret');
  const isCron = Boolean(process.env.CRON_SECRET && auth === process.env.CRON_SECRET);
  // `adminOverride` in the body used to be accepted on its own, which any
  // caller could set. An admin session is now required instead.
  if (!isCron && !(await requireAuth('admin'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const jobs = await promoteToDailyRuns();

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

    return NextResponse.json({ success: true, data: { count: jobs.length, jobs } });
  } catch (err) {
    if (err instanceof NothingToPromoteError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
