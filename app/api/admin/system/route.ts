import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { parseDatabaseUrl, detectPlatform } from '@/lib/system-info';
import { getServiceAccountEmail } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/system — what this deployment is actually connected to.
 * Admin only. Reports hosts and whether secrets are present, never their values.
 */
export async function GET() {
  const session = await requireAuth('admin');
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const platform = detectPlatform();
  const database = parseDatabaseUrl(process.env.DATABASE_URL);

  return NextResponse.json({
    success: true,
    data: {
      platform,
      database,
      googleServiceAccount: getServiceAccountEmail(),
      configured: {
        databaseUrl:        Boolean(process.env.DATABASE_URL),
        googleServiceKey:   Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
        googleSheetIdEnv:   Boolean(process.env.GOOGLE_SHEET_ID),
        cronSecret:         Boolean(process.env.CRON_SECRET),
        nextAuthSecret:     Boolean(process.env.NEXTAUTH_SECRET),
        resendApiKey:       Boolean(process.env.RESEND_API_KEY),
        adminEmail:         process.env.ADMIN_EMAIL ?? '',
        pushNotifications:  Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      },
    },
  });
}
