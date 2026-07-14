import { createSign } from 'node:crypto';

// Lightweight Google Sheets REST client using a service account.
// Avoids the googleapis SDK (~10MB) — we only need token exchange + values read/write.

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

export function sheetsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_SHEET_ID);
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

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEET_ID is not set');
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
  const res = await fetch(`${SHEETS_BASE}/${getSpreadsheetId()}${path}`, {
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

export async function getTabName(): Promise<string> {
  const configured = process.env.GOOGLE_SHEET_TAB;
  if (configured) return configured;
  const meta = await sheetsFetch('?fields=sheets.properties.title');
  const sheets = meta.sheets as { properties: { title: string } }[] | undefined;
  const title = sheets?.[0]?.properties?.title;
  if (!title) throw new Error('Spreadsheet has no tabs');
  return title;
}

/** Read the whole tab. Returns rows of cell strings; row 0 is the header row. */
export async function readRows(tab: string): Promise<string[][]> {
  const data = await sheetsFetch(`/values/${encodeURIComponent(tab)}`);
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
        range: `${tab}!${colToA1(u.col)}${u.row + 1}`,
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
  | 'nextServiceDate' | 'mapLink' | 'callAhead' | 'status' | 'lastCompleted';

const HEADER_SYNONYMS: Record<string, SheetField> = {
  id: 'id', jobid: 'id',
  driver: 'driverName', drivername: 'driverName',
  day: 'day', runday: 'day',
  order: 'jobOrder', joborder: 'jobOrder', runorder: 'jobOrder',
  type: 'jobType', jobtype: 'jobType',
  customer: 'customerName', customername: 'customerName', name: 'customerName',
  address: 'address', street: 'address',
  phone: 'phone', phonenumber: 'phone', mobile: 'phone', contact: 'phone',
  items: 'items', item: 'items', bins: 'items',
  quantity: 'quantity', qty: 'quantity',
  notes: 'notes', note: 'notes', comments: 'notes',
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
