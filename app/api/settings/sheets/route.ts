import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSetting, setSetting, parseSpreadsheetId, SETTING_KEYS } from '@/lib/settings';

export async function GET() {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const [sheetId, tabName] = await Promise.all([
      getSetting(SETTING_KEYS.sheetId),
      getSetting(SETTING_KEYS.sheetTab),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        sheetId: sheetId ?? '',
        tabName: tabName ?? '',
        envSheetId: Boolean(process.env.GOOGLE_SHEET_ID),
        serviceAccountConfigured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (body.sheetUrl !== undefined) {
      await setSetting(SETTING_KEYS.sheetId, body.sheetUrl ? parseSpreadsheetId(String(body.sheetUrl)) : '');
    }
    if (body.tabName !== undefined) {
      await setSetting(SETTING_KEYS.sheetTab, String(body.tabName).trim());
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
