import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sheetsConfigured, getTabName, listTabNames, readRows, writeCells, mapHeaders } from '@/lib/google-sheets';
import { getSetting, SETTING_KEYS } from '@/lib/settings';

const VALID_DAYS  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const VALID_TYPES = ['Service', 'Delivery', 'Pickup', 'Adhoc'];
const VALID_FREQS = ['', 'Weekly', 'Fortnightly', '3 Weekly', '4 Weekly'];

/**
 * POST /api/sheets/import — import master jobs from the configured Google Sheet.
 * Supports both single-tab mode and driver-tab mode (reads from tabs matching driver names).
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
    const drivers = await prisma.driver.findMany({ select: { name: true }, where: { isActive: true } });
    const driverNames = new Set(drivers.map(d => d.name));
    const driverTabsSetting = await getSetting(SETTING_KEYS.driverTabs);
    const driverTabs = driverTabsSetting === '1';

    // Decide which tabs to read
    let tabs: string[] = [];
    if (driverTabs) {
      const allTabs = await listTabNames();
      tabs = allTabs.filter(t => driverNames.has(t.trim()));
      if (tabs.length === 0) {
        return NextResponse.json({
          success: false,
          error: `No tabs match active drivers. Driver-tab mode is ON. Available tabs: ${allTabs.map(t => `"${t}"`).join(', ')}. Active drivers: ${[...driverNames].map(d => `"${d}"`).join(', ')}. Make sure driver names match tab names exactly.`,
        }, { status: 400 });
      }
    } else {
      const tabName = await getTabName();
      tabs = [tabName];
    }

    // Process all tabs
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalRemoved = 0;
    const allErrors: { tab: string; row: number; error: string }[] = [];
    const tabWrites: { tab: string; updates: { row: number; col: number; value: string }[] }[] = [];
    const allSeenIds = new Set<string>();

    if (mode === 'replace') {
      const { count } = await prisma.job.deleteMany({ where: { runType: 'Master' } });
      totalRemoved = count;
    }

    for (const tab of tabs) {
      const rows = await readRows(tab);
      if (rows.length < 2) {
        allErrors.push({ tab, row: 0, error: 'Tab has no data rows below the header' });
        continue;
      }

      // Debug logging
      console.log(`[Sheets Import] Tab: ${tab}, Total rows: ${rows.length}`);
      for (let debug = 0; debug < Math.min(3, rows.length); debug++) {
        const nonEmpty = rows[debug].filter(c => c.trim()).length;
        console.log(`[Sheets Import] Row ${debug}: ${nonEmpty} non-empty cells, first 3: [${rows[debug].slice(0, 3).join(' | ')}]`);
      }

      // Find the header row by looking for rows with actual column headers
      // Skip rows that look like titles (single text spanning entire row)
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];

        // Skip rows with very few non-empty cells (likely titles)
        const nonEmpty = row.filter(cell => cell.trim().length > 0).length;
        if (nonEmpty < 3) continue;

        const cols = mapHeaders(row);
        // Header row must have at least 2 expected columns
        const matchingCols = Object.values(cols).length;
        console.log(`[Sheets Import] Row ${i} has ${matchingCols} recognized columns: ${Object.keys(cols).join(', ')}`);
        if (matchingCols >= 2) {
          headerRowIdx = i;
          console.log(`[Sheets Import] Selected row ${i} as header`);
          break;
        }
      }

      if (headerRowIdx === -1) {
        allErrors.push({ tab, row: 1, error: `Could not find header row. Searched ${Math.min(10, rows.length)} rows. Ensure sheet has proper column headers (Customer Name, Day, etc.)` });
        console.log(`[Sheets Import] ERROR: No header row found for tab ${tab}`);
        continue;
      }

      const header = rows[headerRowIdx];
      const cols = mapHeaders(header);

      // Check required columns
      // In driver-tab mode, driverName comes from tab name, but we still validate other required columns
      // In single-tab mode, driverName must be in the sheet
      const requiredCols = driverTabs
        ? ['customerName', 'day'] as const
        : ['driverName', 'customerName', 'day'] as const;

      let missingRequired = false;
      for (const required of requiredCols) {
        if (cols[required] === undefined) {
          allErrors.push({ tab, row: headerRowIdx + 1, error: `Missing required column: ${required}` });
          missingRequired = true;
        }
      }
      if (missingRequired) continue;

      // Ensure ID column exists
      let idCol = cols.id;
      const pendingWrites: { row: number; col: number; value: string }[] = [];
      if (idCol === undefined) {
        idCol = header.length;
        pendingWrites.push({ row: 0, col: idCol, value: 'ID' });
      }

      const cell = (row: string[], col: number | undefined) => (col === undefined ? '' : (row[col] ?? '').trim());

      // Get driver name for this tab (from tab name in driver-tab mode, or from column in single-tab mode)
      const tabDriverName = driverTabs ? tab.trim() : '';

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        const sheetRowNum = i + 1;

        const driverName = tabDriverName || cell(row, cols.driverName);
        const customerName = cell(row, cols.customerName);
        const day = cell(row, cols.day);

        // Skip empty rows
        if (!driverName && !customerName && !day) continue;

        // Validate driver
        if (!driverName || !driverNames.has(driverName)) {
          allErrors.push({ tab, row: sheetRowNum, error: driverName ? `Driver "${driverName}" not found` : 'Driver is required' });
          continue;
        }

        if (!customerName) {
          allErrors.push({ tab, row: sheetRowNum, error: 'Customer name is required' });
          continue;
        }

        if (!VALID_DAYS.includes(day)) {
          allErrors.push({ tab, row: sheetRowNum, error: `Day must be one of: ${VALID_DAYS.join(', ')}` });
          continue;
        }

        const jobType = cell(row, cols.jobType) || 'Service';
        if (!VALID_TYPES.includes(jobType)) {
          allErrors.push({ tab, row: sheetRowNum, error: `Job type must be one of: ${VALID_TYPES.join(', ')}` });
          continue;
        }

        let frequency = cell(row, cols.frequency);
        if (frequency === 'Weekly') frequency = '';
        if (!VALID_FREQS.includes(frequency)) {
          allErrors.push({ tab, row: sheetRowNum, error: 'Frequency must be: Weekly, Fortnightly, 3 Weekly, or 4 Weekly' });
          continue;
        }

        const callAheadRaw = cell(row, cols.callAhead).toLowerCase();
        const existingId = cell(row, idCol);

        const data = {
          driverName,
          customerName,
          day,
          jobType,
          jobOrder: Math.max(1, parseInt(cell(row, cols.jobOrder)) || 1),
          address: cell(row, cols.address),
          phone: cell(row, cols.phone),
          items: cell(row, cols.items),
          quantity: cell(row, cols.quantity),
          notes: cell(row, cols.notes),
          frequency,
          nextServiceDate: cell(row, cols.nextServiceDate),
          mapLink: cell(row, cols.mapLink),
          callAhead: callAheadRaw === 'true' || callAheadRaw === 'yes' || callAheadRaw === '1',
        };

        // Create or update job
        if (existingId) {
          allSeenIds.add(existingId);
          const existing = mode === 'replace'
            ? null
            : await prisma.job.findFirst({ where: { runType: 'Master', sheetRowId: existingId } });
          if (existing) {
            await prisma.job.update({ where: { id: existing.id }, data });
            totalUpdated++;
          } else {
            await prisma.job.create({ data: { ...(data as object), status: 'Pending', runType: 'Master', sheetRowId: existingId } as never });
            totalCreated++;
          }
        } else {
          const job = await prisma.job.create({ data: { ...(data as object), status: 'Pending', runType: 'Master' } as never });
          await prisma.job.update({ where: { id: job.id }, data: { sheetRowId: job.id } });
          pendingWrites.push({ row: i, col: idCol, value: job.id });
          allSeenIds.add(job.id);
          totalCreated++;
        }
      }

      if (pendingWrites.length > 0) {
        tabWrites.push({ tab, updates: pendingWrites });
      }
    }

    if (mode === 'sync') {
      const res = await prisma.job.deleteMany({
        where: { runType: 'Master', sheetRowId: { notIn: [...allSeenIds, ''] } },
      });
      totalRemoved = res.count;
    }

    if (dryRun) {
      const existingMasters = await prisma.job.count({ where: { runType: 'Master' } });
      return NextResponse.json({
        success: true,
        data: {
          tabs: tabs.join(', '),
          dryRun: true,
          mode,
          driverTabs,
          wouldImport: totalCreated,
          wouldRemove: mode === 'replace' ? existingMasters : 0,
          newIds: totalCreated,
          errors: allErrors,
        },
      });
    }

    // Write IDs back to sheets
    for (const { tab, updates } of tabWrites) {
      await writeCells(tab, updates);
    }

    return NextResponse.json({
      success: true,
      data: {
        tabs: tabs.join(', '),
        mode,
        driverTabs,
        created: totalCreated,
        updated: totalUpdated,
        removed: totalRemoved,
        errors: allErrors,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
