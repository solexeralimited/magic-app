'use client';
import { Job } from '@/types';
import JobCard from './JobCard';
import { CheckCircle2, ClipboardList } from 'lucide-react';

interface JobListProps {
  jobs: Job[];
  onStatusChange: (id: string, status: Job['status'], notes?: string) => Promise<boolean>;
  showCompleted?: boolean;
}

export default function JobList({ jobs, onStatusChange, showCompleted }: JobListProps) {
  const active = jobs.filter(j => j.status === 'Pending');
  const completed = jobs.filter(j => j.status !== 'Pending');

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <ClipboardList className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-base font-medium">No jobs today</p>
        <p className="text-sm">Check back later or contact the office</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active jobs */}
      {active.length > 0 && (
        <div className="space-y-3">
          {active.map(job => (
            <JobCard key={job.id} job={job} onStatusChange={onStatusChange} />
          ))}
        </div>
      )}

      {/* Completed section */}
      {completed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Completed ({completed.length})
            </h2>
          </div>
          <div className="space-y-3">
            {completed.map(job => (
              <JobCard key={job.id} job={job} onStatusChange={onStatusChange} isCompleted />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
