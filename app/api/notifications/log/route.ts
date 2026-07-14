import { NextResponse } from 'next/server';
import { getNotificationLog } from '@/lib/db';

// Must be dynamic: Next would otherwise freeze the log at build time.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const log = await getNotificationLog();
    return NextResponse.json({ success: true, data: log });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
