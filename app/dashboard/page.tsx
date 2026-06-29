'use client';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LogOut, Bell, BellOff, MessageSquare, Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import JobList from '@/components/JobList';
import { useJobs } from '@/hooks/useJobs';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { AdminMessage, ApiResponse } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const driverName = session?.user?.name ?? null;

  const { jobs, activeJobs, completedJobs, isLoading, mutate, updateJobStatus } = useJobs(driverName);
  const { permission, subscribe } = usePushNotifications(driverName);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [showMessages, setShowMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Redirect if not a driver
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status === 'authenticated' && session.user.role !== 'driver') router.replace('/admin');
  }, [status, session, router]);

  // Load messages
  useEffect(() => {
    if (!driverName) return;
    fetch(`/api/messages?driver=${encodeURIComponent(driverName)}`)
      .then(r => r.json() as Promise<ApiResponse<AdminMessage[]>>)
      .then(d => { if (d.success && d.data) setMessages(d.data); });
  }, [driverName]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await mutate();
    setRefreshing(false);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!driverName) return null;

  const unreadMessages = messages.filter(m => !m.readAt).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title={driverName}
        subtitle={`${activeJobs.length} job${activeJobs.length !== 1 ? 's' : ''} remaining`}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        rightContent={
          <div className="flex items-center gap-1">
            <button onClick={() => setShowMessages(s => !s)} className="relative bg-white/20 rounded-full p-2">
              <MessageSquare className="w-4 h-4" />
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {unreadMessages}
                </span>
              )}
            </button>
            <button onClick={subscribe} className="bg-white/20 rounded-full p-2" title="Toggle notifications">
              {permission === 'granted' ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="bg-white/20 rounded-full p-2">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {showMessages && messages.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-100 max-w-2xl mx-auto">
          {messages.slice(-5).map(msg => (
            <div key={msg.id} className="px-4 py-3 border-b border-blue-100 last:border-0">
              <p className="text-sm text-blue-900">{msg.message}</p>
              <p className="text-xs text-blue-400 mt-0.5">{new Date(msg.sentAt).toLocaleString('en-NZ')}</p>
            </div>
          ))}
        </div>
      )}

      {permission === 'default' && (
        <div className="bg-blue-600 text-white px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <p className="text-sm">Enable notifications to get job updates</p>
            <button onClick={subscribe} className="bg-white text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0">
              Enable
            </button>
          </div>
        </div>
      )}

      <ProgressBar completed={completedJobs.length} total={jobs.length} />

      <main className="max-w-2xl mx-auto p-4 pb-8">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-36 bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <JobList jobs={jobs} onStatusChange={updateJobStatus} />
        )}
      </main>
    </div>
  );
}
