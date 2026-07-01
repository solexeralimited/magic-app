'use client';
import { useState } from 'react';
import { Job } from '@/types';
import JobCard from './JobCard';
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';

interface JobListProps {
  jobs: Job[];
  onStatusChange: (id: string, status: Job['status'], notes?: string) => Promise<boolean>;
}

export default function JobList({ jobs, onStatusChange }: JobListProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  const active    = jobs.filter(j => j.status === 'Pending');
  const completed = jobs.filter(j => j.status !== 'Pending');

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
          No jobs today
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
          Check back later or contact the office
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active jobs */}
      {active.length > 0 && (
        <div className="space-y-3">
          {active.map((job, i) => (
            <div key={job.id} style={{ animationDelay: `${i * 0.05}s` }}>
              <JobCard job={job} onStatusChange={onStatusChange} />
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
