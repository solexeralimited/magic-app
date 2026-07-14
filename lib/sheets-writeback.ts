import { prisma } from './prisma';
import { sheetsConfigured, getTabName, readRows, writeCells, mapHeaders } from './google-sheets';

export interface WriteBackResult {
  skipped?: string;
  written?: number;
  notFound?: number;
}

/**
 * Write today's job outcomes back to the Google Sheet.
 * For every Daily job with a status other than Pending and a sheetRowId,
 * updates the Status and Last Completed columns on the matching row
 * (matched by the ID column). Missing columns are appended to the header row.
 */
export async function writeBackResults(): Promise<WriteBackResult> {
  if (!sheetsConfigured()) return { skipped: 'Google Sheets not configured' };

  const jobs = await prisma.job.findMany({
    where: { runType: 'Daily', status: { not: 'Pending' }, sheetRowId: { not: '' } },
    select: { sheetRowId: true, status: true, completionTime: true },
  });
  if (jobs.length === 0) return { skipped: 'no completed jobs with sheet links' };

  const tab = await getTabName();
  const rows = await readRows(tab);
  if (rows.length === 0) return { skipped: 'sheet is empty' };

  const header = rows[0];
  const cols = mapHeaders(header);
  if (cols.id === undefined) return { skipped: 'sheet has no ID column — run an import first' };

  const updates: { row: number; col: number; value: string }[] = [];
  let nextNewCol = header.length;
  let statusCol = cols.status;
  if (statusCol === undefined) {
    statusCol = nextNewCol++;
    updates.push({ row: 0, col: statusCol, value: 'Status' });
  }
  let completedCol = cols.lastCompleted;
  if (completedCol === undefined) {
    completedCol = nextNewCol++;
    updates.push({ row: 0, col: completedCol, value: 'Last Completed' });
  }

  const rowById = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    const id = (rows[i][cols.id] ?? '').trim();
    if (id) rowById.set(id, i);
  }

  let written = 0;
  let notFound = 0;
  for (const job of jobs) {
    const rowIndex = rowById.get(job.sheetRowId);
    if (rowIndex === undefined) {
      notFound++;
      continue;
    }
    const completedAt = job.completionTime
      ? job.completionTime.toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })
      : '';
    updates.push({ row: rowIndex, col: statusCol, value: job.status });
    updates.push({ row: rowIndex, col: completedCol, value: completedAt });
    written++;
  }

  await writeCells(tab, updates);
  return { written, notFound };
}
