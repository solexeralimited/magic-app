import { describe, it, expect } from 'vitest';
import {
  mapHeaders, colToA1, quoteTab, findHeaderRow, normalizeDay, findUnlabelledOrderColumn,
} from '@/lib/google-sheets';
import { parseSpreadsheetId, parseSheetGid } from '@/lib/settings';

describe('mapHeaders — sheet column recognition', () => {
  it('maps the standard template headings', () => {
    const cols = mapHeaders(['Driver', 'Day', 'Order', 'Customer', 'Address', 'Qty', 'Items', 'Frequency', 'ID']);
    expect(cols.driverName).toBe(0);
    expect(cols.day).toBe(1);
    expect(cols.jobOrder).toBe(2);
    expect(cols.customerName).toBe(3);
    expect(cols.address).toBe(4);
    expect(cols.quantity).toBe(5);
    expect(cols.items).toBe(6);
    expect(cols.frequency).toBe(7);
    expect(cols.id).toBe(8);
  });

  it('recognises "Shipping Address" and "Unit Type" (Round 2 headings)', () => {
    const cols = mapHeaders(['Customer Name', 'Shipping Address', 'Unit Type', 'Map Link', 'Call Ahead']);
    expect(cols.customerName).toBe(0);
    expect(cols.address).toBe(1);
    expect(cols.items).toBe(2);
    expect(cols.mapLink).toBe(3);
    expect(cols.callAhead).toBe(4);
  });

  it('ignores punctuation, spacing and case', () => {
    const cols = mapHeaders(['  DRIVER NAME ', 'next_service_date', 'Phone Number']);
    expect(cols.driverName).toBe(0);
    expect(cols.nextServiceDate).toBe(1);
    expect(cols.phone).toBe(2);
  });

  it('first matching column wins on duplicates', () => {
    const cols = mapHeaders(['Address', 'Shipping Address']);
    expect(cols.address).toBe(0);
  });

  it('unknown headings are ignored', () => {
    const cols = mapHeaders(['Something Weird']);
    expect(Object.keys(cols)).toHaveLength(0);
  });
});

describe('colToA1', () => {
  it('converts 0-based column index to A1 letters', () => {
    expect(colToA1(0)).toBe('A');
    expect(colToA1(25)).toBe('Z');
    expect(colToA1(26)).toBe('AA');
    expect(colToA1(27)).toBe('AB');
  });
});

// The real Thunderbox run sheet: title and period lines above the headings,
// no Driver column, abbreviated days, and an unlabelled run-order column.
const RUN_SHEET = [
  ['Upcoming Service Details'],
  [],
  ['For the period 10/8/2026 to 14/8/2026 (Week A)'],
  ['Comments', 'Wk', 'Customer Name', 'Shipping Address', 'Day', '', 'Phone', 'Items', 'Frequency', 'Next Service Date', 'Map Link', 'Call Ahead'],
  ['Entrance by Costco traffic lights', '3', 'S&G Construction', 'Kmart Site, Zone 6, Maki Street  Westgate', 'Mon', '1', '027 214 4106', 'Recirculating Flush'],
  ['', '3', 'S&G Construction', 'Kmart Site, Zone 6, Maki Street  Westgate', 'Mon', '2', '027 214 4106', 'Recirculating Flush'],
  ['Womens Loo', '', 'S&G Construction', 'Kmart Site, Zone 6, Maki Street  Westgate', 'Mon', '12', '027 214 4106', 'Recirculating Flush'],
  ['Fortnightly Cleans', 'B', 'Pipeline & Civil', '15 College Road, St. Johns', 'Mon', '17', '027 271 6299', 'Recirculating Flush'],
  ['', '', 'Bark and Soil', '3 Spedding Road Whenuapai', 'Thur', '34', '', 'Fresh Water Flush'],
];

