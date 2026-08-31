import { describe, it, expect } from 'vitest';
import { nzToday, nzTomorrow } from '@/lib/utils';

const iso = (d: Date) => d.toISOString().split('T')[0];

// The server runs on UTC, 12h behind NZ in winter and 13h in summer. Deriving
// dates from the server clock is wrong for the whole NZ morning.
describe('NZ calendar dates', () => {
  it('9am Monday in Auckland is still Sunday on the server — today must be Monday', () => {
    const serverNow = new Date('2026-07-12T21:00:00Z'); // Sun 21:00 UTC = Mon 09:00 NZST
    expect(iso(nzToday(serverNow))).toBe('2026-07-13');   // Monday, not Sunday
    expect(iso(nzTomorrow(serverNow))).toBe('2026-07-14'); // Tuesday, not Monday
  });

  it('works the same across daylight saving (NZDT, UTC+13)', () => {
    const serverNow = new Date('2026-01-11T20:00:00Z'); // Sun 20:00 UTC = Mon 09:00 NZDT
    expect(iso(nzToday(serverNow))).toBe('2026-01-12');
    expect(iso(nzTomorrow(serverNow))).toBe('2026-01-13');
  });

  it('the nightly generate window lands on the right day in both seasons', () => {
    // 10:00 UTC — 22:00 NZST in winter, 23:00 NZDT in summer, same NZ day either way
    expect(iso(nzTomorrow(new Date('2026-07-13T10:00:00Z')))).toBe('2026-07-14');
    expect(iso(nzTomorrow(new Date('2026-01-12T10:00:00Z')))).toBe('2026-01-13');
  });

  it('rolls over the month and year correctly', () => {
    expect(iso(nzTomorrow(new Date('2026-12-31T00:00:00Z')))).toBe('2027-01-01'); // NZ already 31 Dec 13:00
  });

  it('tomorrow is always exactly one day after today', () => {
    for (const t of ['2026-03-01T12:00:00Z', '2026-09-26T14:00:00Z', '2026-04-04T14:00:00Z']) {
      const now = new Date(t);
      const diff = nzTomorrow(now).getTime() - nzToday(now).getTime();
      expect(diff).toBe(24 * 60 * 60 * 1000); // DST shifts must not leak in
    }
  });
});
