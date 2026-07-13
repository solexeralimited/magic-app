import { NextRequest, NextResponse } from 'next/server';
import { getMessagesForDriver } from '@/lib/db';
import { prisma } from '@/lib/prisma';

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

// Mark all unread messages for a driver as read
export async function PATCH(req: NextRequest) {
  const { driverName } = await req.json();
  if (!driverName) {
    return NextResponse.json({ success: false, error: 'driverName required' }, { status: 400 });
  }
  try {
    const now = new Date();
    await prisma.adminMessage.updateMany({
      where: {
        readAt: null,
        OR: [{ to: driverName }, { to: 'all' }],
      },
      data: { readAt: now },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
