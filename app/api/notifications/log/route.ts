import { NextResponse } from 'next/server';
import { getNotificationLog } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Must be dynamic: Next would otherwise freeze the log at build time.
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const log = await getNotificationLog();
    return NextResponse.json({ success: true, data: log });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
