import { NextResponse } from 'next/server';
import { getNotificationLog } from '@/lib/db';

export async function GET() {
  try {
    const log = await getNotificationLog();
    return NextResponse.json({ success: true, data: log });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
