import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { writeBackResults } from '@/lib/sheets-writeback';

/** POST /api/sheets/writeback — push today's job outcomes to the Google Sheet. */
export async function POST() {
  const session = await requireAuth('admin');
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await writeBackResults();
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
