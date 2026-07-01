import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { verifyApiKey } from '@/lib/api-keys';
import { prisma } from '@/lib/prisma';

const VALID_DAYS  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const VALID_TYPES = ['Service', 'Delivery', 'Pickup', 'Adhoc'];
const VALID_FREQS = ['', 'Weekly', 'Fortnightly', '3 Weekly', '4 Weekly'];

interface JobRow {
  driverName?: string;
  day?: string;
  jobOrder?: string | number;
  jobType?: string;
  customerName?: string;
  address?: string;
  phone?: string;
  items?: string;
  notes?: string;
  frequency?: string;
  nextServiceDate?: string;
  mapLink?: string;
  callAhead?: string | boolean;
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = await requireAuth('admin');
  if (session) return true;
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return verifyApiKey(auth.slice(7));
  return false;
}

export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const jobs: JobRow[] = body.jobs ?? [];
  const mode: 'append' | 'replace' = body.mode === 'replace' ? 'replace' : 'append';

  if (!Array.isArray(jobs) || jobs.length === 0) {
    return NextResponse.json({ success: false, error: 'No jobs provided' }, { status: 400 });
  }

  const driverNames = new Set(
    (await prisma.driver.findMany({ select: { name: true }, where: { isActive: true } }))
      .map(d => d.name)
  );

  const rowErrors: { row: number; field: string; error: string }[] = [];
  const valid: JobRow[] = [];

  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    const row = i + 1;
    let bad = false;

    const driverName = j.driverName?.trim() ?? '';
    if (!driverName) {
      rowErrors.push({ row, field: 'driverName', error: 'Required' }); bad = true;
    } else if (!driverNames.has(driverName)) {
      rowErrors.push({ row, field: 'driverName', error: `Driver "${driverName}" not found` }); bad = true;
    }

    if (!j.customerName?.trim()) {
      rowErrors.push({ row, field: 'customerName', error: 'Required' }); bad = true;
    }

    const day = j.day?.trim() ?? '';
    if (!VALID_DAYS.includes(day)) {
      rowErrors.push({ row, field: 'day', error: `Must be one of: ${VALID_DAYS.join(', ')}` }); bad = true;
    }

    const jobType = j.jobType?.trim() || 'Service';
    if (!VALID_TYPES.includes(jobType)) {
      rowErrors.push({ row, field: 'jobType', error: `Must be one of: ${VALID_TYPES.join(', ')}` }); bad = true;
    }

    const freq = (j.frequency?.trim() === 'Weekly' ? '' : j.frequency?.trim()) ?? '';
    if (!VALID_FREQS.includes(freq)) {
      rowErrors.push({ row, field: 'frequency', error: `Must be: Weekly, Fortnightly, 3 Weekly, or 4 Weekly` }); bad = true;
    }

    if (!bad) valid.push(j);
  }

  if (mode === 'replace') {
    await prisma.job.deleteMany({ where: { runType: 'Master' } });
  }

  let imported = 0;
  const importErrors = [...rowErrors];

  for (const j of valid) {
    try {
      const freq = (j.frequency?.trim() === 'Weekly' ? '' : j.frequency?.trim()) ?? '';
      const callAhead = j.callAhead === true || j.callAhead === 'true' || j.callAhead === '1';
      await prisma.job.create({
        data: {
          driverName:      j.driverName!.trim(),
          day:             j.day!.trim(),
          jobOrder:        Math.max(1, parseInt(String(j.jobOrder ?? '1')) || 1),
          jobType:         j.jobType?.trim() || 'Service',
          customerName:    j.customerName!.trim(),
          address:         j.address?.trim()         ?? '',
          phone:           j.phone?.trim()           ?? '',
          items:           j.items?.trim()           ?? '',
          notes:           j.notes?.trim()           ?? '',
          frequency:       freq,
          nextServiceDate: j.nextServiceDate?.trim() ?? '',
          mapLink:         j.mapLink?.trim()         ?? '',
          callAhead,
          status:  'Pending',
          runType: 'Master',
        },
      });
      imported++;
    } catch (err) {
      importErrors.push({ row: -1, field: 'db', error: String(err) });
    }
  }

  return NextResponse.json({ success: true, imported, skipped: jobs.length - imported, errors: importErrors });
}

/**
 * API reference (for consumers):
 *
 * POST /api/jobs/bulk
 * Authorization: Bearer <api-key>
 * Content-Type: application/json
 *
 * {
 *   "mode": "append" | "replace",
 *   "jobs": [
 *     {
 *       "driverName": "John Smith",       // required — must match an active driver
 *       "day": "Monday",                  // required — Monday–Friday
 *       "jobOrder": 1,                    // integer, default 1
 *       "jobType": "Service",             // Service | Delivery | Pickup | Adhoc
 *       "customerName": "ABC Ltd",        // required
 *       "address": "123 Main St",
 *       "phone": "09 123 4567",
 *       "items": "240L bins",
 *       "notes": "Gate code 1234",
 *       "frequency": "Weekly",            // Weekly | Fortnightly | 3 Weekly | 4 Weekly
 *       "nextServiceDate": "2025-08-01",  // YYYY-MM-DD, for non-weekly jobs
 *       "mapLink": "https://maps...",
 *       "callAhead": false
 *     }
 *   ]
 * }
 */
