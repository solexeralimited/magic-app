import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Public endpoint — only returns names (no sensitive data)
export async function GET() {
  const drivers = await prisma.driver.findMany({
    where: { isActive: true },
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ success: true, data: drivers.map(d => d.name) });
}
