import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const drivers = await prisma.driver.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json({ success: true, data: drivers.map(d => ({
    id: d.id, name: d.name, email: d.email, phone: d.phone,
    isActive: d.isActive, hasPin: !!d.pin,
  })) });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { name, email, phone, pin } = await req.json();
  if (!name?.trim()) return NextResponse.json({ success: false, error: 'Name required' }, { status: 400 });

  const hashedPin = pin ? await bcrypt.hash(String(pin), 12) : null;
  const driver = await prisma.driver.create({
    data: { name: name.trim(), email: email || null, phone: phone || null, pin: hashedPin },
  });
  return NextResponse.json({ success: true, data: { id: driver.id, name: driver.name } });
}

export async function PUT(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id, name, email, phone, pin, isActive } = await req.json();
  const data: Record<string, unknown> = { name, email: email || null, phone: phone || null, isActive };
  if (pin) data.pin = await bcrypt.hash(String(pin), 12);

  const driver = await prisma.driver.update({ where: { id }, data });
  return NextResponse.json({ success: true, data: { id: driver.id, name: driver.name } });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await prisma.driver.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
