import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  sheetsConfigured, getTabName, readRows, writeCells, mapHeaders,
  findHeaderRow, normalizeDay, findUnlabelledOrderColumn,
} from '@/lib/google-sheets';
import { getSetting, SETTING_KEYS } from '@/lib/settings';

const VALID_DAYS  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const VALID_TYPES = ['Service', 'Delivery', 'Pickup', 'Adhoc'];
const VALID_FREQS = ['', 'Weekly', 'Fortnightly', '3 Weekly', '4 Weekly'];

/**
 * POST /api/sheets/import — import master jobs from the configured Google Sheet.
 *
 * Body:
 * - mode: 'replace' (default) wipes all existing Master jobs first, so the sheet
 *   is the single source of truth. 'sync' keeps the old merge behaviour.
 * - dryRun: true reads and validates the sheet without touching the database
 *   or writing IDs back — returns what would happen.
 *
 * Row contract:
 * - Rows with a value in the ID column keep that ID as the permanent sheet link.
 * - Rows without an ID get a new permanent ID written back into the sheet.
 * - In sync mode, master jobs whose sheetRowId no longer appears are deleted.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth('admin');
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await sheetsConfigured())) {
    return NextResponse.json(
      { success: false, error: 'Google Sheets is not configured (set the sheet in Import & API → Sheets Settings)' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const mode: 'replace' | 'sync' = body.mode === 'sync' ? 'sync' : 'replace';
  const dryRun: boolean = body.dryRun === true;

  try {
    const tab = await getTabName();
    const rows = await readRows(tab);
    if (rows.length < 2) {
      return NextResponse.json({ success: false, error: 'Sheet has no data rows below the header' }, { status: 400 });
    }

    // Headings are often below a title and period line, not on the first row
    const headerRowIndex = findHeaderRow(rows);
    const header = rows[headerRowIndex];
    const cols = mapHeaders(header);
    for (const required of ['customerName', 'day'] as const) {
      if (cols[required] === undefined) {
        return NextResponse.json(
          { success: false, error: `Sheet is missing a required column: ${required} (headers found on row ${headerRowIndex + 1}: ${header.join(', ')})` },
          { status: 400 }
        );
      }
    }

    const dataRows = rows.slice(headerRowIndex + 1);

    // Run order often sits in an unlabelled column beside the day
    const claimed = new Set(Object.values(cols) as number[]);
    const orderCol = cols.jobOrder ?? findUnlabelledOrderColumn(header, dataRows, claimed);

    // Sheets with no Driver column import to a configured default driver;
    // dispatch splits the run afterwards.
    const defaultDriver = await getSetting(SETTING_KEYS.defaultDriver);
    if (cols.driverName === undefined && !defaultDriver) {
      return NextResponse.json(
        {
          success: false,
          error: 'This sheet has no Driver column. Choose a default driver in Import & API → Google Sheets Settings, or add a "Driver" column to the sheet.',
        },
        { status: 400 }
      );
    }

    // Ensure an ID column exists; append one to the header row if not.
    let idCol = cols.id;
    const pendingWrites: { row: number; col: number; value: string }[] = [];
    if (idCol === undefined) {
      idCol = header.length;
      pendingWrites.push({ row: headerRowIndex, col: idCol, value: 'ID' });
    }

    const driverNames = new Set(
      (await prisma.driver.findMany({ select: { name: true }, where: { isActive: true } })).map(d => d.name)
    );

    const cell = (row: string[], col: number | undefined) => (col === undefined ? '' : (row[col] ?? '').trim());

    const errors: { row: number; error: string }[] = [];
    const seenIds = new Set<string>();
    const validRows: { rowIndex: number; existingId: string; data: Record<string, unknown> }[] = [];

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      const sheetRowNum = i + 1; // human-facing (1-based, matches the sheet)

      const rawDriver    = cell(row, cols.driverName);
      const customerName = cell(row, cols.customerName);
      const rawDay       = cell(row, cols.day);

      // Skip fully empty rows silently
      if (!rawDriver && !customerName && !rawDay) continue;

      const driverName = rawDriver || defaultDriver || '';
      if (!driverNames.has(driverName)) {
        errors.push({
          row: sheetRowNum,
          error: rawDriver ? `Driver "${rawDriver}" not found` : `Default driver "${driverName}" is not an active driver`,
        });
        continue;
      }
      if (!customerName) {
        errors.push({ row: sheetRowNum, error: 'Customer name is required' });
        continue;
      }
      const day = normalizeDay(rawDay);
      if (!VALID_DAYS.includes(day)) {
        errors.push({ row: sheetRowNum, error: `Unrecognised day "${rawDay}" — expected Mon–Fri` });
        continue;
      }

      const jobType = cell(row, cols.jobType) || 'Service';
      if (!VALID_TYPES.includes(jobType)) {
        errors.push({ row: sheetRowNum, error: `Job type must be one of: ${VALID_TYPES.join(', ')}` });
        continue;
      }

      let frequency = cell(row, cols.frequency);
      if (frequency === 'Weekly') frequency = '';
      // "Wk" A/B marks jobs that alternate fortnights. Recorded as Fortnightly;
      // the first completion anchors which fortnight it falls in.
      if (!frequency) {
        const wk = cell(row, cols.weekCycle).toUpperCase();
        if (wk === 'A' || wk === 'B') frequency = 'Fortnightly';
      }
      if (!VALID_FREQS.includes(frequency)) {
        errors.push({ row: sheetRowNum, error: 'Frequency must be: Weekly, Fortnightly, 3 Weekly, or 4 Weekly' });
        continue;
      }

      const callAheadRaw = cell(row, cols.callAhead).toLowerCase();
      validRows.push({
        rowIndex: i,
        existingId: cell(row, idCol),
        data: {
          driverName,
          customerName,
          day,
          jobType,
          jobOrder:        Math.max(1, parseInt(cell(row, orderCol)) || 1),
          address:         cell(row, cols.address),
          phone:           cell(row, cols.phone),
          items:           cell(row, cols.items),
          quantity:        cell(row, cols.quantity),
          notes:           cell(row, cols.notes),
          frequency,
          nextServiceDate: cell(row, cols.nextServiceDate),
          mapLink:         cell(row, cols.mapLink),
          callAhead:       callAheadRaw === 'true' || callAheadRaw === 'yes' || callAheadRaw === '1',
        },
      });
    }

    if (dryRun) {
      const existingMasters = await prisma.job.count({ where: { runType: 'Master' } });
      return NextResponse.json({
        success: true,
        data: {
          tab,
          dryRun: true,
          mode,
          headerRow: headerRowIndex + 1,
          driverSource: cols.driverName !== undefined ? 'sheet' : `default (${defaultDriver})`,
          orderColumn: orderCol === undefined ? 'not found — all jobs order 1' : `column ${orderCol + 1}`,
          wouldImport: validRows.length,
          wouldRemove: mode === 'replace' ? existingMasters : undefined,
          newIds: validRows.filter(r => !r.existingId).length,
          errors,
          preview: validRows.slice(0, 10).map(r => r.data),
        },
      });
    }

    let created = 0;
    let updated = 0;
    let removed = 0;

    if (mode === 'replace') {
      // The sheet is the source of truth: wipe every master job first.
      // Tomorrow/Daily working copies are left alone — dispatch changes survive.
      const { count } = await prisma.job.deleteMany({ where: { runType: 'Master' } });
      removed = count;
    }

    for (const { rowIndex, existingId, data } of validRows) {
      if (existingId) {
        seenIds.add(existingId);
        const existing = mode === 'replace'
          ? null
          : await prisma.job.findFirst({ where: { runType: 'Master', sheetRowId: existingId } });
        if (existing) {
          await prisma.job.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await prisma.job.create({ data: { ...(data as object), status: 'Pending', runType: 'Master', sheetRowId: existingId } as never });
          created++;
        }
      } else {
        const job = await prisma.job.create({ data: { ...(data as object), status: 'Pending', runType: 'Master' } as never });
        await prisma.job.update({ where: { id: job.id }, data: { sheetRowId: job.id } });
        pendingWrites.push({ row: rowIndex, col: idCol, value: job.id });
        seenIds.add(job.id);
        created++;
      }
    }

    if (mode === 'sync') {
      // Remove master jobs whose sheet row was deleted
      const res = await prisma.job.deleteMany({
        where: { runType: 'Master', sheetRowId: { notIn: [...seenIds, ''] } },
      });
      removed = res.count;
    }

    // Stamp new permanent IDs back into the sheet
    await writeCells(tab, pendingWrites);

    return NextResponse.json({
      success: true,
      data: { tab, mode, created, updated, removed, idsWrittenBack: pendingWrites.filter(w => w.row > 0).length, errors },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
