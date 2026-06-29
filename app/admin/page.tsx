'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Truck, Play, ArrowRight, AlertTriangle, CheckCircle2, Clock, Lock,
  Send, Bell, List, BarChart3, ArrowLeft, Loader2, Users, Plus,
  Trash2, Edit3, X, Check, Search, Filter, ChevronDown,
} from 'lucide-react';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import { Job, Driver, RunLogEntry, NotificationLog, ApiResponse } from '@/types';
import { computeStats, statusColor, statusLabel, formatTime, formatDate } from '@/lib/utils';

type Tab = 'dashboard' | 'jobs' | 'drivers' | 'history' | 'messages' | 'notifications';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const FREQUENCIES = ['', 'Fortnightly', '3 Weekly', '4 Weekly'];
const JOB_TYPES = ['Service', 'Delivery', 'Pickup', 'Adhoc'];

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ── Job Form Modal ────────────────────────────────────────────────────────────
interface JobFormProps {
  initial?: Partial<Job> & { id?: string };
  drivers: Driver[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

function JobForm({ initial, drivers, onSave, onClose }: JobFormProps) {
  const [form, setForm] = useState({
    driverName: initial?.driverName ?? drivers[0]?.name ?? '',
    jobOrder: initial?.jobOrder ?? 1,
    day: initial?.day ?? 'Monday',
    jobType: initial?.jobType ?? 'Service',
    customerName: initial?.customerName ?? '',
    address: initial?.address ?? '',
    phone: initial?.phone ?? '',
    items: initial?.items ?? '',
    notes: initial?.notes ?? '',
    frequency: initial?.frequency ?? '',
    nextServiceDate: initial?.nextServiceDate ?? '',
    mapLink: initial?.mapLink ?? '',
    callAhead: initial?.callAhead ?? false,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, ...(initial?.id ? { id: initial.id } : {}) });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{initial?.id ? 'Edit Job' : 'Add Job'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Driver</label>
              <select className="input" value={form.driverName} onChange={e => set('driverName', e.target.value)} required>
                {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Day</label>
              <select className="input" value={form.day} onChange={e => set('day', e.target.value)}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Job Order</label>
              <input className="input" type="number" min={1} value={form.jobOrder} onChange={e => set('jobOrder', e.target.value)} />
            </div>
            <div>
              <label className="label">Job Type</label>
              <select className="input" value={form.jobType} onChange={e => set('jobType', e.target.value)}>
                {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Frequency</label>
              <select className="input" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{f || 'Weekly (default)'}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Customer Name *</label>
              <input className="input" value={form.customerName} onChange={e => set('customerName', e.target.value)} required />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Next Service Date</label>
              <input className="input" type="date" value={form.nextServiceDate} onChange={e => set('nextServiceDate', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Items / Unit Type</label>
              <input className="input" value={form.items} onChange={e => set('items', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Map Link</label>
              <input className="input" type="url" value={form.mapLink} onChange={e => set('mapLink', e.target.value)} placeholder="https://maps.google.com/..." />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <input type="checkbox" id="callAhead" checked={form.callAhead} onChange={e => set('callAhead', e.target.checked)} className="w-5 h-5 rounded" />
              <label htmlFor="callAhead" className="text-sm font-medium text-gray-700">Call Ahead Required</label>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {initial?.id ? 'Save Changes' : 'Add Job'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Driver Form Modal ─────────────────────────────────────────────────────────
function DriverForm({ onSave, onClose }: { onSave: (d: Record<string, string>) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Add Driver</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Driver
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [msgTo, setMsgTo] = useState('all');
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<(Partial<Job> & { id?: string }) | null>(null);
  const [showDriverForm, setShowDriverForm] = useState(false);

  const { data: driversData, mutate: mutateDrivers } = useSWR<ApiResponse<Driver[]>>('/api/drivers', fetcher);
  const drivers = driversData?.data ?? [];

  const masterQuery = `/api/jobs/master?${selectedDriver ? `driver=${encodeURIComponent(selectedDriver)}` : ''}${filterDay ? `&day=${filterDay}` : ''}`;
  const { data: masterData, mutate: mutateMaster } = useSWR<ApiResponse<Job[]>>(
    tab === 'jobs' ? masterQuery : null,
    fetcher
  );
  const masterJobs = masterData?.data ?? [];

  const dailyDriver = selectedDriver || drivers[0]?.name || '';
  const { data: dailyData, mutate: mutateDaily } = useSWR<ApiResponse<Job[]>>(
    dailyDriver ? `/api/jobs?driver=${encodeURIComponent(dailyDriver)}` : null,
    fetcher,
    { refreshInterval: 15_000 }
  );
  const dailyJobs = dailyData?.data ?? [];

  const { data: historyData } = useSWR<ApiResponse<RunLogEntry[]>>(
    tab === 'history' ? '/api/runs/history?days=14' : null, fetcher
  );
  const { data: notifData } = useSWR<ApiResponse<NotificationLog[]>>(
    tab === 'notifications' ? '/api/notifications/log' : null, fetcher
  );

  const stats = computeStats(dailyJobs);
  const issueJobs = dailyJobs.filter(j => j.status === 'Issue');
  const cantAccessJobs = dailyJobs.filter(j => j.status === 'CouldNotAccess');

  const flash = (text: string, ok: boolean) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await fetch('/api/runs/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminOverride: true }) });
    const json = await res.json();
    flash(json.success ? `✅ Generated ${json.data.count} jobs for tomorrow` : `❌ ${json.error}`, json.success);
    setGenerating(false);
  };

  const handlePromote = async () => {
    setPromoting(true);
    const res = await fetch('/api/runs/promote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminOverride: true }) });
    const json = await res.json();
    flash(json.success ? `✅ Promoted ${json.data.count} jobs to daily runs` : `❌ ${json.error}`, json.success);
    if (json.success) mutateDaily();
    setPromoting(false);
  };

  const handleSendMessage = async () => {
    if (!msgText.trim()) return;
    setSending(true);
    const res = await fetch('/api/notifications/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: msgTo, title: '📬 Message from Office', body: msgText, message: msgText }) });
    const json = await res.json();
    flash(json.success ? '✅ Message sent' : `❌ ${json.error}`, json.success);
    if (json.success) setMsgText('');
    setSending(false);
  };

  const handleAddJob = async (data: Record<string, unknown>) => {
    await fetch('/api/jobs/master', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    mutateMaster();
    setShowJobForm(false);
  };

  const handleEditJob = async (data: Record<string, unknown>) => {
    await fetch('/api/jobs/master', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    mutateMaster();
    setEditingJob(null);
  };

  const handleDeleteJob = async (id: string) => {
    if (!confirm('Delete this job?')) return;
    await fetch('/api/jobs/master', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    mutateMaster();
  };

  const handleAddDriver = async (data: Record<string, string>) => {
    const res = await fetch('/api/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await res.json();
    if (json.success) { mutateDrivers(); setShowDriverForm(false); flash('✅ Driver added', true); }
    else flash(`❌ ${json.error}`, false);
  };

  const handleDeleteDriver = async (id: string, name: string) => {
    if (!confirm(`Delete driver ${name}? This cannot be undone.`)) return;
    await fetch('/api/drivers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    mutateDrivers();
    flash('✅ Driver removed', true);
  };

  const filteredJobs = masterJobs.filter(j =>
    !search || j.customerName.toLowerCase().includes(search.toLowerCase()) || j.address.toLowerCase().includes(search.toLowerCase())
  );

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'jobs', label: 'Jobs', icon: List },
    { id: 'drivers', label: 'Drivers', icon: Users },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'messages', label: 'Message', icon: Send },
    { id: 'notifications', label: 'Notif. Log', icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Admin Dashboard"
        subtitle="Thunderbox Operations"
        rightContent={
          <button onClick={() => router.push('/')} className="bg-white/20 rounded-full p-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
        }
      />

      {actionMsg && (
        <div className={`px-4 py-3 text-sm font-medium text-center ${actionMsg.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 sticky top-[60px] z-30">
        <div className="max-w-5xl mx-auto flex overflow-x-auto scrollbar-hide">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 pb-10">

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" /> Run Management
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleGenerate} disabled={generating} className="flex flex-col items-center gap-2 bg-blue-600 text-white p-4 rounded-2xl font-semibold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60">
                  {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  <span className="text-sm">Generate Tomorrow</span>
                </button>
                <button onClick={handlePromote} disabled={promoting} className="flex flex-col items-center gap-2 bg-green-600 text-white p-4 rounded-2xl font-semibold hover:bg-green-700 active:scale-95 transition-all disabled:opacity-60">
                  {promoting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                  <span className="text-sm">Promote to Daily</span>
                </button>
              </div>
            </div>

            {/* Driver selector for stats */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">View driver stats:</label>
              <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)} className="input">
                {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatsCard label="Total Jobs" value={stats.totalJobs} color="blue" icon={<List className="w-4 h-4" />} />
              <StatsCard label="Completed" value={stats.completedJobs} color="green" icon={<CheckCircle2 className="w-4 h-4" />} />
              <StatsCard label="Pending" value={stats.pendingJobs} color="gray" icon={<Clock className="w-4 h-4" />} />
              <StatsCard label="Issues" value={stats.issueJobs} color="red" icon={<AlertTriangle className="w-4 h-4" />} />
              <StatsCard label="No Access" value={stats.cantAccessJobs} color="orange" icon={<Lock className="w-4 h-4" />} />
              <StatsCard label="Rate" value={`${stats.completionRate}%`} color="blue" icon={<BarChart3 className="w-4 h-4" />} />
            </div>

            {(issueJobs.length > 0 || cantAccessJobs.length > 0) && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700">Alerts</h3>
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

        {/* ── JOBS (Master Schedule) ── */}
        {tab === 'jobs' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input pl-9" placeholder="Search customer or address..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button onClick={() => { setShowJobForm(true); setEditingJob(null); }} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 flex-shrink-0 hover:bg-blue-700">
                  <Plus className="w-4 h-4" /> Add Job
                </button>
              </div>
              <div className="flex gap-2">
                <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)} className="input flex-1 text-sm">
                  <option value="">All Drivers</option>
                  {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
                <select value={filterDay} onChange={e => setFilterDay(e.target.value)} className="input flex-1 text-sm">
                  <option value="">All Days</option>
                  {DAYS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <p className="text-xs text-gray-400">{filteredJobs.length} jobs in master schedule</p>
            </div>

            {/* Job list */}
            <div className="space-y-2">
              {filteredJobs.map(job => (
                <div key={job.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">#{job.jobOrder}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{job.day}</span>
                        <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{job.driverName}</span>
                        <span className="text-xs text-gray-500">{job.jobType}</span>
                        {job.frequency && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{job.frequency}</span>}
                        {job.callAhead && <span className="text-xs text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full">📞 Call Ahead</span>}
                      </div>
                      <p className="font-semibold text-gray-900 text-sm">{job.customerName}</p>
                      <p className="text-xs text-gray-500 truncate">{job.address}</p>
                      {job.items && <p className="text-xs text-gray-400 mt-0.5">{job.items}</p>}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => setEditingJob(job)} className="p-2 rounded-xl bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteJob(job.id)} className="p-2 rounded-xl bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredJobs.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <List className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No jobs found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DRIVERS ── */}
        {tab === 'drivers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{drivers.length} Drivers</h2>
              <button onClick={() => setShowDriverForm(true)} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 hover:bg-blue-700">
                <Plus className="w-4 h-4" /> Add Driver
              </button>
            </div>
            <div className="space-y-3">
              {drivers.map(driver => (
                <div key={driver.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center gap-4">
                  <div className="bg-blue-100 text-blue-700 rounded-xl p-3 flex-shrink-0">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{driver.name}</p>
                    {driver.email && <p className="text-sm text-gray-500">{driver.email}</p>}
                    {driver.phone && <p className="text-sm text-gray-500">{driver.phone}</p>}
                  </div>
                  <button onClick={() => handleDeleteDriver(driver.id, driver.name)} className="p-2 rounded-xl bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Last 14 days of completed jobs</p>
            {(historyData?.data ?? []).length === 0 && <div className="text-center py-12 text-gray-400">No history yet</div>}
            {(historyData?.data ?? []).map(entry => (
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

        {/* ── MESSAGES ── */}
        {tab === 'messages' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600" /> Send Message to Driver
            </h2>
            <div className="space-y-3">
              <div>
                <label className="label">Send to:</label>
                <select value={msgTo} onChange={e => setMsgTo(e.target.value)} className="input">
                  <option value="all">All Drivers</option>
                  {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Message:</label>
                <textarea value={msgText} onChange={e => setMsgText(e.target.value)} className="input resize-none" rows={4} placeholder="Type your message..." />
              </div>
              <button onClick={handleSendMessage} disabled={sending || !msgText.trim()} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Message
              </button>
            </div>
          </div>
        )}

        {/* ── NOTIFICATION LOG ── */}
        {tab === 'notifications' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{(notifData?.data ?? []).length} notifications sent</p>
            {(notifData?.data ?? []).slice(0, 50).map(n => (
              <div key={n.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-500 uppercase">{n.type}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${n.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{n.status}</span>
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

      {/* Modals */}
      {(showJobForm || editingJob) && (
        <JobForm
          initial={editingJob ?? undefined}
          drivers={drivers}
          onSave={editingJob ? handleEditJob : handleAddJob}
          onClose={() => { setShowJobForm(false); setEditingJob(null); }}
        />
      )}
      {showDriverForm && (
        <DriverForm onSave={handleAddDriver} onClose={() => setShowDriverForm(false)} />
      )}
    </div>
  );
}
