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

const DAYS       = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const FREQUENCIES = ['', 'Fortnightly', '3 Weekly', '4 Weekly'];
const JOB_TYPES  = ['Service', 'Delivery', 'Pickup', 'Adhoc'];

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface DriverRecord      { id: string; name: string; email?: string; phone?: string; isActive: boolean; hasPin: boolean; }
interface AdminUserRecord   { id: string; name: string; email: string; createdAt: string; }

// ── Shared input styles ──────────────────────────────────────────────────────
const inp  = 'input';
const lbl  = 'label';

// ── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto shadow-2xl" style={{ background: '#fff' }}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 z-10" style={{ background: '#fff', borderBottom: '1px solid var(--surface-border)' }}>
          <h2 className="font-display font-bold text-base" style={{ fontFamily: 'var(--font-sora)', color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors" style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Job Form ─────────────────────────────────────────────────────────────────
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
            <label className={lbl}>Driver</label>
            <select className={inp} value={form.driverName} onChange={e => set('driverName', e.target.value)} required>
              {drivers.filter(d => d.isActive).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Day</label>
            <select className={inp} value={form.day} onChange={e => set('day', e.target.value)}>
              {DAYS.map(d => <option key={d}>{d}</option>)}
            </select></div>
          <div><label className={lbl}>Order</label>
            <input className={inp} type="number" min={1} value={form.jobOrder} onChange={e => set('jobOrder', e.target.value)} /></div>
          <div><label className={lbl}>Job Type</label>
            <select className={inp} value={form.jobType} onChange={e => set('jobType', e.target.value)}>
              {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div><label className={lbl}>Frequency</label>
            <select className={inp} value={form.frequency} onChange={e => set('frequency', e.target.value)}>
              {FREQUENCIES.map(f => <option key={f} value={f}>{f || 'Weekly'}</option>)}
            </select></div>
          <div className="col-span-2"><label className={lbl}>Customer Name *</label>
            <input className={inp} value={form.customerName} onChange={e => set('customerName', e.target.value)} required /></div>
          <div className="col-span-2"><label className={lbl}>Address</label>
            <input className={inp} value={form.address} onChange={e => set('address', e.target.value)} /></div>
          <div><label className={lbl}>Phone</label>
            <input className={inp} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label className={lbl}>Next Service Date</label>
            <input className={inp} type="date" value={form.nextServiceDate} onChange={e => set('nextServiceDate', e.target.value)} /></div>
          <div className="col-span-2"><label className={lbl}>Items / Unit Type</label>
            <input className={inp} value={form.items} onChange={e => set('items', e.target.value)} /></div>
          <div className="col-span-2"><label className={lbl}>Notes</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div className="col-span-2"><label className={lbl}>Map Link</label>
            <input className={inp} type="url" value={form.mapLink} onChange={e => set('mapLink', e.target.value)} placeholder="https://maps.google.com/…" /></div>
          <div className="col-span-2 flex items-center gap-3">
            <input type="checkbox" id="ca" checked={form.callAhead} onChange={e => set('callAhead', e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
            <label htmlFor="ca" className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Call Ahead Required</label>
          </div>
        </div>
        <button type="submit" disabled={saving} className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all" style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}>
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
    <Modal title={initial ? `Edit — ${initial.name}` : 'Add Driver'} onClose={onClose}>
      <form onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave({ ...form, ...(initial ? { id: initial.id } : {}) }); setSaving(false); }} className="space-y-4">
        <div><label className={lbl}>Name *</label>
          <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} required disabled={!!initial} /></div>
        <div><label className={lbl}>Email</label>
          <input className={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
        <div><label className={lbl}>Phone</label>
          <input className={inp} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
        <div>
          <label className={lbl}>{initial ? 'New PIN (leave blank to keep)' : 'PIN (4–6 digits) *'}</label>
          <div className="relative">
            <input className={`${inp} pr-10 font-mono tracking-widest`} type={showPin ? 'text' : 'password'} inputMode="numeric"
              value={form.pin} onChange={e => set('pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={initial ? '••••' : 'Enter PIN'} required={!initial} />
            <button type="button" onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }}>
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {initial && (
          <div className="flex items-center gap-3">
            <input type="checkbox" id="active" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
            <label htmlFor="active" className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Account Active</label>
          </div>
        )}
        <button type="submit" disabled={saving} className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all" style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}>
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
        <div><label className={lbl}>Full Name *</label>
          <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} required /></div>
        <div><label className={lbl}>Email *</label>
          <input className={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} required /></div>
        <div>
          <label className={lbl}>{initial ? 'New Password (leave blank to keep)' : 'Password *'}</label>
          <div className="relative">
            <input className={`${inp} pr-10`} type={showPw ? 'text' : 'password'} value={form.password}
              onChange={e => set('password', e.target.value)} required={!initial} placeholder={initial ? 'Leave blank to keep' : 'Min 8 characters'} />
            <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }}>
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={saving} className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all" style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}>
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
  const [tab, setTab]             = useState<Tab>('dashboard');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [filterDay, setFilterDay]   = useState('');
  const [search, setSearch]         = useState('');
  const [generating, setGenerating] = useState(false);
  const [promoting, setPromoting]   = useState(false);
  const [actionMsg, setActionMsg]   = useState<{ text: string; ok: boolean } | null>(null);
  const [msgTo, setMsgTo]           = useState('all');
  const [msgText, setMsgText]       = useState('');
  const [sending, setSending]       = useState(false);
  const [jobModal, setJobModal]     = useState<{ open: boolean; job?: Partial<Job> & { id?: string } }>({ open: false });
  const [driverModal, setDriverModal] = useState<{ open: boolean; driver?: DriverRecord }>({ open: false });
  const [userModal, setUserModal]   = useState<{ open: boolean; user?: AdminUserRecord }>({ open: false });

  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--shell)' }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  );
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
  const { data: notifData }   = useSWR<ApiResponse<NotificationLog[]>>(tab === 'notifications' ? '/api/notifications/log' : null, fetcher);

  const stats = computeStats(dailyJobs);

  const flash = (text: string, ok: boolean) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const call = async (method: string, url: string, body: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  };

  const handleGenerate = async () => { setGenerating(true); const j = await call('POST', '/api/runs/generate', { adminOverride: true }); flash(j.success ? `✓ Generated ${j.data.count} jobs for tomorrow` : `✗ ${j.error}`, j.success); setGenerating(false); };
  const handlePromote  = async () => { setPromoting(true);  const j = await call('POST', '/api/runs/promote',  { adminOverride: true }); flash(j.success ? `✓ Promoted ${j.data.count} jobs` : `✗ ${j.error}`, j.success); if (j.success) mutateDaily(); setPromoting(false); };

  const handleSaveJob    = async (data: Record<string, unknown>) => { await call(data.id ? 'PUT' : 'POST', '/api/jobs/master', data); mutateMaster(); setJobModal({ open: false }); };
  const handleDeleteJob  = async (id: string) => { if (!confirm('Delete this job?')) return; await call('DELETE', '/api/jobs/master', { id }); mutateMaster(); };

  const handleSaveDriver       = async (data: Record<string, unknown>) => { const j = await call(data.id ? 'PUT' : 'POST', '/api/admin/drivers', data); if (j.success) { mutateDrivers(); setDriverModal({ open: false }); flash('✓ Driver saved', true); } else flash(`✗ ${j.error}`, false); };
  const handleDeactivateDriver = async (id: string, name: string) => { if (!confirm(`Deactivate ${name}?`)) return; await call('DELETE', '/api/admin/drivers', { id }); mutateDrivers(); flash(`✓ ${name} deactivated`, true); };

  const handleSaveUser   = async (data: Record<string, string>) => { const j = await call(data.id ? 'PUT' : 'POST', '/api/admin/users', data); if (j.success) { mutateUsers(); setUserModal({ open: false }); flash('✓ User saved', true); } else flash(`✗ ${j.error}`, false); };
  const handleDeleteUser = async (id: string) => { if (!confirm('Delete this admin user?')) return; const j = await call('DELETE', '/api/admin/users', { id }); if (j.success) { mutateUsers(); flash('✓ User deleted', true); } else flash(`✗ ${j.error}`, false); };

  const handleSendMessage = async () => {
    if (!msgText.trim()) return;
    setSending(true);
    const j = await call('POST', '/api/notifications/send', { to: msgTo, title: '📬 Message from Office', body: msgText, message: msgText });
    flash(j.success ? '✓ Message sent' : `✗ ${j.error}`, j.success);
    if (j.success) setMsgText('');
    setSending(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard',     label: 'Dashboard',   icon: BarChart3 },
    { id: 'jobs',          label: 'Jobs',         icon: List      },
    { id: 'drivers',       label: 'Drivers',      icon: Truck     },
    { id: 'users',         label: 'Admin Users',  icon: Shield    },
    { id: 'history',       label: 'History',      icon: Clock     },
    { id: 'messages',      label: 'Message',      icon: Send      },
    { id: 'notifications', label: 'Notif. Log',   icon: Bell      },
  ];

  const issueJobs     = dailyJobs.filter(j => j.status === 'Issue');
  const cantAccessJobs = dailyJobs.filter(j => j.status === 'CouldNotAccess');

  return (
    <div className="min-h-screen" style={{ background: 'var(--shell)' }}>
      <Header
        title="Admin"
        subtitle={`Thunderbox · ${session.user.name}`}
        rightContent={
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'var(--shell-raised)', border: '1px solid var(--shell-border)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        }
      />

      {/* Flash message */}
      {actionMsg && (
        <div
          className="px-4 py-2.5 text-sm font-semibold text-center transition-all"
          style={{
            background: actionMsg.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: actionMsg.ok ? '#34D399' : '#F87171',
            borderBottom: `1px solid ${actionMsg.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            fontFamily: 'var(--font-dm-sans)',
          }}
        >
          {actionMsg.text}
        </div>
      )}

      {/* Tab bar */}
      <div className="sticky top-14 z-30 overflow-x-auto" style={{ background: 'var(--shell-raised)', borderBottom: '1px solid var(--shell-border)' }}>
        <div className="flex max-w-5xl mx-auto px-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap flex-shrink-0 relative transition-colors"
              style={{
                fontFamily: 'var(--font-dm-sans)',
                color: tab === id ? 'var(--amber)' : 'var(--text-tertiary)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {tab === id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--amber)' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 pb-12 space-y-4">

        {/* ── DASHBOARD ──────────────────────────────────────────── */}
        {tab === 'dashboard' && (<>

          {/* Run controls */}
          <div className="card-shell p-5">
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
              Run Management
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--amber)', fontFamily: 'var(--font-dm-sans)' }}
              >
                {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                Generate Tomorrow
              </button>
              <button
                onClick={handlePromote}
                disabled={promoting}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34D399', fontFamily: 'var(--font-dm-sans)' }}
              >
                {promoting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                Promote to Daily
              </button>
            </div>
          </div>

          {/* Driver picker */}
          <div className="card-shell p-4">
            <label className={lbl} style={{ color: 'var(--text-tertiary)' }}>View driver stats</label>
            <select
              value={selectedDriver}
              onChange={e => setSelectedDriver(e.target.value)}
              className={inp}
              style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff' }}
            >
              {drivers.filter(d => d.isActive).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatsCard label="Total Jobs"  value={stats.totalJobs}      color="gray"   icon={<List className="w-4 h-4" />} />
            <StatsCard label="Completed"   value={stats.completedJobs}  color="green"  icon={<CheckCircle2 className="w-4 h-4" />} />
            <StatsCard label="Pending"     value={stats.pendingJobs}    color="amber"  icon={<Clock className="w-4 h-4" />} />
            <StatsCard label="Issues"      value={stats.issueJobs}      color="red"    icon={<AlertTriangle className="w-4 h-4" />} />
            <StatsCard label="No Access"   value={stats.cantAccessJobs} color="orange" icon={<Lock className="w-4 h-4" />} />
            <StatsCard label="Rate"        value={`${stats.completionRate}%`} color="green" icon={<BarChart3 className="w-4 h-4" />} />
          </div>

          {/* Alerts */}
          {(issueJobs.length > 0 || cantAccessJobs.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest px-1" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                Alerts
              </p>
              {issueJobs.map(job => (
                <div key={job.id} className="rounded-2xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="flex gap-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#EF4444' }} />
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#FCA5A5', fontFamily: 'var(--font-dm-sans)' }}>{job.customerName}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#F87171', fontFamily: 'var(--font-dm-sans)' }}>{job.address}</p>
                      <p className="text-xs mt-1" style={{ color: '#FCA5A5', fontFamily: 'var(--font-dm-sans)' }}>{job.issueNotes || 'Issue reported'} · {job.driverName}</p>
                    </div>
                  </div>
                </div>
              ))}
              {cantAccessJobs.map(job => (
                <div key={job.id} className="rounded-2xl p-4" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <div className="flex gap-3">
                    <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#F97316' }} />
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#FED7AA', fontFamily: 'var(--font-dm-sans)' }}>{job.customerName}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#FDBA74', fontFamily: 'var(--font-dm-sans)' }}>{job.address} · {job.driverName}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}

        {/* ── JOBS ───────────────────────────────────────────────── */}
        {tab === 'jobs' && (<>
          <div className="card-shell p-4 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  className={inp}
                  style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff', paddingLeft: '36px' }}
                  placeholder="Search customer or address…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button
                onClick={() => setJobModal({ open: true })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition-all"
                style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <div className="flex gap-2">
              <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)} className={`${inp} flex-1`} style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff' }}>
                <option value="">All Drivers</option>
                {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <select value={filterDay} onChange={e => setFilterDay(e.target.value)} className={`${inp} flex-1`} style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff' }}>
                <option value="">All Days</option>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
              {masterJobs.length} jobs
            </p>
          </div>

          <div className="space-y-2">
            {masterJobs.map(job => (
              <div key={job.id} className="card p-4 flex items-start gap-3">
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-xl font-display font-bold text-sm"
                  style={{ width: 36, height: 36, background: 'rgba(245,158,11,0.1)', color: 'var(--amber)', fontFamily: 'var(--font-sora)' }}
                >
                  {job.jobOrder}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1 mb-1">
                    <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: '#7C3AED', fontSize: '10px' }}>{job.driverName}</span>
                    <span className="badge" style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)', fontSize: '10px' }}>{job.day}</span>
                    <span className="badge" style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)', fontSize: '10px' }}>{job.jobType}</span>
                    {job.frequency && <span className="badge badge-pending">{job.frequency}</span>}
                    {job.callAhead && <span className="badge" style={{ background: 'rgba(236,72,153,0.1)', color: '#BE185D', fontSize: '10px' }}>📞 Call</span>}
                  </div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-dm-sans)' }}>{job.customerName}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}>{job.address}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => setJobModal({ open: true, job })} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all" style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteJob(job.id)} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all" style={{ background: 'rgba(239,68,68,0.06)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {masterJobs.length === 0 && (
              <div className="text-center py-16" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                <List className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No jobs found</p>
              </div>
            )}
          </div>
        </>)}

        {/* ── DRIVERS ────────────────────────────────────────────── */}
        {tab === 'drivers' && (<>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold" style={{ color: '#fff', fontFamily: 'var(--font-sora)', fontSize: '18px' }}>Drivers</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>Manage accounts and PINs</p>
            </div>
            <button
              onClick={() => setDriverModal({ open: true })}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
            >
              <Plus className="w-4 h-4" /> Add Driver
            </button>
          </div>

          <div className="space-y-2.5">
            {drivers.map(driver => (
              <div
                key={driver.id}
                className="card-shell flex items-center gap-4 p-4"
                style={{ opacity: driver.isActive ? 1 : 0.45 }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-xl"
                  style={{ width: 42, height: 42, background: driver.isActive ? 'rgba(245,158,11,0.12)' : 'var(--shell-border)', border: `1.5px solid ${driver.isActive ? 'rgba(245,158,11,0.3)' : 'var(--shell-border)'}` }}
                >
                  <Truck className="w-5 h-5" style={{ color: driver.isActive ? 'var(--amber)' : 'var(--text-tertiary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-sm" style={{ color: '#fff', fontFamily: 'var(--font-sora)' }}>{driver.name}</p>
                    {!driver.isActive && <span className="badge" style={{ background: 'var(--shell-border)', color: 'var(--text-tertiary)', fontSize: '10px' }}>Inactive</span>}
                    <span className={`badge ${driver.hasPin ? 'badge-done' : 'badge-pending'}`} style={{ fontSize: '10px' }}>
                      <KeyRound className="w-2.5 h-2.5" /> {driver.hasPin ? 'PIN set' : 'No PIN'}
                    </span>
                  </div>
                  {driver.email && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{driver.email}</p>}
                  {driver.phone && <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{driver.phone}</p>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setDriverModal({ open: true, driver })} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all" style={{ background: 'var(--shell-border)', color: 'var(--text-tertiary)' }}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {driver.isActive && (
                    <button onClick={() => handleDeactivateDriver(driver.id, driver.name)} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>)}

        {/* ── ADMIN USERS ────────────────────────────────────────── */}
        {tab === 'users' && (<>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold" style={{ color: '#fff', fontFamily: 'var(--font-sora)', fontSize: '18px' }}>Admin Users</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>Office staff with full access</p>
            </div>
            <button
              onClick={() => setUserModal({ open: true })}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
            >
              <Plus className="w-4 h-4" /> Add Admin
            </button>
          </div>
          <div className="space-y-2.5">
            {adminUsers.map(user => (
              <div key={user.id} className="card-shell flex items-center gap-4 p-4">
                <div className="flex-shrink-0 flex items-center justify-center rounded-xl" style={{ width: 42, height: 42, background: 'rgba(99,102,241,0.12)', border: '1.5px solid rgba(99,102,241,0.3)' }}>
                  <Shield className="w-5 h-5" style={{ color: '#818CF8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-bold text-sm" style={{ color: '#fff', fontFamily: 'var(--font-sora)' }}>{user.name}</p>
                    {user.email === session.user.email && (
                      <span className="badge" style={{ background: 'rgba(245,158,11,0.14)', color: 'var(--amber)', fontSize: '10px' }}>You</span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{user.email}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>Added {formatDate(user.createdAt)}</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setUserModal({ open: true, user })} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'var(--shell-border)', color: 'var(--text-tertiary)' }}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {user.email !== session.user.email && (
                    <button onClick={() => handleDeleteUser(user.id)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>)}

        {/* ── HISTORY ────────────────────────────────────────────── */}
        {tab === 'history' && (
          <div className="space-y-2.5">
            <p className="text-xs px-1" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>Last 14 days</p>
            {(historyData?.data ?? []).length === 0 && (
              <div className="text-center py-16" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No history yet</p>
              </div>
            )}
            {(historyData?.data ?? []).map(entry => (
              <div key={entry.id} className="card-shell p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>{entry.customerName}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{entry.address}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{entry.driverName} · {formatDate(entry.date)}</p>
                  </div>
                  <span className={`badge ${
                    entry.status === 'Done' ? 'badge-done' : entry.status === 'Issue' ? 'badge-issue' : entry.status === 'CouldNotAccess' ? 'badge-cant' : 'badge-pending'
                  }`}>
                    {statusLabel(entry.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MESSAGES ───────────────────────────────────────────── */}
        {tab === 'messages' && (
          <div className="card-shell p-5">
            <h2 className="font-display font-bold mb-4 flex items-center gap-2" style={{ color: '#fff', fontFamily: 'var(--font-sora)', fontSize: '16px' }}>
              <Send className="w-4 h-4" style={{ color: 'var(--amber)' }} />
              Send Message
            </h2>
            <div className="space-y-4">
              <div>
                <label className={lbl} style={{ color: 'var(--text-tertiary)' }}>Send to</label>
                <select value={msgTo} onChange={e => setMsgTo(e.target.value)} className={inp} style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff' }}>
                  <option value="all">All Drivers</option>
                  {drivers.filter(d => d.isActive).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl} style={{ color: 'var(--text-tertiary)' }}>Message</label>
                <textarea
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  className={inp}
                  style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff', resize: 'none' }}
                  rows={4}
                  placeholder="Type your message…"
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={sending || !msgText.trim()}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Message
              </button>
            </div>
          </div>
        )}

        {/* ── NOTIFICATION LOG ───────────────────────────────────── */}
        {tab === 'notifications' && (
          <div className="space-y-2.5">
            <p className="text-xs px-1" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
              {(notifData?.data ?? []).length} notifications sent
            </p>
            {(notifData?.data ?? []).slice(0, 50).map(n => (
              <div key={n.id} className="card-shell p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge" style={{ background: 'var(--shell-border)', color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase' }}>{n.type}</span>
                    <span className={`badge ${n.status === 'sent' ? 'badge-done' : 'badge-issue'}`} style={{ fontSize: '10px' }}>{n.status}</span>
                  </div>
                  <p className="font-medium text-sm truncate" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>{n.subject}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{n.recipient}</p>
                </div>
                <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{formatTime(n.sentAt)}</p>
              </div>
            ))}
          </div>
        )}

      </main>

      {jobModal.open    && <JobForm       initial={jobModal.job}    drivers={drivers} onSave={handleSaveJob}  onClose={() => setJobModal({ open: false })} />}
      {driverModal.open && <DriverForm    initial={driverModal.driver}              onSave={handleSaveDriver} onClose={() => setDriverModal({ open: false })} />}
      {userModal.open   && <AdminUserForm initial={userModal.user}                  onSave={handleSaveUser}   onClose={() => setUserModal({ open: false })} />}
    </div>
  );
}
