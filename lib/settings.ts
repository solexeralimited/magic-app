import { prisma } from './prisma';

// Simple key-value app settings stored in the database.
// Used for Google Sheets config so it can be changed without redeploying.

export const SETTING_KEYS = {
  sheetId: 'sheets.spreadsheetId',
  sheetTab: 'sheets.tabName',
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (value === '') {
    await prisma.appSetting.deleteMany({ where: { key } });
    return;
  }
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** Extract a spreadsheet ID from a full Google Sheets URL, or return the input as-is. */
export function parseSpreadsheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}
