import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, getAllPushSubscriptions } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { resolveDriverScope } from '@/lib/auth';
import { sendPushNotification, sendIssueAlertEmail, sendCantAccessEmail } from '@/lib/notifications';
import { Job } from '@/types';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await resolveDriverScope();
  if (!scope) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { status, issueNotes } = body as { status: Job['status']; issueNotes?: string };

    if (!status) {
      return NextResponse.json({ success: false, error: 'status required' }, { status: 400 });
    }

    // A driver may only change the status of their own jobs
    if (!scope.isAdmin) {
      const target = await prisma.job.findUnique({ where: { id: params.id }, select: { driverName: true } });
      if (!target) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
      if (target.driverName !== scope.driverName) {
        return NextResponse.json({ success: false, error: 'That job belongs to another driver' }, { status: 403 });
      }
    }

    const job = await updateJobStatus(params.id, status, issueNotes);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    void (async () => {
      if (status === 'Issue') {
        await sendIssueAlertEmail(job);
        const subs = await getAllPushSubscriptions();
        for (const { subscription } of subs.slice(0, 3)) {
          await sendPushNotification(subscription, '⚠️ Issue Reported', `${job.driverName}: ${job.customerName}`, { type: 'issue' });
        }
      }
      if (status === 'CouldNotAccess') {
        await sendCantAccessEmail(job);
      }
    })();

    return NextResponse.json({ success: true, data: job });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
