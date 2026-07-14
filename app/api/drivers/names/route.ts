import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Must be dynamic: Next would otherwise bake the driver list in at build time,
// hiding drivers added after the last deploy.
export const dynamic = 'force-dynamic';

// Public endpoint — only returns names (no sensitive data)
export async function GET() {
  const drivers = await prisma.driver.findMany({
    where: { isActive: true },
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ success: true, data: drivers.map(d => d.name) });
}
