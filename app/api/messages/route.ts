import { NextRequest, NextResponse } from 'next/server';
import { getMessagesForDriver } from '@/lib/db';

export async function GET(req: NextRequest) {
  const driver = req.nextUrl.searchParams.get('driver');
  if (!driver) {
    return NextResponse.json({ success: false, error: 'driver required' }, { status: 400 });
  }
  try {
    const messages = await getMessagesForDriver(driver);
    return NextResponse.json({ success: true, data: messages });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
