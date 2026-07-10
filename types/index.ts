export type JobStatus = 'Pending' | 'Done' | 'CouldNotAccess' | 'Issue';

export type JobFrequency = 'Weekly' | 'Fortnightly' | '3 Weekly' | '4 Weekly' | '';

export interface NotificationSentFlags {
  driverNewRun?: boolean;
  driverRunUpdated?: boolean;
  adminIssue?: boolean;
  adminCantAccess?: boolean;
  adminIncomplete?: boolean;
  customerCallAhead?: boolean;
}

export interface Job {
  id: string;
  driverName: string;
  jobOrder: number;
  day: string; // e.g. "Monday"
  jobType: string;
  customerName: string;
  address: string;
  phone: string;
  items: string;
  quantity: string;
  notes: string;
  frequency: JobFrequency;
  nextServiceDate: string; // ISO date string
  mapLink: string;
  callAhead: boolean;
  status: JobStatus;
  completionTime?: string;
  issueNotes?: string;
  notificationSentFlags: NotificationSentFlags;
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  pushSubscription?: PushSubscriptionData;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface Run {
  id: string;
  date: string;
  driverName: string;
  jobs: Job[];
  status: 'Tomorrow' | 'Daily' | 'Completed';
  promotedAt?: string;
  createdAt: string;
}

export interface RunLogEntry {
  id: string;
  jobId: string;
  driverName: string;
  customerName: string;
  address: string;
  jobType: string;
  completionTime: string;
  status: JobStatus;
  issueNotes?: string;
  day: string;
  date: string;
}

export interface AdminMessage {
  id: string;
  to: string; // driver name or 'all'
  message: string;
  sentAt: string;
  readAt?: string;
}

export interface NotificationLog {
  id: string;
  type: 'push' | 'email' | 'sms';
  recipient: string;
  subject: string;
  body: string;
  status: 'sent' | 'failed';
  sentAt: string;
  error?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DashboardStats {
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  issueJobs: number;
  cantAccessJobs: number;
  completionRate: number;
}
