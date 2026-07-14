import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Must be dynamic: a statically-optimized health check would bake its build-time
// result and never actually probe the database.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'connected' });
  } catch {
    return NextResponse.json({ status: 'error', db: 'disconnected' }, { status: 503 });
  }
}
