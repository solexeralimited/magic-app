'use client';
import { useState } from 'react';
import { Job } from '@/types';
import JobCard from './JobCard';
import SiteVisitCard from './SiteVisitCard';
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';

interface JobListProps {
  jobs: Job[];
  onStatusChange: (id: string, status: Job['status'], notes?: string) => Promise<boolean>;
  onBatchStatus?: (updates: { id: string; status: Job['status']; issueNotes?: string }[]) => Promise<boolean>;
  readOnly?: boolean;
  emptyMessage?: string;
  emptySubMessage?: string;
}

// One entry per position in the run: either a single job or a whole site visit
type RunEntry = { key: string; jobs: Job[] };

/** Group consecutive-by-site pending jobs: same customer + same address ⇒ one site card. */
function groupBySite(jobs: Job[]): RunEntry[] {
  const groups = new Map<string, Job[]>();
  for (const job of jobs) {
    const key = job.address.trim()
      ? `${job.customerName.trim().toLowerCase()}|${job.address.trim().toLowerCase()}`
      : `solo|${job.id}`;
    const list = groups.get(key);
    if (list) list.push(job);
    else groups.set(key, [job]);
  }
  return Array.from(groups.entries())
    .map(([key, list]) => ({ key, jobs: [...list].sort((a, b) => a.jobOrder - b.jobOrder) }))
    .sort((a, b) => a.jobs[0].jobOrder - b.jobs[0].jobOrder);
}

export default function JobList({ jobs, onStatusChange, onBatchStatus, readOnly, emptyMessage, emptySubMessage }: JobListProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  const active    = jobs.filter(j => j.status === 'Pending');
  const completed = jobs.filter(j => j.status !== 'Pending');
  const entries   = onBatchStatus && !readOnly
    ? groupBySite(active)
    : active.map(j => ({ key: j.id, jobs: [j] }));

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--shell-raised)', border: '1px solid var(--shell-border)' }}
        >
          <ClipboardList className="w-7 h-7" style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <p className="font-display font-semibold" style={{ color: 'var(--text-inverse)', fontSize: '16px', fontFamily: 'var(--font-sora)' }}>
          {emptyMessage ?? 'No jobs today'}
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
          {emptySubMessage ?? 'Check back later or contact the office'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active jobs — site visits collapse into one card */}
      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <div key={entry.key} style={{ animationDelay: `${i * 0.05}s` }}>
              {entry.jobs.length > 1 && onBatchStatus ? (
                <SiteVisitCard jobs={entry.jobs} onBatchStatus={onBatchStatus} />
              ) : (
                <JobCard job={entry.jobs[0]} onStatusChange={onStatusChange} readOnly={readOnly} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed section */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(s => !s)}
            className="w-full flex items-center justify-between px-1 py-2 mb-3 transition-opacity active:opacity-70"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--status-done)' }} />
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}
              >
                Completed
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{ background: 'rgba(16,185,129,0.14)', color: '#059669', fontFamily: 'var(--font-dm-sans)' }}
              >
                {completed.length}
              </span>
            </div>
            {showCompleted
              ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            }
          </button>

          {showCompleted && (
            <div className="space-y-3">
              {completed.map(job => (
                <JobCard key={job.id} job={job} onStatusChange={onStatusChange} isCompleted />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
