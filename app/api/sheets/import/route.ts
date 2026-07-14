import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sheetsConfigured, getTabName, readRows, writeCells, mapHeaders } from '@/lib/google-sheets';

const VALID_DAYS  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const VALID_TYPES = ['Service', 'Delivery', 'Pickup', 'Adhoc'];
const VALID_FREQS = ['', 'Weekly', 'Fortnightly', '3 Weekly', '4 Weekly'];

/**
 * POST /api/sheets/import — sync master jobs from the configured Google Sheet.
 *
 * Row contract:
 * - Rows with a value in the ID column update the matching master job (matched on sheetRowId).
 * - Rows without an ID create a new master job, and the new permanent ID is written back
 *   into the sheet's ID column (the column is appended to the header row if missing).
 * - Master jobs whose sheetRowId no longer appears in the sheet are deleted (removed rows).
 *   Jobs created in-app (empty sheetRowId) are never touched.
 */
export async function POST() {
  const session = await requireAuth('admin');
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!sheetsConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Google Sheets is not configured (set GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_SHEET_ID)' },
      { status: 400 }
    );
  }

  try {
    const tab = await getTabName();
    const rows = await readRows(tab);
    if (rows.length < 2) {
      return NextResponse.json({ success: false, error: 'Sheet has no data rows below the header' }, { status: 400 });
    }

    const header = rows[0];
    const cols = mapHeaders(header);
    for (const required of ['driverName', 'customerName', 'day'] as const) {
      if (cols[required] === undefined) {
        return NextResponse.json(
          { success: false, error: `Sheet is missing a required column: ${required} (found headers: ${header.join(', ')})` },
          { status: 400 }
        );
      }
    }

    // Ensure an ID column exists; append one to the header row if not.
    let idCol = cols.id;
    const pendingWrites: { row: number; col: number; value: string }[] = [];
    if (idCol === undefined) {
      idCol = header.length;
      pendingWrites.push({ row: 0, col: idCol, value: 'ID' });
    }

    const driverNames = new Set(
      (await prisma.driver.findMany({ select: { name: true }, where: { isActive: true } })).map(d => d.name)
    );

    const cell = (row: string[], col: number | undefined) => (col === undefined ? '' : (row[col] ?? '').trim());

    const errors: { row: number; error: string }[] = [];
    const seenIds = new Set<string>();
    let created = 0;
    let updated = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const sheetRowNum = i + 1; // human-facing (1-based, incl. header)

      const driverName   = cell(row, cols.driverName);
      const customerName = cell(row, cols.customerName);
      const day          = cell(row, cols.day);

      // Skip fully empty rows silently
      if (!driverName && !customerName && !day) continue;

      if (!driverName || !driverNames.has(driverName)) {
        errors.push({ row: sheetRowNum, error: driverName ? `Driver "${driverName}" not found` : 'Driver is required' });
        continue;
      }
      if (!customerName) {
        errors.push({ row: sheetRowNum, error: 'Customer name is required' });
        continue;
      }
      if (!VALID_DAYS.includes(day)) {
        errors.push({ row: sheetRowNum, error: `Day must be one of: ${VALID_DAYS.join(', ')}` });
        continue;
      }

      const jobType = cell(row, cols.jobType) || 'Service';
      if (!VALID_TYPES.includes(jobType)) {
        errors.push({ row: sheetRowNum, error: `Job type must be one of: ${VALID_TYPES.join(', ')}` });
        continue;
      }

      let frequency = cell(row, cols.frequency);
      if (frequency === 'Weekly') frequency = '';
      if (!VALID_FREQS.includes(frequency)) {
        errors.push({ row: sheetRowNum, error: 'Frequency must be: Weekly, Fortnightly, 3 Weekly, or 4 Weekly' });
        continue;
      }

      const callAheadRaw = cell(row, cols.callAhead).toLowerCase();
      const data = {
        driverName,
        customerName,
        day,
        jobType,
        jobOrder:        Math.max(1, parseInt(cell(row, cols.jobOrder)) || 1),
        address:         cell(row, cols.address),
        phone:           cell(row, cols.phone),
        items:           cell(row, cols.items),
        quantity:        cell(row, cols.quantity),
        notes:           cell(row, cols.notes),
        frequency,
        nextServiceDate: cell(row, cols.nextServiceDate),
        mapLink:         cell(row, cols.mapLink),
        callAhead:       callAheadRaw === 'true' || callAheadRaw === 'yes' || callAheadRaw === '1',
      };

      const existingId = cell(row, idCol);
      if (existingId) {
        seenIds.add(existingId);
        const existing = await prisma.job.findFirst({ where: { runType: 'Master', sheetRowId: existingId } });
        if (existing) {
          await prisma.job.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await prisma.job.create({ data: { ...data, status: 'Pending', runType: 'Master', sheetRowId: existingId } });
          created++;
        }
      } else {
        const job = await prisma.job.create({ data: { ...data, status: 'Pending', runType: 'Master' } });
        await prisma.job.update({ where: { id: job.id }, data: { sheetRowId: job.id } });
        pendingWrites.push({ row: i, col: idCol, value: job.id });
        seenIds.add(job.id);
        created++;
      }
    }

    // Remove master jobs whose sheet row was deleted
    const { count: removed } = await prisma.job.deleteMany({
      where: { runType: 'Master', sheetRowId: { notIn: [...seenIds, ''] } },
    });

    // Stamp new permanent IDs back into the sheet
    await writeCells(tab, pendingWrites);

    return NextResponse.json({
      success: true,
      data: { tab, created, updated, removed, idsWrittenBack: pendingWrites.filter(w => w.row > 0).length, errors },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
