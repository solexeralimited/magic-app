import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSetting, setSetting, parseSpreadsheetId, parseSheetGid, SETTING_KEYS } from '@/lib/settings';

export async function GET() {
  const session = await requireAuth('admin');
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const [sheetId, tabName, gid, defaultDriver, driverTabs] = await Promise.all([
      getSetting(SETTING_KEYS.sheetId),
      getSetting(SETTING_KEYS.sheetTab),
      getSetting(SETTING_KEYS.sheetGid),
      getSetting(SETTING_KEYS.defaultDriver),
      getSetting(SETTING_KEYS.driverTabs),
    ]);

    // Show which tab will actually be used, and what else is available.
    // In driver-tab mode the single-tab setting is unused, so a stale or wrong
    // tab name there must not surface as an error.
    let resolvedTab = '';
    let availableTabs: string[] = [];
    let tabError = '';
    if (sheetId || process.env.GOOGLE_SHEET_ID) {
      const { getTabName, listTabNames } = await import('@/lib/google-sheets');
      try {
        availableTabs = await listTabNames();
      } catch (e) {
        tabError = String(e instanceof Error ? e.message : e);
      }
      if (driverTabs !== '1' && !tabError) {
        try {
          resolvedTab = await getTabName();
        } catch (e) {
          tabError = String(e instanceof Error ? e.message : e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sheetId: sheetId ?? '',
        tabName: tabName ?? '',
        gid: gid ?? '',
        defaultDriver: defaultDriver ?? '',
        driverTabs: driverTabs === '1',
        resolvedTab,
        availableTabs,
        tabError,
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
      const raw = String(body.sheetUrl);
      await setSetting(SETTING_KEYS.sheetId, raw ? parseSpreadsheetId(raw) : '');
      // Remember which tab the URL pointed at, so a blank tab name doesn't
      // silently fall back to the first tab.
      await setSetting(SETTING_KEYS.sheetGid, raw ? parseSheetGid(raw) : '');
    }
    // Driver-tab mode ignores the single-tab setting, so a leftover value there
    // must not block saving — otherwise the field is greyed out in the UI while
    // still failing validation, with no way to fix it.
    const usingDriverTabs = body.driverTabs !== undefined
      ? Boolean(body.driverTabs)
      : (await getSetting(SETTING_KEYS.driverTabs)) === '1';

    if (body.tabName !== undefined) {
      const tabName = String(body.tabName).trim();
      // Validate up front — a wrong name otherwise fails later inside an import
      if (tabName && !usingDriverTabs) {
        const { listTabNames } = await import('@/lib/google-sheets');
        const tabs = await listTabNames();
        if (!tabs.includes(tabName)) {
          return NextResponse.json(
            { success: false, error: `This sheet has no tab named "${tabName}". Tabs in this sheet: ${tabs.map(t => `"${t}"`).join(', ')}` },
            { status: 400 }
          );
        }
      }
      await setSetting(SETTING_KEYS.sheetTab, tabName);
    }
    if (body.defaultDriver !== undefined) {
      await setSetting(SETTING_KEYS.defaultDriver, String(body.defaultDriver).trim());
    }
    if (body.driverTabs !== undefined) {
      await setSetting(SETTING_KEYS.driverTabs, body.driverTabs ? '1' : '');
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
