'use client';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LogOut, Bell, BellOff, MessageSquare, Loader2, X, Search } from 'lucide-react';
import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import JobList from '@/components/JobList';
import { useJobs } from '@/hooks/useJobs';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { AdminMessage, ApiResponse } from '@/types';

function IconBtn({ onClick, title, children }: { onClick?: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-95"
      style={{
        background: 'var(--shell-raised)',
        border: '1px solid var(--shell-border)',
        color: 'var(--text-tertiary)',
      }}
    >
      {children}
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const driverName = session?.user?.name ?? null;

  const { jobs, activeJobs, completedJobs, isLoading, mutate, updateJobStatus } = useJobs(driverName);
  const { permission, subscribe } = usePushNotifications(driverName);
  const [messages, setMessages]       = useState<AdminMessage[]>([]);
  const [showMessages, setShowMessages] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [search, setSearch]           = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status === 'authenticated' && session.user.role !== 'driver') router.replace('/admin');
  }, [status, session, router]);

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--shell)' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--amber)' }} />
      </div>
    );
  }

  if (!driverName) return null;

  const unread = messages.filter(m => !m.readAt).length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--shell)' }}>
      <Header
        title={driverName}
        subtitle={`${activeJobs.length} job${activeJobs.length !== 1 ? 's' : ''} remaining`}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        rightContent={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowMessages(s => !s)}
              className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{ background: 'var(--shell-raised)', border: '1px solid var(--shell-border)', color: 'var(--text-tertiary)' }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {unread > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold"
                  style={{ background: 'var(--amber)', color: '#000', fontSize: '10px' }}
                >
                  {unread}
                </span>
              )}
            </button>
            <IconBtn onClick={subscribe} title="Toggle notifications">
              {permission === 'granted'
                ? <Bell className="w-3.5 h-3.5" style={{ color: 'var(--amber)' }} />
                : <BellOff className="w-3.5 h-3.5" />
              }
            </IconBtn>
            <IconBtn onClick={() => signOut({ callbackUrl: '/login' })} title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
            </IconBtn>
          </div>
        }
      />

      {/* Messages drawer */}
      {showMessages && messages.length > 0 && (
        <div style={{ background: 'var(--shell-raised)', borderBottom: '1px solid var(--shell-border)' }}>
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--shell-border)' }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                Office Messages
              </span>
              <button onClick={() => setShowMessages(false)}>
                <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>
            {messages.slice(0, 5).map(msg => (
              <div key={msg.id} className="px-4 py-3" style={{ borderBottom: '1px solid var(--shell-border)' }}>
                <p className="text-sm" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>{msg.message}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                  {new Date(msg.sentAt).toLocaleString('en-NZ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Push notification prompt */}
      {permission === 'default' && (
        <div style={{ background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            <p className="text-sm" style={{ color: 'var(--amber)', fontFamily: 'var(--font-dm-sans)' }}>
              Enable notifications to get job updates
            </p>
            <button
              onClick={subscribe}
              className="text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 transition-all"
              style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
            >
              Enable
            </button>
          </div>
        </div>
      )}

      <ProgressBar completed={completedJobs.length} total={jobs.length} />

      <main className="max-w-2xl mx-auto p-4 pb-10">
        {/* Search */}
        {jobs.length > 0 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by customer or address…"
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--shell-raised)',
                border: '1px solid var(--shell-border)',
                color: '#fff',
                fontFamily: 'var(--font-dm-sans)',
              }}
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-36" />
            ))}
          </div>
        ) : (
          <JobList
            jobs={search ? jobs.filter(j =>
              j.customerName.toLowerCase().includes(search.toLowerCase()) ||
              j.address.toLowerCase().includes(search.toLowerCase())
            ) : jobs}
            onStatusChange={updateJobStatus}
          />
        )}
      </main>
    </div>
  );
}
