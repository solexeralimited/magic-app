import { describe, it, expect } from 'vitest';
import { groupBySite, qtyLabel } from '@/lib/utils';
import { Job } from '@/types';

function job(over: Partial<Job>): Job {
  return {
    id: Math.random().toString(36).slice(2),
    driverName: 'TK', jobOrder: 1, day: 'Monday', jobType: 'Service',
    customerName: 'ABC Construction', address: '12 Smith Road, Henderson',
    phone: '', items: '', quantity: '', notes: '', frequency: '',
    nextServiceDate: '', mapLink: '', callAhead: false, status: 'Pending',
    notificationSentFlags: {}, createdAt: '', updatedAt: '',
    ...over,
  };
}

describe('groupBySite — grouped site visits', () => {
  it('groups jobs with the same customer + address into one site', () => {
    const entries = groupBySite([
      job({ id: 'a', jobOrder: 3 }),
      job({ id: 'b', jobOrder: 1 }),
      job({ id: 'c', jobOrder: 2, customerName: 'Other Co', address: '99 Elsewhere St' }),
    ]);
    expect(entries).toHaveLength(2);
    const site = entries.find(e => e.jobs.length === 2);
    expect(site).toBeDefined();
    expect(site!.jobs.map(j => j.id)).toEqual(['b', 'a']); // sorted by jobOrder
  });

  it('is case- and whitespace-insensitive on the grouping key', () => {
    const entries = groupBySite([
      job({ id: 'a', customerName: 'ABC Construction ', address: '12 SMITH ROAD, Henderson' }),
      job({ id: 'b' }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].jobs).toHaveLength(2);
  });

  it('same address but different customer stays separate', () => {
    const entries = groupBySite([job({ id: 'a' }), job({ id: 'b', customerName: 'Different Ltd' })]);
    expect(entries).toHaveLength(2);
  });

  it('jobs without an address never group', () => {
    const entries = groupBySite([job({ id: 'a', address: '' }), job({ id: 'b', address: '  ' })]);
    expect(entries).toHaveLength(2);
  });

  it('orders entries by the first job in each site', () => {
    const entries = groupBySite([
      job({ id: 'x', jobOrder: 5, customerName: 'Zeta', address: '1 A St' }),
      job({ id: 'y', jobOrder: 1, customerName: 'Alpha', address: '2 B St' }),
    ]);
    expect(entries[0].jobs[0].id).toBe('y');
  });
});

describe('qtyLabel — quantity beside unit type', () => {
  it('combines quantity and unit type', () => {
    expect(qtyLabel({ quantity: '2', items: 'Non-Flush Units' })).toBe('2 × Non-Flush Units');
  });
  it('falls back to unit type alone', () => {
    expect(qtyLabel({ quantity: '', items: 'Handwash Station' })).toBe('Handwash Station');
  });
  it('falls back to quantity alone', () => {
    expect(qtyLabel({ quantity: '3', items: '' })).toBe('Qty: 3');
  });
  it('empty when neither is set', () => {
    expect(qtyLabel({ quantity: '', items: '' })).toBe('');
  });
});
