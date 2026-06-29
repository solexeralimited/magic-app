import { type ClassValue, clsx } from 'clsx';
import { Job, DashboardStats } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function computeStats(jobs: Job[]): DashboardStats {
  const total = jobs.length;
  const done = jobs.filter(j => j.status === 'Done').length;
  const issues = jobs.filter(j => j.status === 'Issue').length;
  const cantAccess = jobs.filter(j => j.status === 'CouldNotAccess').length;
  const pending = jobs.filter(j => j.status === 'Pending').length;
  return {
    totalJobs: total,
    completedJobs: done,
    pendingJobs: pending,
    issueJobs: issues,
    cantAccessJobs: cantAccess,
    completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

export function statusLabel(status: Job['status']): string {
  const map: Record<Job['status'], string> = {
    Pending: 'Pending',
    Done: 'Done',
    CouldNotAccess: 'Could Not Access',
    Issue: 'Issue',
  };
  return map[status];
}

export function statusColor(status: Job['status']): string {
  const map: Record<Job['status'], string> = {
    Pending: 'bg-yellow-100 text-yellow-800',
    Done: 'bg-green-100 text-green-800',
    CouldNotAccess: 'bg-orange-100 text-orange-800',
    Issue: 'bg-red-100 text-red-800',
  };
  return map[status];
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export function nextWorkday(from: Date = new Date()): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  while (isWeekend(next)) next.setDate(next.getDate() + 1);
  return next;
}