describe('real run-sheet layout', () => {
  it('finds the header row below the title and period lines', () => {
    expect(findHeaderRow(RUN_SHEET)).toBe(3); // 0-based → row 4 in the sheet
  });

  it('maps the run sheet headings, including Comments → notes and Wk', () => {
    const cols = mapHeaders(RUN_SHEET[3]);
    expect(cols.notes).toBe(0);
    expect(cols.weekCycle).toBe(1);
    expect(cols.customerName).toBe(2);
    expect(cols.address).toBe(3);
    expect(cols.day).toBe(4);
    expect(cols.phone).toBe(6);
    expect(cols.items).toBe(7);
    expect(cols.driverName).toBeUndefined(); // no Driver column — the default driver covers this
  });

  it('finds the unlabelled run-order column', () => {
    const header = RUN_SHEET[3];
    const claimed = new Set(Object.values(mapHeaders(header)) as number[]);
    expect(findUnlabelledOrderColumn(header, RUN_SHEET.slice(4), claimed)).toBe(5);
  });

  it('falls back to row 0 when there is no recognisable header', () => {
    expect(findHeaderRow([['no'], ['headings'], ['here']])).toBe(0);
  });
});

describe('normalizeDay — abbreviated days', () => {
  it('accepts the abbreviations used in the run sheet', () => {
    expect(normalizeDay('Mon')).toBe('Monday');
    expect(normalizeDay('Tue')).toBe('Tuesday');
    expect(normalizeDay('Wed')).toBe('Wednesday');
    expect(normalizeDay('Thur')).toBe('Thursday'); // non-standard, and in the real sheet
    expect(normalizeDay('Fri')).toBe('Friday');
  });
  it('accepts full names and odd casing/spacing', () => {
    expect(normalizeDay('  MONDAY ')).toBe('Monday');
    expect(normalizeDay('Thurs')).toBe('Thursday');
  });
  it('rejects weekends and nonsense', () => {
    expect(normalizeDay('Sat')).toBe('');
    expect(normalizeDay('someday')).toBe('');
  });
});

describe('quoteTab — A1 notation quoting', () => {
  it('quotes a tab name containing a space (regression: "Unable to parse range")', () => {
    expect(quoteTab('Google Sheet')).toBe("'Google Sheet'");
  });
  it('quotes simple names too — always valid', () => {
    expect(quoteTab('Sheet1')).toBe("'Sheet1'");
  });
  it('escapes single quotes by doubling them', () => {
    expect(quoteTab("Dylan's Run")).toBe("'Dylan''s Run'");
  });
});

describe('parseSpreadsheetId', () => {
  it('extracts the ID from a full URL', () => {
    expect(parseSpreadsheetId('https://docs.google.com/spreadsheets/d/1AbC_dEf-123/edit#gid=0')).toBe('1AbC_dEf-123');
  });
  it('passes a bare ID through', () => {
    expect(parseSpreadsheetId(' 1AbC_dEf-123 ')).toBe('1AbC_dEf-123');
  });
  it('handles a real Thunderbox sheet URL', () => {
    expect(parseSpreadsheetId('https://docs.google.com/spreadsheets/d/1hr6N1sDUoXcgwiN-aBHWalGlzf1y-XpvuSJlsEk7pfw/edit?gid=1015081653#gid=1015081653'))
      .toBe('1hr6N1sDUoXcgwiN-aBHWalGlzf1y-XpvuSJlsEk7pfw');
  });
});

describe('parseSheetGid — which tab the link pointed at', () => {
  it('reads the gid from the query string', () => {
    expect(parseSheetGid('https://docs.google.com/spreadsheets/d/abc/edit?gid=1015081653#gid=1015081653')).toBe('1015081653');
  });
  it('reads the gid from the fragment alone', () => {
    expect(parseSheetGid('https://docs.google.com/spreadsheets/d/abc/edit#gid=42')).toBe('42');
  });
  it('returns empty when the URL has no gid', () => {
    expect(parseSheetGid('https://docs.google.com/spreadsheets/d/abc/edit')).toBe('');
  });
  it('returns empty for a bare spreadsheet ID', () => {
    expect(parseSheetGid('1AbC_dEf-123')).toBe('');
  });
});
