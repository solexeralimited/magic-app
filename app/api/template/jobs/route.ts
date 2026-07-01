import { NextResponse } from 'next/server';

const HEADERS = [
  'driverName', 'day', 'jobOrder', 'jobType', 'customerName',
  'address', 'phone', 'items', 'notes', 'frequency',
  'nextServiceDate', 'mapLink', 'callAhead',
];

const EXAMPLES = [
  ['John Smith', 'Monday', '1', 'Service', 'ABC Company Ltd', '123 Main Street Auckland', '09 123 4567', '240L Wheelie Bins', 'Gate code 1234', 'Weekly', '', '', 'false'],
  ['Jane Doe', 'Tuesday', '1', 'Delivery', 'XYZ Warehouse', '456 Industrial Road Hamilton', '07 987 6543', 'Cardboard boxes', '', 'Fortnightly', '2025-08-01', '', 'false'],
  ['John Smith', 'Wednesday', '2', 'Pickup', 'City Council Depot', '789 Council Street', '09 555 0001', 'Mixed recycling', 'Call ahead required', '4 Weekly', '2025-09-15', '', 'true'],
];

function esc(v: string) {
  return v.includes(',') || v.includes('"') || v.includes('\n')
    ? `"${v.replace(/"/g, '""')}"`
    : v;
}

export async function GET() {
  const rows = [HEADERS.join(','), ...EXAMPLES.map(r => r.map(esc).join(','))];
  return new NextResponse(rows.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="thunderbox-jobs-template.csv"',
    },
  });
}
