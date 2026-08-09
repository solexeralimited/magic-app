import { describe, it, expect } from 'vitest';
import { mapHeaders, colToA1, quoteTab } from '@/lib/google-sheets';
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
