import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await prisma.adminMessage.findMany({
      orderBy: { sentAt: 'desc' },
      take: 30,
    });
    type MsgRow = { id: string; to: string; message: string; sentAt: Date; readAt: Date | null };
    return NextResponse.json({
      success: true,
      data: rows.map((r: MsgRow) => ({
        id: r.id,
        to: r.to,
        message: r.message,
        sentAt: r.sentAt.toISOString(),
        readAt: r.readAt?.toISOString(),
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
