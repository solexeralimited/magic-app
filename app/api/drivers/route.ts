import { NextRequest, NextResponse } from 'next/server';
import { getDrivers } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const drivers = await getDrivers();
    return NextResponse.json({ success: true, data: drivers });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone } = await req.json();
    if (!name?.trim()) return NextResponse.json({ success: false, error: 'Name required' }, { status: 400 });
    const driver = await prisma.driver.create({ data: { name: name.trim(), email, phone } });
    return NextResponse.json({ success: true, data: driver });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.driver.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
