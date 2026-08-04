import { describe, it, expect } from 'vitest';
import { isJobDueForDate, isWeekend, nextWorkday, statusLabel } from '@/lib/utils';

const d = (s: string) => new Date(s);

describe('isJobDueForDate — recurring job due logic', () => {
  it('weekly jobs are always due', () => {
    expect(isJobDueForDate({ frequency: 'Weekly', nextServiceDate: '2099-01-01' }, d('2026-07-27'))).toBe(true);
    expect(isJobDueForDate({ frequency: '', nextServiceDate: '2099-01-01' }, d('2026-07-27'))).toBe(true);
  });

  it('fortnightly job with a future date is NOT due', () => {
    expect(isJobDueForDate({ frequency: 'Fortnightly', nextServiceDate: '2026-08-10' }, d('2026-07-27'))).toBe(false);
  });

  it('fortnightly job is due on its service date', () => {
    expect(isJobDueForDate({ frequency: 'Fortnightly', nextServiceDate: '2026-07-27' }, d('2026-07-27'))).toBe(true);
  });

  it('overdue jobs are due', () => {
    expect(isJobDueForDate({ frequency: '4 Weekly', nextServiceDate: '2026-07-01' }, d('2026-07-27'))).toBe(true);
  });

  it('recurring job without a date defaults to due', () => {
    expect(isJobDueForDate({ frequency: '3 Weekly', nextServiceDate: '' }, d('2026-07-27'))).toBe(true);
  });
});

describe('weekend handling', () => {
  it('detects weekends', () => {
    expect(isWeekend(d('2026-07-25'))).toBe(true);  // Saturday
    expect(isWeekend(d('2026-07-26'))).toBe(true);  // Sunday
    expect(isWeekend(d('2026-07-27'))).toBe(false); // Monday
  });

  it('nextWorkday skips the weekend', () => {
    expect(nextWorkday(d('2026-07-24')).getDay()).toBe(1); // Fri → Mon
  });
});

describe('status labels', () => {
  it('maps every status including NotRequired', () => {
    expect(statusLabel('NotRequired')).toBe('Not Required');
    expect(statusLabel('CouldNotAccess')).toBe('Could Not Access');
    expect(statusLabel('Done')).toBe('Done');
  });
});
