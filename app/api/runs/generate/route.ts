import { NextRequest, NextResponse } from 'next/server';
import { generateTomorrowRuns, tomorrowRunExists, resetTomorrowRun, AlreadyPromotedError } from '@/lib/db';
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
    // A prepared Tomorrow run may hold dispatch changes (reassignments, adhoc
    // jobs, reordering). Never let a regenerate silently destroy that work:
    // the nightly cron skips, and a manual click must confirm with force.
    const existing = await tomorrowRunExists();
    if (existing > 0) {
      if (isCron) {
        return NextResponse.json({ success: true, data: { skipped: true, count: existing } });
      }
      if (body.force !== true) {
        return NextResponse.json({
          success: false,
          requiresConfirm: true,
          error: `Tomorrow's run already exists (${existing} jobs). Regenerating will discard any dispatch changes.`,
        }, { status: 409 });
      }
    }

    const jobs = await generateTomorrowRuns();
    return NextResponse.json({ success: true, data: { count: jobs.length, jobs } });
  } catch (err) {
    if (err instanceof AlreadyPromotedError) {
      // Not a failure — nothing was touched. The cron gets a quiet skip;
      // a manual click gets a warning, not a red error.
      if (isCron) {
        return NextResponse.json({ success: true, data: { skipped: true, count: 0 } });
      }
      return NextResponse.json({ success: false, warning: true, error: err.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// Undo a Generate click — wipes tomorrow's run back to empty. Manual-only;
// there's no cron use case for discarding a prepared run.
export async function DELETE() {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const count = await resetTomorrowRun();
    return NextResponse.json({ success: true, data: { count } });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
