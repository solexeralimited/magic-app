import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDailySummaryEmail } from '@/lib/notifications';
import { writeBackResults } from '@/lib/sheets-writeback';

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
    const jobs = await prisma.job.findMany({ where: { runType: 'Daily' } });
    if (jobs.length === 0) {
      return NextResponse.json({ success: true, data: { skipped: 'no daily jobs' } });
    }

    const stats = {
      total: jobs.length,
      done: jobs.filter((j: { status: string }) => j.status === 'Done').length,
      issues: jobs.filter((j: { status: string }) => j.status === 'Issue').length,
      cantAccess: jobs.filter((j: { status: string }) => j.status === 'CouldNotAccess').length,
      pending: jobs.filter((j: { status: string }) => j.status === 'Pending').length,
    };

    await sendDailySummaryEmail(stats);

    // Best-effort: push today's outcomes back to the Google Sheet
    let sheetSync: Awaited<ReturnType<typeof writeBackResults>> | { error: string };
    try {
      sheetSync = await writeBackResults();
    } catch (err) {
      sheetSync = { error: String(err) };
    }

    return NextResponse.json({ success: true, data: { ...stats, sheetSync } });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// Allow admin to trigger manually via POST
export async function POST(req: NextRequest) {
  return GET(req);
}
