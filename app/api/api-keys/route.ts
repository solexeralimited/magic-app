import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { generateApiKey } from '@/lib/api-keys';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ success: true, data: keys });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });

  const { key, hash, prefix } = generateApiKey();
  await prisma.apiKey.create({ data: { name: name.trim(), keyHash: hash, keyPrefix: prefix } });
  return NextResponse.json({ success: true, data: { key } });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await prisma.apiKey.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
