'use client';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Truck, Play, ArrowRight, AlertTriangle, CheckCircle2, Clock, Lock,
  Send, Bell, List, BarChart3, Loader2, Users, Plus, Trash2, Edit3,
  X, Check, Search, Shield, KeyRound, LogOut, Eye, EyeOff,
} from 'lucide-react';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import { Job, RunLogEntry, NotificationLog, ApiResponse } from '@/types';
import { computeStats, statusColor, statusLabel, formatTime, formatDate } from '@/lib/utils';

type Tab = 'dashboard' | 'jobs' | 'drivers' | 'users' | 'history' | 'messages' | 'notifications';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const FREQUENCIES = ['', 'Fortnightly', '3 Weekly', '4 Weekly'];
const JOB_TYPES = ['Service', 'Delivery', 'Pickup', 'Adhoc'];

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface DriverRecord {
  id: string; name: string; email?: string; phone?: string;
  isActive: boolean; hasPin: boolean;
}
interface AdminUserRecord {
  id: string; name: string; email: string; createdAt: string;
}

// ── Reusable modal wrapper ────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-gray-900 text-base">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Job Form ──────────────────────────────────────────────────────────────────
function JobForm({ initial, drivers, onSave, onClose }: {
  initial?: Partial<Job> & { id?: string };
  drivers: DriverRecord[];
  onSave: (d: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
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

  return (
    <Modal title={initial?.id ? 'Edit Job' : 'Add Job'} onClose={onClose}>
      <form onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave({ ...form, ...(initial?.id ? { id: initial.id } : {}) }); setSaving(false); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Driver</label>
            <select className="input" value={form.driverName} onChange={e => set('driverName', e.target.value)} required>
              {drivers.filter(d => d.isActive).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div><label className="label">Day</label>
            <select className="input" value={form.day} onChange={e => set('day', e.target.value)}>
              {DAYS.map(d => <option key={d}>{d}</option>)}
            </select></div>
          <div><label className="label">Order</label>
            <input className="input" type="number" min={1} value={form.jobOrder} onChange={e => set('jobOrder', e.target.value)} /></div>
          <div><label className="label">Job Type</label>
            <select className="input" value={form.jobType} onChange={e => set('jobType', e.target.value)}>
              {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div><label className="label">Frequency</label>
            <select className="input" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
              {FREQUENCIES.map(f => <option key={f} value={f}>{f || 'Weekly'}</option>)}
            </select></div>
          <div className="col-span-2"><label className="label">Customer Name *</label>
            <input className="input" value={form.customerName} onChange={e => set('customerName', e.target.value)} required /></div>
          <div className="col-span-2"><label className="label">Address</label>
            <input className="input" value={form.address} onChange={e => set('address', e.target.value)} /></div>
          <div><label className="label">Phone</label>
            <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label className="label">Next Service Date</label>
            <input className="input" type="date" value={form.nextServiceDate} onChange={e => set('nextServiceDate', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Items / Unit Type</label>
            <input className="input" value={form.items} onChange={e => set('items', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div className="col-span-2"><label className="label">Map Link</label>
            <input className="input" type="url" value={form.mapLink} onChange={e => set('mapLink', e.target.value)} placeholder="https://maps.google.com/..." /></div>
          <div className="col-span-2 flex items-center gap-3">
            <input type="checkbox" id="ca" checked={form.callAhead} onChange={e => set('callAhead', e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
            <label htmlFor="ca" className="text-sm font-medium text-gray-700">Call Ahead Required</label>
          </div>
        </div>
        <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {initial?.id ? 'Save Changes' : 'Add Job'}
        </button>
      </form>
    </Modal>
  );
}

// ── Driver Form ───────────────────────────────────────────────────────────────
function DriverForm({ initial, onSave, onClose }: {
  initial?: DriverRecord;
  onSave: (d: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ name: initial?.name ?? '', email: initial?.email ?? '', phone: initial?.phone ?? '', pin: '', isActive: initial?.isActive ?? true });
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal title={initial ? `Edit Driver — ${initial.name}` : 'Add Driver'} onClose={onClose}>
      <form onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave({ ...form, ...(initial ? { id: initial.id } : {}) }); setSaving(false); }} className="space-y-4">
        <div><label className="label">Name *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required disabled={!!initial} /></div>
        <div><label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
        <div><label className="label">Phone</label>
          <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
        <div>
          <label className="label">{initial ? 'Set New PIN (leave blank to keep current)' : 'PIN (4–6 digits) *'}</label>
          <div className="relative">
            <input className="input pr-10 font-mono tracking-widest" type={showPin ? 'text' : 'password'} inputMode="numeric"
              value={form.pin} onChange={e => set('pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={initial ? '••••' : 'Enter PIN'} required={!initial} />
            <button type="button" onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Drivers use this PIN to log in to the driver app.</p>
        </div>
        {initial && (
          <div className="flex items-center gap-3">
            <input type="checkbox" id="active" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} className="w-5 h-5 rounded accent-blue-600" />
            <label htmlFor="active" className="text-sm font-medium text-gray-700">Account Active</label>
          </div>
        )}
        <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {initial ? 'Save Changes' : 'Add Driver'}
        </button>
      </form>
    </Modal>
  );
}

// ── Admin User Form ───────────────────────────────────────────────────────────
function AdminUserForm({ initial, onSave, onClose }: {
  initial?: AdminUserRecord;
  onSave: (d: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ name: initial?.name ?? '', email: initial?.email ?? '', password: '' });
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal title={initial ? 'Edit Admin User' : 'Add Admin User'} onClose={onClose}>
      <form onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave({ ...form, ...(initial ? { id: initial.id } : {}) }); setSaving(false); }} className="space-y-4">
        <div><label className="label">Full Name *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
        <div><label className="label">Email *</label>
          <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required /></div>
        <div>
          <label className="label">{initial ? 'New Password (leave blank to keep)' : 'Password *'}</label>
          <div className="relative">
            <input className="input pr-10" type={showPw ? 'text' : 'password'} value={form.password}
              onChange={e => set('password', e.target.value)} required={!initial} placeholder={initial ? 'Leave blank to keep' : 'Min 8 characters'} />
            <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          {initial ? 'Save Changes' : 'Create Admin'}
        </button>
      </form>
    </Modal>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
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
  const [jobModal, setJobModal] = useState<{ open: boolean; job?: Partial<Job> & { id?: string } }>({ open: false });
  const [driverModal, setDriverModal] = useState<{ open: boolean; driver?: DriverRecord }>({ open: false });
  const [userModal, setUserModal] = useState<{ open: boolean; user?: AdminUserRecord }>({ open: false });

  // Auth guard
  if (status === 'loading') return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (status === 'unauthenticated') { router.replace('/login'); return null; }
  if (session?.user.role !== 'admin') { router.replace('/dashboard'); return null; }

  const { data: driversData, mutate: mutateDrivers } = useSWR<{ success: boolean; data: DriverRecord[] }>('/api/admin/drivers', fetcher);
  const drivers = driversData?.data ?? [];

  const { data: adminUsersData, mutate: mutateUsers } = useSWR<{ success: boolean; data: AdminUserRecord[] }>(
    tab === 'users' ? '/api/admin/users' : null, fetcher
  );
  const adminUsers = adminUsersData?.data ?? [];

  const masterQuery = `/api/jobs/master?${selectedDriver ? `driver=${encodeURIComponent(selectedDriver)}` : ''}${filterDay ? `&day=${filterDay}` : ''}`;
  const { data: masterData, mutate: mutateMaster } = useSWR<ApiResponse<Job[]>>(
    tab === 'jobs' ? masterQuery : null, fetcher
  );
  const masterJobs = (masterData?.data ?? []).filter(j =>
    !search || j.customerName.toLowerCase().includes(search.toLowerCase()) || j.address.toLowerCase().includes(search.toLowerCase())
  );

  const dailyDriver = selectedDriver || drivers[0]?.name || '';
  const { data: dailyData, mutate: mutateDaily } = useSWR<ApiResponse<Job[]>>(
    dailyDriver ? `/api/jobs?driver=${encodeURIComponent(dailyDriver)}` : null,
    fetcher, { refreshInterval: 15_000 }
  );
  const dailyJobs = dailyData?.data ?? [];

  const { data: historyData } = useSWR<ApiResponse<RunLogEntry[]>>(tab === 'history' ? '/api/runs/history?days=14' : null, fetcher);
  const { data: notifData } = useSWR<ApiResponse<NotificationLog[]>>(tab === 'notifications' ? '/api/notifications/log' : null, fetcher);

  const stats = computeStats(dailyJobs);

  const flash = (text: string, ok: boolean) => { setActionMsg({ text, ok }); setTimeout(() => setActionMsg(null), 4000); };

  const call = async (method: string, url: string, body: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  };

  const handleGenerate = async () => { setGenerating(true); const j = await call('POST', '/api/runs/generate', { adminOverride: true }); flash(j.success ? `✅ Generated ${j.data.count} jobs for tomorrow` : `❌ ${j.error}`, j.success); setGenerating(false); };
  const handlePromote = async () => { setPromoting(true); const j = await call('POST', '/api/runs/promote', { adminOverride: true }); flash(j.success ? `✅ Promoted ${j.data.count} jobs` : `❌ ${j.error}`, j.success); if (j.success) mutateDaily(); setPromoting(false); };

  const handleSaveJob = async (data: Record<string, unknown>) => {
    await call(data.id ? 'PUT' : 'POST', '/api/jobs/master', data);
    mutateMaster(); setJobModal({ open: false });
  };
  const handleDeleteJob = async (id: string) => {
    if (!confirm('Delete this job from the master schedule?')) return;
    await call('DELETE', '/api/jobs/master', { id }); mutateMaster();
  };

  const handleSaveDriver = async (data: Record<string, unknown>) => {
    const j = await call(data.id ? 'PUT' : 'POST', '/api/admin/drivers', data);
    if (j.success) { mutateDrivers(); setDriverModal({ open: false }); flash('✅ Driver saved', true); }
    else flash(`❌ ${j.error}`, false);
  };
  const handleDeactivateDriver = async (id: string, name: string) => {
    if (!confirm(`Deactivate ${name}? They will no longer be able to log in.`)) return;
    await call('DELETE', '/api/admin/drivers', { id }); mutateDrivers(); flash(`✅ ${name} deactivated`, true);
  };

  const handleSaveUser = async (data: Record<string, string>) => {
    const j = await call(data.id ? 'PUT' : 'POST', '/api/admin/users', data);
    if (j.success) { mutateUsers(); setUserModal({ open: false }); flash('✅ User saved', true); }
    else flash(`❌ ${j.error}`, false);
  };
  const handleDeleteUser = async (id: string) => {
    if (!confirm('Delete this admin user?')) return;
    const j = await call('DELETE', '/api/admin/users', { id });
    if (j.success) { mutateUsers(); flash('✅ User deleted', true); }
    else flash(`❌ ${j.error}`, false);
  };

  const handleSendMessage = async () => {
    if (!msgText.trim()) return;
    setSending(true);
    const j = await call('POST', '/api/notifications/send', { to: msgTo, title: '📬 Message from Office', body: msgText, message: msgText });
    flash(j.success ? '✅ Message sent' : `❌ ${j.error}`, j.success);
    if (j.success) setMsgText('');
    setSending(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'jobs', label: 'Jobs', icon: List },
    { id: 'drivers', label: 'Drivers', icon: Truck },
    { id: 'users', label: 'Admin Users', icon: Shield },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'messages', label: 'Message', icon: Send },
    { id: 'notifications', label: 'Notif. Log', icon: Bell },
  ];

  const issueJobs = dailyJobs.filter(j => j.status === 'Issue');
  const cantAccessJobs = dailyJobs.filter(j => j.status === 'CouldNotAccess');

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Admin"
        subtitle={`Thunderbox · ${session.user.name}`}
        rightContent={
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="bg-white/20 rounded-full p-2 flex items-center gap-1.5 text-xs font-medium px-3">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        }
      />

      {actionMsg && (
        <div className={`px-4 py-2.5 text-sm font-medium text-center ${actionMsg.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-[60px] z-30">
        <div className="max-w-5xl mx-auto flex overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 pb-10 space-y-4">

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (<>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-blue-600" />Run Management</h2>
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

          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">View driver stats:</label>
            <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)} className="input">
              {drivers.filter(d => d.isActive).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
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
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">🚨 Alerts</h3>
              {issueJobs.map(job => (
                <div key={job.id} className="bg-red-50 border border-red-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div><p className="font-semibold text-red-900">{job.customerName}</p>
                      <p className="text-sm text-red-700">{job.address}</p>
                      <p className="text-sm text-red-600 mt-1">{job.issueNotes || 'Issue reported'}</p>
                      <p className="text-xs text-red-400 mt-1">Driver: {job.driverName}</p></div>
                  </div>
                </div>
              ))}
              {cantAccessJobs.map(job => (
                <div key={job.id} className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div><p className="font-semibold text-orange-900">{job.customerName}</p>
                      <p className="text-sm text-orange-700">{job.address}</p>
                      <p className="text-xs text-orange-400 mt-1">Driver: {job.driverName}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}

        {/* ── JOBS ── */}
        {tab === 'jobs' && (<>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input pl-9" placeholder="Search customer or address..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button onClick={() => setJobModal({ open: true })} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 flex-shrink-0">
                <Plus className="w-4 h-4" /> Add
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
            <p className="text-xs text-gray-400">{masterJobs.length} jobs</p>
          </div>

          <div className="space-y-2">
            {masterJobs.map(job => (
              <div key={job.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-1">
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
                    <button onClick={() => setJobModal({ open: true, job })} className="p-2 rounded-xl bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteJob(job.id)} className="p-2 rounded-xl bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
            {masterJobs.length === 0 && <div className="text-center py-12 text-gray-400"><List className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No jobs found</p></div>}
          </div>
        </>)}

        {/* ── DRIVERS ── */}
        {tab === 'drivers' && (<>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800">Drivers</h2>
              <p className="text-xs text-gray-400 mt-0.5">Manage driver accounts and PINs</p>
            </div>
            <button onClick={() => setDriverModal({ open: true })} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add Driver
            </button>
          </div>
          <div className="space-y-3">
            {drivers.map(driver => (
              <div key={driver.id} className={`bg-white rounded-2xl border p-4 shadow-sm flex items-center gap-4 ${!driver.isActive ? 'opacity-50 border-gray-100' : 'border-gray-200'}`}>
                <div className={`rounded-xl p-3 flex-shrink-0 ${driver.isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                  <Truck className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{driver.name}</p>
                    {!driver.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${driver.hasPin ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      <KeyRound className="w-3 h-3" />{driver.hasPin ? 'PIN set' : 'No PIN'}
                    </span>
                  </div>
                  {driver.email && <p className="text-sm text-gray-500">{driver.email}</p>}
                  {driver.phone && <p className="text-sm text-gray-500">{driver.phone}</p>}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => setDriverModal({ open: true, driver })} className="p-2 rounded-xl bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                  {driver.isActive && <button onClick={() => handleDeactivateDriver(driver.id, driver.name)} className="p-2 rounded-xl bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            ))}
          </div>
        </>)}

        {/* ── ADMIN USERS ── */}
        {tab === 'users' && (<>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800">Admin Users</h2>
              <p className="text-xs text-gray-400 mt-0.5">Office staff with full access</p>
            </div>
            <button onClick={() => setUserModal({ open: true })} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add Admin
            </button>
          </div>
          <div className="space-y-3">
            {adminUsers.map(user => (
              <div key={user.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center gap-4">
                <div className="bg-indigo-100 text-indigo-700 rounded-xl p-3 flex-shrink-0"><Shield className="w-6 h-6" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{user.name}</p>
                    {user.email === session.user.email && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">You</span>}
                  </div>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  <p className="text-xs text-gray-400">Added {formatDate(user.createdAt)}</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setUserModal({ open: true, user })} className="p-2 rounded-xl bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                  {user.email !== session.user.email && (
                    <button onClick={() => handleDeleteUser(user.id)} className="p-2 rounded-xl bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>)}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Last 14 days</p>
            {(historyData?.data ?? []).length === 0 && <div className="text-center py-12 text-gray-400">No history yet</div>}
            {(historyData?.data ?? []).map(entry => (
              <div key={entry.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{entry.customerName}</p>
                    <p className="text-sm text-gray-500">{entry.address}</p>
                    <p className="text-xs text-gray-400 mt-1">{entry.driverName} · {formatDate(entry.date)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor(entry.status)}`}>{statusLabel(entry.status)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MESSAGES ── */}
        {tab === 'messages' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Send className="w-5 h-5 text-blue-600" />Send Message to Driver</h2>
            <div className="space-y-3">
              <div><label className="label">Send to:</label>
                <select value={msgTo} onChange={e => setMsgTo(e.target.value)} className="input">
                  <option value="all">All Drivers</option>
                  {drivers.filter(d => d.isActive).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select></div>
              <div><label className="label">Message:</label>
                <textarea value={msgText} onChange={e => setMsgText(e.target.value)} className="input resize-none" rows={4} placeholder="Type your message..." /></div>
              <button onClick={handleSendMessage} disabled={sending || !msgText.trim()} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send Message
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
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {jobModal.open && <JobForm initial={jobModal.job} drivers={drivers} onSave={handleSaveJob} onClose={() => setJobModal({ open: false })} />}
      {driverModal.open && <DriverForm initial={driverModal.driver} onSave={handleSaveDriver} onClose={() => setDriverModal({ open: false })} />}
      {userModal.open && <AdminUserForm initial={userModal.user} onSave={handleSaveUser} onClose={() => setUserModal({ open: false })} />}
    </div>
  );
}
