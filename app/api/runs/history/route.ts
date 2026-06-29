import { NextRequest, NextResponse } from 'next/server';
import { getRunLog } from '@/lib/db';

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '14', 10);
  try {
    const log = await getRunLog(days);
    return NextResponse.json({ success: true, data: log });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
