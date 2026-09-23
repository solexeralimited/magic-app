import { NextRequest, NextResponse } from 'next/server';
import { promoteToDailyRuns, getAllPushSubscriptions } from '@/lib/db';
import { sendPushNotification } from '@/lib/notifications';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = req.headers.get('x-cron-secret');
  const isCron = Boolean(process.env.CRON_SECRET && auth === process.env.CRON_SECRET);
  if (!isCron) {
    const session = await requireAuth('admin');
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await promoteToDailyRuns(body.force === true);

    if (result.status === 'skipped') {
      return NextResponse.json({ success: true, data: { count: 0, skipped: true } });
    }

    if (result.status === 'requiresConfirm') {
      // Cron never forces through unfinished driver work — there's no human
      // here to confirm it, so just skip quietly and let the next run try again.
      if (isCron) {
        return NextResponse.json({ success: true, data: { count: 0, skipped: true } });
      }
      return NextResponse.json({
        success: false,
        requiresConfirm: true,
        error: `${result.unfinishedCount} job(s) drivers haven't finished yet will be lost.`,
      }, { status: 409 });
    }

    const jobs = result.jobs;

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
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
