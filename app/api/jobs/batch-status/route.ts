import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, getAllPushSubscriptions } from '@/lib/db';
import { sendPushNotification, sendIssueAlertEmail, sendCantAccessEmail } from '@/lib/notifications';
import { Job } from '@/types';

interface BatchUpdate {
  id: string;
  status: Job['status'];
  issueNotes?: string;
}

// One request completes a whole site visit: all outcomes land together even on
// patchy reception, instead of N separate calls that can partially fail.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updates = body.updates as BatchUpdate[];
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ success: false, error: 'updates array required' }, { status: 400 });
    }

    const results: Job[] = [];
    const failed: string[] = [];
    for (const u of updates) {
      if (!u.id || !u.status) { failed.push(u.id ?? '?'); continue; }
      const job = await updateJobStatus(u.id, u.status, u.issueNotes);
      if (job) results.push(job);
      else failed.push(u.id);
    }

    void (async () => {
      const issues = results.filter(j => j.status === 'Issue');
      const cantAccess = results.filter(j => j.status === 'CouldNotAccess');
      for (const job of issues) await sendIssueAlertEmail(job);
      for (const job of cantAccess) await sendCantAccessEmail(job);
      if (issues.length > 0) {
        const subs = await getAllPushSubscriptions();
        for (const { subscription } of subs.slice(0, 3)) {
          await sendPushNotification(
            subscription,
            '⚠️ Issue Reported',
            issues.length === 1
              ? `${issues[0].driverName}: ${issues[0].customerName}`
              : `${issues[0].driverName}: ${issues.length} issues at ${issues[0].customerName}`,
            { type: 'issue' }
          );
        }
      }
    })();

    return NextResponse.json({ success: true, data: { updated: results.length, failed } });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
