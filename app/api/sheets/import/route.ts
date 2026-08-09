import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  sheetsConfigured, getTabName, listTabNames, readRows, writeCells, mapHeaders,
  findHeaderRow, normalizeDay, findUnlabelledOrderColumn,
} from '@/lib/google-sheets';
import { getSetting, SETTING_KEYS } from '@/lib/settings';

const VALID_DAYS  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const VALID_TYPES = ['Service', 'Delivery', 'Pickup', 'Adhoc'];
const VALID_FREQS = ['', 'Weekly', 'Fortnightly', '3 Weekly', '4 Weekly'];

interface ParsedRow {
  rowIndex: number;
  existingId: string;
  data: Record<string, unknown>;
}

interface ParsedTab {
  tab: string;
  headerRowIndex: number;
  idCol: number;
  headerWrites: { row: number; col: number; value: string }[];
  driverSource: string;
  orderColumn: string;
  rows: ParsedRow[];
  errors: { tab: string; row: number; error: string }[];
}

/**
 * Read one tab and turn it into master-job rows.
 * `driverOverride` supplies the driver when the sheet has no Driver column —
 * either the configured default, or the tab's own name in driver-tab mode.
 */
async function parseTab(
  tab: string,
  driverNames: Set<string>,
  driverOverride: string,
  driverSourceLabel: string
): Promise<ParsedTab | { fatal: string }> {
  const rows = await readRows(tab);
  if (rows.length < 2) return { fatal: `Tab "${tab}" has no data rows below the header` };

  const headerRowIndex = findHeaderRow(rows);
  const header = rows[headerRowIndex];
  const cols = mapHeaders(header);
  for (const required of ['customerName', 'day'] as const) {
    if (cols[required] === undefined) {
      return { fatal: `Tab "${tab}" is missing a required column: ${required} (headers found on row ${headerRowIndex + 1}: ${header.join(', ')})` };
    }
  }

  const dataRows = rows.slice(headerRowIndex + 1);
  const claimed = new Set(Object.values(cols) as number[]);
  const orderCol = cols.jobOrder ?? findUnlabelledOrderColumn(header, dataRows, claimed);

  let idCol = cols.id;
  const headerWrites: { row: number; col: number; value: string }[] = [];
  if (idCol === undefined) {
    idCol = header.length;
    headerWrites.push({ row: headerRowIndex, col: idCol, value: 'ID' });
  }

  const cell = (row: string[], col: number | undefined) => (col === undefined ? '' : (row[col] ?? '').trim());
  const errors: { tab: string; row: number; error: string }[] = [];
  const parsed: ParsedRow[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const sheetRowNum = i + 1; // 1-based, matches the sheet

    const rawDriver    = cell(row, cols.driverName);
    const customerName = cell(row, cols.customerName);
    const rawDay       = cell(row, cols.day);

    if (!rawDriver && !customerName && !rawDay) continue; // blank row

    const driverName = rawDriver || driverOverride;
    if (!driverNames.has(driverName)) {
      errors.push({
        tab,
        row: sheetRowNum,
        error: rawDriver ? `Driver "${rawDriver}" not found` : `"${driverName}" is not an active driver`,
      });
      continue;
    }
    if (!customerName) {
      errors.push({ tab, row: sheetRowNum, error: 'Customer name is required' });
      continue;
    }
    const day = normalizeDay(rawDay);
    if (!VALID_DAYS.includes(day)) {
      errors.push({ tab, row: sheetRowNum, error: `Unrecognised day "${rawDay}" — expected Mon–Fri` });
      continue;
    }

    const jobType = cell(row, cols.jobType) || 'Service';
    if (!VALID_TYPES.includes(jobType)) {
      errors.push({ tab, row: sheetRowNum, error: `Job type must be one of: ${VALID_TYPES.join(', ')}` });
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
      errors.push({ tab, row: sheetRowNum, error: 'Frequency must be: Weekly, Fortnightly, 3 Weekly, or 4 Weekly' });
      continue;
    }

    const callAheadRaw = cell(row, cols.callAhead).toLowerCase();
    parsed.push({
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

  return {
    tab,
    headerRowIndex,
    idCol,
    headerWrites,
    driverSource: cols.driverName !== undefined ? 'sheet column' : driverSourceLabel,
    orderColumn: orderCol === undefined ? 'not found — all jobs order 1' : `column ${orderCol + 1}`,
    rows: parsed,
    errors,
  };
}

/**
 * POST /api/sheets/import — import master jobs from the configured Google Sheet.
 *
 * Body:
 * - mode: 'replace' (default) wipes all existing Master jobs first, so the sheet
 *   is the single source of truth. 'sync' keeps the old merge behaviour.
 * - dryRun: true reads and validates without touching the database.
 *
 * Driver-tab mode (setting `sheets.driverTabs`) reads every tab whose name
 * matches an active driver and assigns that tab's jobs to them, so one import
 * loads the whole team's schedule.
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
    const driverNames = new Set(
      (await prisma.driver.findMany({ select: { name: true }, where: { isActive: true } })).map(d => d.name)
    );
    const driverTabs = (await getSetting(SETTING_KEYS.driverTabs)) === '1';
    const defaultDriver = (await getSetting(SETTING_KEYS.defaultDriver)) ?? '';

    // Decide which tabs to read and which driver each one belongs to
    const targets: { tab: string; driver: string; label: string }[] = [];
    const skippedTabs: string[] = [];
    if (driverTabs) {
      const tabs = await listTabNames();
      for (const t of tabs) {
        if (driverNames.has(t.trim())) targets.push({ tab: t, driver: t.trim(), label: `tab name (${t.trim()})` });
        else skippedTabs.push(t);
      }
      if (targets.length === 0) {
        return NextResponse.json({
          success: false,
          error: `No tab matches an active driver. Tabs: ${tabs.map(t => `"${t}"`).join(', ')}. Drivers: ${[...driverNames].map(d => `"${d}"`).join(', ')}. Names must match exactly.`,
        }, { status: 400 });
      }
    } else {
      const tab = await getTabName();
      if (!defaultDriver) {
        // Only a problem if the tab itself has no Driver column — parseTab reports that per row
        targets.push({ tab, driver: '', label: 'no default driver set' });
      } else {
        targets.push({ tab, driver: defaultDriver, label: `default driver (${defaultDriver})` });
      }
    }

    const parsedTabs: ParsedTab[] = [];
    for (const { tab, driver, label } of targets) {
      const result = await parseTab(tab, driverNames, driver, label);
      if ('fatal' in result) {
        return NextResponse.json({ success: false, error: result.fatal }, { status: 400 });
      }
      parsedTabs.push(result);
    }

    const allErrors = parsedTabs.flatMap(t => t.errors);
    const totalRows = parsedTabs.reduce((n, t) => n + t.rows.length, 0);

    if (dryRun) {
      const existingMasters = await prisma.job.count({ where: { runType: 'Master' } });
      return NextResponse.json({
        success: true,
        data: {
          tab: parsedTabs.map(t => t.tab).join(', '),
          dryRun: true,
          mode,
          driverTabs,
          skippedTabs,
          perTab: parsedTabs.map(t => ({ tab: t.tab, rows: t.rows.length, errors: t.errors.length })),
          headerRow: parsedTabs[0].headerRowIndex + 1,
          driverSource: parsedTabs[0].driverSource,
          orderColumn: parsedTabs[0].orderColumn,
          wouldImport: totalRows,
          wouldRemove: mode === 'replace' ? existingMasters : undefined,
          newIds: parsedTabs.reduce((n, t) => n + t.rows.filter(r => !r.existingId).length, 0),
          errors: allErrors,
          preview: parsedTabs[0].rows.slice(0, 10).map(r => r.data),
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

    const seenIds = new Set<string>();
    let idsWrittenBack = 0;

    for (const parsed of parsedTabs) {
      const writes = [...parsed.headerWrites];
      for (const { rowIndex, existingId, data } of parsed.rows) {
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
          writes.push({ row: rowIndex, col: parsed.idCol, value: job.id });
          seenIds.add(job.id);
          created++;
        }
      }
      // Stamp new permanent IDs back into this tab
      await writeCells(parsed.tab, writes);
      idsWrittenBack += writes.filter(w => w.value !== 'ID').length;
    }

    if (mode === 'sync') {
      const res = await prisma.job.deleteMany({
        where: { runType: 'Master', sheetRowId: { notIn: [...seenIds, ''] } },
      });
      removed = res.count;
    }

    return NextResponse.json({
      success: true,
      data: {
        tab: parsedTabs.map(t => t.tab).join(', '),
        mode,
        driverTabs,
        skippedTabs,
        perTab: parsedTabs.map(t => ({ tab: t.tab, rows: t.rows.length, errors: t.errors.length })),
        created,
        updated,
        removed,
        idsWrittenBack,
        errors: allErrors,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
