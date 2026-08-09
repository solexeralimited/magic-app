import { createSign } from 'node:crypto';
import { getSetting, SETTING_KEYS } from './settings';

// Lightweight Google Sheets REST client using a service account.
// Avoids the googleapis SDK (~10MB) — we only need token exchange + values read/write.

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

export async function sheetsConfigured(): Promise<boolean> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return false;
  if (process.env.GOOGLE_SHEET_ID) return true;
  return Boolean(await getSetting(SETTING_KEYS.sheetId));
}

function getServiceAccountKey(): ServiceAccountKey {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  const key = JSON.parse(raw);
  if (!key.client_email || !key.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email or private_key');
  }
  return key;
}

async function getSpreadsheetId(): Promise<string> {
  // Settings screen takes precedence so the office can repoint the sheet without a redeploy
  const configured = await getSetting(SETTING_KEYS.sheetId);
  if (configured) return configured;
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('No Google Sheet configured (set it in Import & API → Sheets Settings)');
  return id;
}

// ─── OAuth token (cached per lambda instance) ────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const key = getServiceAccountKey();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = b64({ alg: 'RS256', typ: 'JWT' });
  const claims = b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${signer.sign(key.private_key, 'base64url')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Google token exchange failed: ${JSON.stringify(data)}`);
  }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 120) * 1000 };
  return data.access_token;
}

async function sheetsFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const res = await fetch(`${SHEETS_BASE}/${await getSpreadsheetId()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? res.statusText;
    throw new Error(`Sheets API error (${res.status}): ${msg}`);
  }
  return data;
}

// ─── Sheet operations ────────────────────────────────────────────────────────

/**
 * Resolve which tab to use, in order of precedence:
 *   1. an explicitly configured tab name
 *   2. the gid captured from the pasted sheet URL (the tab the user was looking at)
 *   3. GOOGLE_SHEET_TAB from the environment
 *   4. the first tab in the spreadsheet
 */
export async function getTabName(): Promise<string> {
  const configured = await getSetting(SETTING_KEYS.sheetTab);
  if (configured) return configured;

  const gid = await getSetting(SETTING_KEYS.sheetGid);
  const meta = await sheetsFetch('?fields=sheets.properties(title,sheetId)');
  const sheets = (meta.sheets as { properties: { title: string; sheetId: number } }[] | undefined) ?? [];

  if (gid) {
    const match = sheets.find(s => String(s.properties.sheetId) === gid);
    if (match) return match.properties.title;
    throw new Error(
      `The sheet has no tab with id ${gid}. Available tabs: ${sheets.map(s => s.properties.title).join(', ')}`
    );
  }

  const envTab = process.env.GOOGLE_SHEET_TAB;
  if (envTab) return envTab;

  const title = sheets[0]?.properties?.title;
  if (!title) throw new Error('Spreadsheet has no tabs');
  return title;
}

/** Tab names in the spreadsheet — used to give a helpful error when one is misspelled. */
export async function listTabNames(): Promise<string[]> {
  const meta = await sheetsFetch('?fields=sheets.properties.title');
  const sheets = (meta.sheets as { properties: { title: string } }[] | undefined) ?? [];
  return sheets.map(s => s.properties.title);
}

/**
 * Quote a tab name for A1 notation. Names containing spaces or punctuation
 * ("Google Sheet", "Run Sheet 2026") are unparseable unquoted; single quotes
 * inside a name are escaped by doubling them.
 */
export function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

/** Read the whole tab. Returns rows of cell strings; row 0 is the header row. */
export async function readRows(tab: string): Promise<string[][]> {
  const data = await sheetsFetch(`/values/${encodeURIComponent(quoteTab(tab))}`);
  const values = (data.values as string[][] | undefined) ?? [];
  return values.map(row => row.map(cell => String(cell ?? '')));
}

/** Batch-write individual cell ranges in one API call. */
export async function writeCells(
  tab: string,
  updates: { row: number; col: number; value: string }[]
): Promise<void> {
  if (updates.length === 0) return;
  await sheetsFetch('/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: updates.map(u => ({
        range: `${quoteTab(tab)}!${colToA1(u.col)}${u.row + 1}`,
        values: [[u.value]],
      })),
    }),
  });
}

