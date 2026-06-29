import { NextRequest, NextResponse } from 'next/server';
import { savePushSubscription } from '@/lib/db';
import { PushSubscriptionData } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { driverName, subscription } = await req.json() as {
      driverName: string;
      subscription: PushSubscriptionData;
    };
    if (!driverName || !subscription) {
      return NextResponse.json({ success: false, error: 'driverName and subscription required' }, { status: 400 });
    }
    await savePushSubscription(driverName, subscription);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
