import { NextResponse } from 'next/server';
import { getDrivers } from '@/lib/db';

export async function GET() {
  try {
    const drivers = await getDrivers();
    return NextResponse.json({ success: true, data: drivers });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
