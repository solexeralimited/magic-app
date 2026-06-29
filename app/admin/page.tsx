'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Truck, Play, ArrowRight, Users, AlertTriangle, CheckCircle2,
  Clock, Lock, Send, Bell, List, BarChart3, ArrowLeft, Loader2,
} from 'lucide-react';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import { Job, Driver, RunLogEntry, NotificationLog, ApiResponse } from '@/types';
import { computeStats, statusColor, statusLabel, formatTime, formatDate } from '@/lib/utils';

type Tab = 'dashboard' | 'jobs' | 'history' | 'messages' | 'notifications';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [generating, setGenerating] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [msgTo, setMsgTo] = useState('all');
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);

  const { data: driversData } = useSWR<ApiResponse<Driver[]>>('/api/drivers', fetcher);
  const drivers = driversData?.data ?? [];

  const { data: jobsData, mutate: mutateJobs } = useSWR<ApiResponse<Job[]>>(
    `/api/jobs?driver=${selectedDriver === 'all' ? drivers[0]?.name ?? '' : selectedDriver}`,
    fetcher,
    { refreshInterval: 15_000 }
  );
  const jobs = jobsData?.data ?? [];

  const { data: historyData } = useSWR<ApiResponse<RunLogEntry[]>>(
    tab === 'history' ? '/api/runs/history?days=14' : null,
    fetcher
  );
  const history = historyData?.data ?? [];

  const { data: notifData } = useSWR<ApiResponse<NotificationLog[]>>(
    tab === 'notifications' ? '/api/notifications/log' : null,
    fetcher
  );
  const notifLog = notifData?.data ?? [];

  const stats = computeStats(jobs);

  const flash = (text: string, ok: boolean) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/runs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminOverride: true }),
      });
      const json = await res.json();
      flash(json.success ? `✅ Generated ${json.data.count} jobs for tomorrow` : `❌ ${json.error}`, json.success);
    } finally {
      setGenerating(false);
    }
  };

  const handlePromote = async () => {
    setPromoting(true);
    try {
      const res = await fetch('/api/runs/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminOverride: true }),
      });
      const json = await res.json();
      flash(json.success ? `✅ Promoted ${json.data.count} jobs to daily runs` : `❌ ${json.error}`, json.success);
      if (json.success) mutateJobs();
    } finally {
      setPromoting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!msgText.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: msgTo, title: '📬 Message from Office', body: msgText, message: msgText }),
      });
      const json = await res.json();
      flash(json.success ? '✅ Message sent' : `❌ ${json.error}`, json.success);
      if (json.success) setMsgText('');
    } finally {
      setSending(false);
    }
  };

  const issueJobs = jobs.filter(j => j.status === 'Issue');
  const cantAccessJobs = jobs.filter(j => j.status === 'CouldNotAccess');

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Admin Dashboard"
        subtitle="Office Control"
        rightContent={
          <button onClick={() => router.push('/')} className="bg-white/20 rounded-full p-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
        }
      />

      {/* Action message */}
      {actionMsg && (
        <div className={`px-4 py-3 text-sm font-medium text-center ${actionMsg.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 sticky top-[60px] z-30">
        <div className="max-w-4xl mx-auto flex overflow-x-auto">
          {([
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'jobs', label: 'Jobs', icon: List },
            { id: 'history', label: 'History', icon: Clock },
            { id: 'messages', label: 'Message', icon: Send },
            { id: 'notifications', label: 'Notif. Log', icon: Bell },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-4 pb-10">

        {/* ── DASHBOARD TAB ── */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {/* Run controls */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Run Management
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex flex-col items-center gap-2 bg-blue-600 text-white p-4 rounded-2xl font-semibold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60"
                >
                  {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  <span className="text-sm">Generate Tomorrow</span>
                </button>
                <button
                  onClick={handlePromote}
                  disabled={promoting}
                  className="flex flex-col items-center gap-2 bg-green-600 text-white p-4 rounded-2xl font-semibold hover:bg-green-700 active:scale-95 transition-all disabled:opacity-60"
                >
                  {promoting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                  <span className="text-sm">Promote to Daily</span>
                </button>
              </div>
            </div>

            {/* Driver selector */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">View driver:</label>
              <select
                value={selectedDriver}
                onChange={e => setSelectedDriver(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {drivers.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatsCard label="Total Jobs" value={stats.totalJobs} color="blue" icon={<List className="w-4 h-4" />} />
              <StatsCard label="Completed" value={stats.completedJobs} color="green" icon={<CheckCircle2 className="w-4 h-4" />} />
              <StatsCard label="Pending" value={stats.pendingJobs} color="gray" icon={<Clock className="w-4 h-4" />} />
              <StatsCard label="Issues" value={stats.issueJobs} color="red" icon={<AlertTriangle className="w-4 h-4" />} />
              <StatsCard label="No Access" value={stats.cantAccessJobs} color="orange" icon={<Lock className="w-4 h-4" />} />
              <StatsCard label="Rate" value={`${stats.completionRate}%`} color="blue" icon={<BarChart3 className="w-4 h-4" />} />
            </div>

            {/* Issues alert */}
            {(issueJobs.length > 0 || cantAccessJobs.length > 0) && (
              <div className="space-y-3">
                {issueJobs.map(job => (
                  <div key={job.id} className="bg-red-50 border border-red-200 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-900">{job.customerName}</p>
                        <p className="text-sm text-red-700">{job.address}</p>
                        <p className="text-sm text-red-600 mt-1">{job.issueNotes || 'Issue reported'}</p>
                        <p className="text-xs text-red-400 mt-1">Driver: {job.driverName}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {cantAccessJobs.map(job => (
                  <div key={job.id} className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <Lock className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-orange-900">{job.customerName}</p>
                        <p className="text-sm text-orange-700">{job.address}</p>
                        <p className="text-xs text-orange-400 mt-1">Driver: {job.driverName}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── JOBS TAB ── */}
        {tab === 'jobs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <select
                value={selectedDriver}
                onChange={e => setSelectedDriver(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
              >
                {drivers.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500">{jobs.length} jobs</span>
            </div>
            {jobs.map(job => (
              <div key={job.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">#{job.jobOrder}</span>
                      <span className="text-xs text-gray-500">{job.jobType}</span>
                    </div>
                    <p className="font-semibold text-gray-900">{job.customerName}</p>
                    <p className="text-sm text-gray-500 truncate">{job.address}</p>
                    {job.completionTime && <p className="text-xs text-green-600 mt-1">✅ {formatTime(job.completionTime)}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor(job.status)}`}>
                    {statusLabel(job.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Last 14 days of completed jobs</p>
            {history.length === 0 && (
              <div className="text-center py-12 text-gray-400">No history yet</div>
            )}
            {history.map(entry => (
              <div key={entry.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{entry.customerName}</p>
                    <p className="text-sm text-gray-500">{entry.address}</p>
                    <p className="text-xs text-gray-400 mt-1">{entry.driverName} · {formatDate(entry.date)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor(entry.status)}`}>
                    {statusLabel(entry.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MESSAGES TAB ── */}
        {tab === 'messages' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                Send Message to Driver
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Send to:</label>
                  <select
                    value={msgTo}
                    onChange={e => setMsgTo(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="all">All Drivers</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
                  <textarea
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                    rows={4}
                    placeholder="Type your message..."
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !msgText.trim()}
                  className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Message
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── NOTIFICATION LOG TAB ── */}
        {tab === 'notifications' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{notifLog.length} notifications sent</p>
            {notifLog.slice(0, 50).map(n => (
              <div key={n.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">{n.type}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${n.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {n.status}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 text-sm">{n.subject}</p>
                    <p className="text-xs text-gray-500 truncate">{n.recipient}</p>
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap">{formatTime(n.sentAt)}</p>
                </div>
                {n.error && <p className="text-xs text-red-500 mt-2">{n.error}</p>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
