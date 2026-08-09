'use client';
import { Job } from '@/types';
import { qtyLabel } from './JobCard';
import { Package2 } from 'lucide-react';

// Job types that need the truck prepared the night before
const PREP_TYPES: Record<string, { color: string; bg: string }> = {
  Delivery: { color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
  Pickup:   { color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
  Adhoc:    { color: '#EA580C', bg: 'rgba(234,88,12,0.08)' },
};

/**
 * View-only summary at the top of Tomorrow's Run: every Delivery / Pickup / Adhoc
 * job duplicated for visibility so drivers can load the truck tonight. The same
 * jobs still appear in their normal position in the full run below.
 */
export default function PrepSummary({ jobs }: { jobs: Job[] }) {
  const sorted = [...jobs].sort((a, b) => a.jobOrder - b.jobOrder);
  const prepJobs = sorted.filter(j => PREP_TYPES[j.jobType]);
  if (prepJobs.length === 0) return null;

  const total = sorted.length;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <Package2 className="w-4 h-4" style={{ color: 'var(--amber)' }} />
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--amber)', fontFamily: 'var(--font-dm-sans)' }}>
          Tomorrow&apos;s Preparation
        </p>
        <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--amber)', fontSize: '10px' }}>
          {prepJobs.length}
        </span>
      </div>
      <div className="space-y-2">
        {prepJobs.map(job => {
          const t = PREP_TYPES[job.jobType];
          const position = sorted.findIndex(j => j.id === job.id) + 1;
          return (
            <div
              key={job.id}
              className="rounded-2xl p-3.5"
              style={{ background: t.bg, border: `1px solid ${t.color}40`, borderLeft: `3px solid ${t.color}` }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge" style={{ background: t.color, color: '#fff', fontSize: '10px' }}>{job.jobType}</span>
                <span className="text-xs font-bold" style={{ color: t.color, fontFamily: 'var(--font-sora)' }}>
                  Job #{job.jobOrder}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                  Job {position} of {total} in the run
                </span>
                {job.callAhead && (
                  <span className="badge" style={{ background: 'rgba(139,92,246,0.12)', color: '#7C3AED', fontSize: '10px' }}>📞 Call ahead</span>
                )}
              </div>
              {qtyLabel(job) && (
                <p className="text-sm font-bold mt-1.5" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>
                  {qtyLabel(job)}
                </p>
              )}
              <p className="text-sm mt-0.5" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>
                {job.customerName}
              </p>
              {job.address && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                  {job.address}
                </p>
              )}
              {job.notes && (
                <p className="text-xs mt-1.5 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(0,0,0,0.25)', color: '#FDE68A', fontFamily: 'var(--font-dm-sans)' }}>
                  Notes: {job.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
