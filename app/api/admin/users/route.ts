import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  return NextResponse.json({ success: true, data: users });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { name, email, password } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ success: false, error: 'Name, email and password required' }, { status: 400 });
  }
  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.adminUser.create({
    data: { name, email: email.toLowerCase(), password: hashed },
    select: { id: true, name: true, email: true },
  });
  return NextResponse.json({ success: true, data: user });
}

export async function PUT(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id, name, email, password } = await req.json();
  const data: Record<string, string> = { name, email: email.toLowerCase() };
  if (password) data.password = await bcrypt.hash(password, 12);

  const user = await prisma.adminUser.update({
    where: { id }, data,
    select: { id: true, name: true, email: true },
  });
  return NextResponse.json({ success: true, data: user });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  // Prevent deleting yourself
  const toDelete = await prisma.adminUser.findUnique({ where: { id } });
  if (toDelete?.email === session.user.email) {
    return NextResponse.json({ success: false, error: 'Cannot delete your own account' }, { status: 400 });
  }
  await prisma.adminUser.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
