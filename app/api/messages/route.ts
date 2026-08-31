import { NextRequest, NextResponse } from 'next/server';
import { getMessagesForDriver } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { resolveDriverScope } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const scope = await resolveDriverScope(req.nextUrl.searchParams.get('driver'));
  if (!scope) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const driver = scope.driverName;
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
  const body = await req.json();
  const scope = await resolveDriverScope(body.driverName);
  if (!scope) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const driverName = scope.driverName;
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
