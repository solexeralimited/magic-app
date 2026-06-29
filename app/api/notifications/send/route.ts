import { NextRequest, NextResponse } from 'next/server';
import { getPushSubscription, getAllPushSubscriptions, saveMessage } from '@/lib/db';
import { sendPushNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    const { to, title, body, message } = await req.json() as {
      to: string;
      title: string;
      body: string;
      message?: string;
    };

    const results: { driver: string; success: boolean }[] = [];

    if (to === 'all') {
      const subs = await getAllPushSubscriptions();
      for (const { driverName, subscription } of subs) {
        const ok = await sendPushNotification(subscription, title, body, { driverName });
        results.push({ driver: driverName, success: ok });
      }
    } else {
      const sub = await getPushSubscription(to);
      if (sub) {
        const ok = await sendPushNotification(sub, title, body, { driverName: to });
        results.push({ driver: to, success: ok });
      }
    }

    if (message) {
      await saveMessage({ to, message, sentAt: new Date().toISOString() });
    }

    return NextResponse.json({ success: true, data: results });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
