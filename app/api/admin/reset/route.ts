import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/reset — wipe operational data to start over.
 *
 * Deletes: all jobs (Master / Tomorrow / Daily / Unscheduled), run history,
 * office messages and the notification log.
 * Keeps: drivers, PINs, admin users, API keys, push subscriptions and
 * Google Sheets settings — so the team can log straight back in and import.
 *
 * Requires the literal confirmation string "RESET" in the body.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== 'RESET') {
      return NextResponse.json({ success: false, error: 'Type RESET to confirm' }, { status: 400 });
    }

    const runLog = await prisma.runLog.deleteMany({});
    const jobs = await prisma.job.deleteMany({});
    const messages = await prisma.adminMessage.deleteMany({});
    const notifications = await prisma.notificationLog.deleteMany({});

    return NextResponse.json({
      success: true,
      data: {
        jobs: jobs.count,
        history: runLog.count,
        messages: messages.count,
        notifications: notifications.count,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
