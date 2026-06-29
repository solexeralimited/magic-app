'use client';
import useSWR from 'swr';
import { Job, ApiResponse } from '@/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useJobs(driverName: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<Job[]>>(
    driverName ? `/api/jobs?driver=${encodeURIComponent(driverName)}` : null,
    fetcher,
    { refreshInterval: 30_000 } // poll every 30s
  );

  const updateJobStatus = async (
    jobId: string,
    status: Job['status'],
    issueNotes?: string
  ): Promise<boolean> => {
    // Optimistic update
    if (data?.data) {
      const updated = data.data.map(j =>
        j.id === jobId ? { ...j, status, issueNotes, updatedAt: new Date().toISOString() } : j
      );
      mutate({ ...data, data: updated }, false);
    }

    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, issueNotes }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      mutate(); // revalidate
      return true;
    } catch {
      mutate(); // revert optimistic
      return false;
    }
  };

  const jobs = data?.data ?? [];
  const activeJobs = jobs.filter(j => j.status === 'Pending');
  const completedJobs = jobs.filter(j => j.status !== 'Pending');

  return { jobs, activeJobs, completedJobs, isLoading, error, mutate, updateJobStatus };
}