/** 0-based column index → A1 letter(s): 0 → A, 25 → Z, 26 → AA */
export function colToA1(col: number): string {
  let s = '';
  let n = col;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

// ─── Header mapping ──────────────────────────────────────────────────────────

export type SheetField =
  | 'id' | 'driverName' | 'day' | 'jobOrder' | 'jobType' | 'customerName'
  | 'address' | 'phone' | 'items' | 'quantity' | 'notes' | 'frequency'
  | 'nextServiceDate' | 'mapLink' | 'callAhead' | 'status' | 'lastCompleted'
  | 'weekCycle';

const HEADER_SYNONYMS: Record<string, SheetField> = {
  id: 'id', jobid: 'id',
  driver: 'driverName', drivername: 'driverName',
  day: 'day', runday: 'day',
  order: 'jobOrder', joborder: 'jobOrder', runorder: 'jobOrder',
  type: 'jobType', jobtype: 'jobType',
  customer: 'customerName', customername: 'customerName', name: 'customerName',
  address: 'address', street: 'address', shippingaddress: 'address', siteaddress: 'address', deliveryaddress: 'address',
  phone: 'phone', phonenumber: 'phone', mobile: 'phone', contact: 'phone',
  items: 'items', item: 'items', bins: 'items', unittype: 'items', units: 'items',
  quantity: 'quantity', qty: 'quantity',
  notes: 'notes', note: 'notes', comments: 'notes', comment: 'notes',
  wk: 'weekCycle', week: 'weekCycle', weekcycle: 'weekCycle',
  frequency: 'frequency', freq: 'frequency',
  nextservice: 'nextServiceDate', nextservicedate: 'nextServiceDate', nextdue: 'nextServiceDate',
  map: 'mapLink', maplink: 'mapLink', mapurl: 'mapLink',
  callahead: 'callAhead',
  status: 'status', laststatus: 'status',
  lastcompleted: 'lastCompleted', completed: 'lastCompleted', completedat: 'lastCompleted',
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Map header row → { field: columnIndex }. Unrecognized headers are ignored. */
export function mapHeaders(headerRow: string[]): Partial<Record<SheetField, number>> {
  const map: Partial<Record<SheetField, number>> = {};
  headerRow.forEach((h, i) => {
    const field = HEADER_SYNONYMS[normalizeHeader(h)];
    if (field !== undefined && map[field] === undefined) map[field] = i;
  });
  return map;
}

/**
 * Find the header row. Real run sheets carry a title and a period line above
 * the headings ("Upcoming Service Details", "For the period 10/8 to 14/8"),
 * so the headings are rarely on row 0. Picks the first row that maps to a
 * customer column plus at least two other known fields.
 */
export function findHeaderRow(rows: string[][], searchDepth = 15): number {
  for (let i = 0; i < Math.min(rows.length, searchDepth); i++) {
    const cols = mapHeaders(rows[i]);
    if (cols.customerName !== undefined && Object.keys(cols).length >= 3) return i;
  }
  return 0;
}

const DAY_ALIASES: Record<string, string> = {
  mon: 'Monday', monday: 'Monday',
  tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
  wed: 'Wednesday', weds: 'Wednesday', wednesday: 'Wednesday',
  thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
  fri: 'Friday', friday: 'Friday',
};

/** Normalise "Mon", "Thur", "FRIDAY" → "Monday", "Thursday", "Friday". '' if unrecognised. */
export function normalizeDay(value: string): string {
  return DAY_ALIASES[value.trim().toLowerCase().replace(/[^a-z]/g, '')] ?? '';
}

/**
 * Find a run-order column that has no heading. Run sheets often number jobs
 * 1..n per day in an unlabelled column beside the day, which would otherwise
 * be lost and leave every job at order 1.
 */
export function findUnlabelledOrderColumn(
  header: string[],
  dataRows: string[][],
  claimed: Set<number>
): number | undefined {
  const width = Math.max(header.length, ...dataRows.slice(0, 50).map(r => r.length));
  for (let col = 0; col < width; col++) {
    if (claimed.has(col) || (header[col] ?? '').trim() !== '') continue;
    let numeric = 0;
    let filled = 0;
    for (const row of dataRows.slice(0, 50)) {
      const cell = (row[col] ?? '').trim();
      if (!cell) continue;
      filled++;
      if (/^\d{1,3}$/.test(cell)) numeric++;
    }
    if (filled >= 3 && numeric / filled >= 0.9) return col;
  }
  return undefined;
}
