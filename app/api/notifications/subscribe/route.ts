import { NextRequest, NextResponse } from 'next/server';
import { savePushSubscription } from '@/lib/db';
import { resolveDriverScope } from '@/lib/auth';
import { PushSubscriptionData } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { driverName, subscription } = await req.json() as {
      driverName: string;
      subscription: PushSubscriptionData;
    };
    // Pinned to the caller, so nobody can redirect another driver's push
    // notifications to their own device
    const scope = await resolveDriverScope(driverName);
    if (!scope) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!scope.driverName || !subscription) {
      return NextResponse.json({ success: false, error: 'driverName and subscription required' }, { status: 400 });
    }
    await savePushSubscription(scope.driverName, subscription);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
