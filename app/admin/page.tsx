'use client';
import { useState, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Truck, Play, ArrowRight, AlertTriangle, CheckCircle2, Clock, Lock,
  Send, Bell, List, BarChart3, Loader2, Plus, Trash2, Edit3,
  X, Check, Search, Shield, KeyRound, LogOut, Eye, EyeOff,
  Upload, Copy, Key, FileUp, GripVertical, Users2, LayoutGrid, Table2, Download,
} from 'lucide-react';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import { Job, RunLogEntry, NotificationLog, ApiResponse } from '@/types';
import { computeStats, statusColor, statusLabel, formatTime, formatDate } from '@/lib/utils';

type Tab = 'dashboard' | 'jobs' | 'drivers' | 'users' | 'history' | 'messages' | 'notifications' | 'import';

interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
}

// ── CSV parser ───────────────────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (line[i] === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += line[i];
  }
  result.push(cur);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]));
  });
}

const DAYS       = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const FREQUENCIES = ['', 'Fortnightly', '3 Weekly', '4 Weekly'];
const JOB_TYPES  = ['Service', 'Delivery', 'Pickup', 'Adhoc'];

const fetcher = (url: string) => fetch(url).then(r => r.json());

function csvEsc(v: string | number | boolean | null | undefined) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const content = [headers.join(','), ...rows.map(r => r.map(csvEsc).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

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
    quantity: (initial as Job & { quantity?: string })?.quantity ?? '',
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
          <div><label className={lbl}>Items / Unit Type</label>
            <input className={inp} value={form.items} onChange={e => set('items', e.target.value)} /></div>
          <div><label className={lbl}>Quantity</label>
            <input className={inp} value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="e.g. 3 bins" /></div>
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

// ── Sortable Job Item ─────────────────────────────────────────────────────────
function SortableJobItem({ job, onEdit, onDelete }: { job: Job; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: 'relative', zIndex: isDragging ? 999 : undefined }}
      className="card p-4 flex items-start gap-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 flex items-center justify-center rounded-lg cursor-grab active:cursor-grabbing mt-0.5 touch-none"
        style={{ width: 28, height: 28, background: 'var(--surface-subtle)', color: 'var(--text-tertiary)', border: '1px solid var(--surface-border)' }}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <div className="flex-shrink-0 flex items-center justify-center rounded-xl font-display font-bold text-sm"
        style={{ width: 36, height: 36, background: 'rgba(245,158,11,0.1)', color: 'var(--amber)', fontFamily: 'var(--font-sora)' }}>
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
        <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all" style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all" style={{ background: 'rgba(239,68,68,0.06)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
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
  const [dailySearch, setDailySearch] = useState('');
  // History filters
  const [histSearch, setHistSearch]       = useState('');
  const [histDriver, setHistDriver]       = useState('');
  const [histStatus, setHistStatus]       = useState('');
  const [histJobType, setHistJobType]     = useState('');
  // Reallocation
  const [selectMode, setSelectMode]       = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [reallocDriver, setReallocDriver] = useState('');
  const [reallocating, setReallocating]   = useState(false);
  // Sortable jobs for drag-and-drop
  const [sortableJobs, setSortableJobs]   = useState<Job[]>([]);
  const masterJobsRef                     = useRef<Job[]>([]);
  const [reordering, setReordering]       = useState(false);
  const [jobView, setJobView]             = useState<'card' | 'sheet'>('card');
  const [generating, setGenerating] = useState(false);
  const [promoting, setPromoting]   = useState(false);
  const [actionMsg, setActionMsg]   = useState<{ text: string; ok: boolean } | null>(null);
  const [msgTo, setMsgTo]           = useState('all');
  const [msgText, setMsgText]       = useState('');
  const [sending, setSending]       = useState(false);
  const [jobModal, setJobModal]     = useState<{ open: boolean; job?: Partial<Job> & { id?: string } }>({ open: false });
  const [driverModal, setDriverModal] = useState<{ open: boolean; driver?: DriverRecord }>({ open: false });
  const [userModal, setUserModal]   = useState<{ open: boolean; user?: AdminUserRecord }>({ open: false });

  // Import tab state
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows]         = useState<Record<string, string>[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [importMode, setImportMode]   = useState<'append' | 'replace'>('append');
  const [importing, setImporting]     = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { row: number; field: string; error: string }[] } | null>(null);

  // API key state
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKey, setCreatedKey]   = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);

  // Task Bar state: jobId → selected driver for assignment
  const [taskBarAssign, setTaskBarAssign] = useState<Record<string, string>>({});

  // All hooks must come before any early returns (React rules of hooks)
  const isAdmin = status === 'authenticated' && session?.user.role === 'admin';

  const { data: driversData, mutate: mutateDrivers } = useSWR<{ success: boolean; data: DriverRecord[] }>(isAdmin ? '/api/admin/drivers' : null, fetcher);
  const drivers = driversData?.data ?? [];

  const { data: adminUsersData, mutate: mutateUsers } = useSWR<{ success: boolean; data: AdminUserRecord[] }>(
    isAdmin && tab === 'users' ? '/api/admin/users' : null, fetcher
  );
  const adminUsers = adminUsersData?.data ?? [];

  const masterQuery = `/api/jobs/master?${selectedDriver ? `driver=${encodeURIComponent(selectedDriver)}` : ''}${filterDay ? `&day=${filterDay}` : ''}`;
  const { data: masterData, mutate: mutateMaster } = useSWR<ApiResponse<Job[]>>(
    isAdmin && tab === 'jobs' ? masterQuery : null, fetcher
  );

  const dailyDriver = selectedDriver || drivers[0]?.name || '';
  const { data: dailyData, mutate: mutateDaily } = useSWR<ApiResponse<Job[]>>(
    isAdmin && dailyDriver ? `/api/jobs?driver=${encodeURIComponent(dailyDriver)}` : null,
    fetcher, { refreshInterval: 15_000 }
  );

  const { data: historyData } = useSWR<ApiResponse<RunLogEntry[]>>(isAdmin && tab === 'history' ? '/api/runs/history?days=14' : null, fetcher);
  const { data: notifData }   = useSWR<ApiResponse<NotificationLog[]>>(isAdmin && tab === 'notifications' ? '/api/notifications/log' : null, fetcher);
  const { data: apiKeysData, mutate: mutateKeys } = useSWR<{ success: boolean; data: ApiKeyRecord[] }>(
    isAdmin && tab === 'import' ? '/api/api-keys' : null, fetcher
  );
  const apiKeys = apiKeysData?.data ?? [];

  const { data: unscheduledData, mutate: mutateUnscheduled } = useSWR<ApiResponse<Job[]>>(
    isAdmin && tab === 'dashboard' ? '/api/jobs/unscheduled' : null, fetcher, { refreshInterval: 10_000 }
  );

  const { data: allDailyData, mutate: mutateAllDaily } = useSWR<ApiResponse<Job[]>>(
    isAdmin && tab === 'dashboard' && selectedDriver === '' ? '/api/jobs/daily' : null,
    fetcher, { refreshInterval: 15_000 }
  );

  const { data: tomorrowPreviewData } = useSWR<ApiResponse<Job[]>>(
    isAdmin && tab === 'dashboard' ? '/api/jobs/daily?runType=Tomorrow' : null,
    fetcher, { refreshInterval: 60_000 }
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSortableJobs(prev => {
      const base = prev.length > 0 ? prev : masterJobsRef.current;
      const oldIdx = base.findIndex(j => j.id === active.id);
      const newIdx = base.findIndex(j => j.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return base;
      return arrayMove(base, oldIdx, newIdx);
    });
  }, []);

  // Early returns come after all hooks
  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--shell)' }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  );
  if (status === 'unauthenticated') { router.replace('/login'); return null; }
  if (session?.user.role !== 'admin') { router.replace('/dashboard'); return null; }

  const masterJobsRaw = masterData?.data ?? [];
  masterJobsRef.current = masterJobsRaw;
  const masterJobs = masterJobsRaw.filter(j =>
    !search || j.customerName.toLowerCase().includes(search.toLowerCase()) || j.address.toLowerCase().includes(search.toLowerCase())
  );
  const displayJobs = search ? masterJobs : sortableJobs.length > 0 ? sortableJobs : masterJobsRaw;

  const dailyJobs = dailyData?.data ?? [];
  const unscheduledJobs = unscheduledData?.data ?? [];

  // Per-driver summary for "All Drivers" view
  const allDailyJobs = allDailyData?.data ?? [];
  const driverSummaries = (() => {
    const map = new Map<string, { total: number; done: number; issues: number; cantAccess: number }>();
    for (const j of allDailyJobs) {
      const prev = map.get(j.driverName) ?? { total: 0, done: 0, issues: 0, cantAccess: 0 };
      prev.total += 1;
      if (j.status === 'Done') prev.done += 1;
      else if (j.status === 'Issue') prev.issues += 1;
      else if (j.status === 'CouldNotAccess') prev.cantAccess += 1;
      map.set(j.driverName, prev);
    }
    return Array.from(map.entries()).map(([name, s]) => ({ name, ...s }));
  })();

  const stats = computeStats(dailyJobs);
  const filteredHistory = (historyData?.data ?? []).filter(e => {
    if (histSearch && !e.customerName.toLowerCase().includes(histSearch.toLowerCase()) && !e.address.toLowerCase().includes(histSearch.toLowerCase())) return false;
    if (histDriver && e.driverName !== histDriver) return false;
    if (histStatus && e.status !== histStatus) return false;
    if (histJobType && e.jobType !== histJobType) return false;
    return true;
  });
  const filteredDailyJobs = dailyJobs.filter(j =>
    !dailySearch ||
    j.customerName.toLowerCase().includes(dailySearch.toLowerCase()) ||
    j.address.toLowerCase().includes(dailySearch.toLowerCase())
  );

  const flash = (text: string, ok: boolean) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const call = async (method: string, url: string, body: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  };

  const handleGenerate = async () => { setGenerating(true); const j = await call('POST', '/api/runs/generate', { adminOverride: true }); flash(j.success ? `✓ Generated ${j.data.count} jobs for tomorrow` : `✗ ${j.error}`, j.success); setGenerating(false); };
  const handlePromote  = async () => { setPromoting(true);  const j = await call('POST', '/api/runs/promote',  { adminOverride: true }); flash(j.success ? `✓ Promoted ${j.data.count} jobs` : `✗ ${j.error}`, j.success); if (j.success) { mutateDaily(); mutateAllDaily(); } setPromoting(false); };

  const handleSaveJob    = async (data: Record<string, unknown>) => { await call(data.id ? 'PUT' : 'POST', '/api/jobs/master', data); setSortableJobs([]); mutateMaster(); setJobModal({ open: false }); };
  const handleDeleteJob  = async (id: string) => { if (!confirm('Delete this job?')) return; await call('DELETE', '/api/jobs/master', { id }); setSortableJobs([]); mutateMaster(); };

  const handleSaveDriver       = async (data: Record<string, unknown>) => { const j = await call(data.id ? 'PUT' : 'POST', '/api/admin/drivers', data); if (j.success) { mutateDrivers(); setDriverModal({ open: false }); flash('✓ Driver saved', true); } else flash(`✗ ${j.error}`, false); };
  const handleDeactivateDriver = async (id: string, name: string) => { if (!confirm(`Deactivate ${name}?`)) return; await call('DELETE', '/api/admin/drivers', { id }); mutateDrivers(); flash(`✓ ${name} deactivated`, true); };

  const handleSaveUser   = async (data: Record<string, string>) => { const j = await call(data.id ? 'PUT' : 'POST', '/api/admin/users', data); if (j.success) { mutateUsers(); setUserModal({ open: false }); flash('✓ User saved', true); } else flash(`✗ ${j.error}`, false); };
  const handleDeleteUser = async (id: string) => { if (!confirm('Delete this admin user?')) return; const j = await call('DELETE', '/api/admin/users', { id }); if (j.success) { mutateUsers(); flash('✓ User deleted', true); } else flash(`✗ ${j.error}`, false); };

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    setCsvFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseCSV(e.target?.result as string);
      setCsvRows(rows);
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (csvRows.length === 0) return;
    setImporting(true);
    setImportResult(null);
    const res = await fetch('/api/jobs/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs: csvRows, mode: importMode }),
    });
    const j = await res.json();
    setImportResult(j);
    if (j.success && j.imported > 0) { flash(`✓ Imported ${j.imported} jobs`, true); mutateMaster(); }
    setImporting(false);
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    const res = await fetch('/api/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newKeyName.trim() }) });
    const j = await res.json();
    if (j.success) { setCreatedKey(j.data.key); setNewKeyName(''); mutateKeys(); }
    else flash(`✗ ${j.error}`, false);
    setCreatingKey(false);
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? It will stop working immediately.')) return;
    await fetch('/api/api-keys', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    mutateKeys();
    flash('✓ Key revoked', true);
  };

  const handleCopyKey = () => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleSendMessage = async () => {
    if (!msgText.trim()) return;
    setSending(true);
    const j = await call('POST', '/api/notifications/send', { to: msgTo, title: '📬 Message from Office', body: msgText, message: msgText });
    flash(j.success ? '✓ Message sent' : `✗ ${j.error}`, j.success);
    if (j.success) setMsgText('');
    setSending(false);
  };

  const handleReallocate = async () => {
    if (!reallocDriver || selectedJobIds.size === 0) return;
    setReallocating(true);
    const j = await call('PATCH', '/api/jobs', { jobIds: [...selectedJobIds], driverName: reallocDriver });
    flash(j.success ? `✓ Reallocated ${selectedJobIds.size} job(s) to ${reallocDriver}` : `✗ ${j.error}`, j.success);
    if (j.success) { setSelectedJobIds(new Set()); setSelectMode(false); mutateDaily(); mutateAllDaily(); }
    setReallocating(false);
  };

  const handleReschedule = async (jobId: string) => {
    const res = await fetch('/api/jobs/unscheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: jobId }),
    });
    const j = await res.json();
    flash(j.success ? '✓ Job moved to Task Bar' : `✗ ${j.error}`, j.success);
    if (j.success) { mutateDaily(); mutateUnscheduled(); }
  };

  const handleAssignJob = async (jobId: string) => {
    const driverName = taskBarAssign[jobId];
    if (!driverName) return;
    const res = await fetch('/api/jobs/unscheduled', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: jobId, driverName }),
    });
    const j = await res.json();
    flash(j.success ? `✓ Assigned to ${driverName}` : `✗ ${j.error}`, j.success);
    if (j.success) {
      mutateDaily();
      mutateUnscheduled();
      setTaskBarAssign(prev => { const n = { ...prev }; delete n[jobId]; return n; });
    }
  };

  const handleSaveOrder = async () => {
    const toSave = sortableJobs.length > 0 ? sortableJobs : masterJobsRef.current;
    if (toSave.length === 0) return;
    setReordering(true);
    const updates = toSave.map((j, i) => ({ id: j.id, jobOrder: i + 1 }));
    const j = await call('PATCH', '/api/jobs/master', { action: 'reorder', jobs: updates });
    flash(j.success ? '✓ Order saved' : `✗ ${j.error}`, j.success);
    if (j.success) { setSortableJobs([]); mutateMaster(); }
    setReordering(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard',     label: 'Dashboard',   icon: BarChart3 },
    { id: 'jobs',          label: 'Jobs',         icon: List      },
    { id: 'drivers',       label: 'Drivers',      icon: Truck     },
    { id: 'users',         label: 'Admin Users',  icon: Shield    },
    { id: 'history',       label: 'History',      icon: Clock     },
    { id: 'messages',      label: 'Message',      icon: Send      },
    { id: 'notifications', label: 'Notif. Log',   icon: Bell      },
    { id: 'import',        label: 'Import & API', icon: Upload    },
  ];

  // Tomorrow preview summary
  const tomorrowPreviewJobs = tomorrowPreviewData?.data ?? [];
  const tomorrowByDriver = (() => {
    const map = new Map<string, number>();
    for (const j of tomorrowPreviewJobs) map.set(j.driverName, (map.get(j.driverName) ?? 0) + 1);
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  })();

  // When in all-drivers mode, show alerts across the whole fleet
  const alertSource = selectedDriver === '' ? allDailyJobs : dailyJobs;
  const issueJobs      = alertSource.filter(j => j.status === 'Issue');
  const cantAccessJobs = alertSource.filter(j => j.status === 'CouldNotAccess');

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

          {/* Tomorrow preview — only shown if there's a generated run */}
          {tomorrowPreviewJobs.length > 0 && (
            <div className="card-shell p-4" style={{ borderLeft: '3px solid rgba(16,185,129,0.5)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#34D399', fontFamily: 'var(--font-dm-sans)' }}>
                  Tomorrow&apos;s Run — Ready to Promote
                </p>
                <span className="badge badge-done" style={{ fontSize: '10px' }}>{tomorrowPreviewJobs.length} jobs</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tomorrowByDriver.map(({ name, count }) => (
                  <div key={name} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)' }}>
                    <span className="text-xs font-semibold" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>{name}</span>
                    <span className="text-xs font-bold rounded-full px-1.5" style={{ background: 'rgba(16,185,129,0.15)', color: '#34D399', fontFamily: 'var(--font-dm-sans)' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Driver picker */}
          <div className="card-shell p-4">
            <label className={lbl} style={{ color: 'var(--text-tertiary)' }}>View driver</label>
            <select
              value={selectedDriver}
              onChange={e => setSelectedDriver(e.target.value)}
              className={inp}
              style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff' }}
            >
              <option value="">All Drivers</option>
              {drivers.filter(d => d.isActive).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>

          {/* All-drivers progress grid */}
          {selectedDriver === '' && (
            <div className="space-y-2">
              {allDailyJobs.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                  No daily run active — generate and promote a run first
                </p>
              ) : driverSummaries.map(d => {
                const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
                return (
                  <div
                    key={d.name}
                    className="card-shell p-4 cursor-pointer transition-all"
                    onClick={() => setSelectedDriver(d.name)}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--amber)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>{d.name}</p>
                      <div className="flex items-center gap-2">
                        {d.issues > 0 && (
                          <span className="badge badge-issue" style={{ fontSize: '10px' }}>{d.issues} issue{d.issues !== 1 ? 's' : ''}</span>
                        )}
                        {d.cantAccess > 0 && (
                          <span className="badge badge-cant" style={{ fontSize: '10px' }}>{d.cantAccess} no access</span>
                        )}
                        <span className="text-xs font-semibold" style={{ color: pct === 100 ? '#34D399' : 'var(--amber)', fontFamily: 'var(--font-dm-sans)' }}>
                          {d.done}/{d.total}
                        </span>
                      </div>
                    </div>
                    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--shell-border)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: pct === 100 ? '#10B981' : 'var(--amber)' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats grid — single driver */}
          {selectedDriver !== '' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatsCard label="Total Jobs"  value={stats.totalJobs}      color="gray"   icon={<List className="w-4 h-4" />} />
              <StatsCard label="Completed"   value={stats.completedJobs}  color="green"  icon={<CheckCircle2 className="w-4 h-4" />} />
              <StatsCard label="Pending"     value={stats.pendingJobs}    color="amber"  icon={<Clock className="w-4 h-4" />} />
              <StatsCard label="Issues"      value={stats.issueJobs}      color="red"    icon={<AlertTriangle className="w-4 h-4" />} />
              <StatsCard label="No Access"   value={stats.cantAccessJobs} color="orange" icon={<Lock className="w-4 h-4" />} />
              <StatsCard label="Rate"        value={`${stats.completionRate}%`} color="green" icon={<BarChart3 className="w-4 h-4" />} />
            </div>
          )}

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
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: '#FCA5A5', fontFamily: 'var(--font-dm-sans)' }}>{job.customerName}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#F87171', fontFamily: 'var(--font-dm-sans)' }}>{job.address}</p>
                      <p className="text-xs mt-1" style={{ color: '#FCA5A5', fontFamily: 'var(--font-dm-sans)' }}>{job.issueNotes || 'Issue reported'} · {job.driverName}</p>
                    </div>
                    <button
                      onClick={() => handleReschedule(job.id)}
                      className="flex-shrink-0 self-start text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                      style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.25)', fontFamily: 'var(--font-dm-sans)' }}
                    >
                      Reschedule
                    </button>
                  </div>
                </div>
              ))}
              {cantAccessJobs.map(job => (
                <div key={job.id} className="rounded-2xl p-4" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <div className="flex gap-3">
                    <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#F97316' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: '#FED7AA', fontFamily: 'var(--font-dm-sans)' }}>{job.customerName}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#FDBA74', fontFamily: 'var(--font-dm-sans)' }}>{job.address} · {job.driverName}</p>
                    </div>
                    <button
                      onClick={() => handleReschedule(job.id)}
                      className="flex-shrink-0 self-start text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                      style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.25)', fontFamily: 'var(--font-dm-sans)' }}
                    >
                      Reschedule
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Task Bar — unscheduled jobs waiting to be assigned */}
          {unscheduledJobs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2 px-1">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--amber)', fontFamily: 'var(--font-dm-sans)' }}>
                  Task Bar
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                  {unscheduledJobs.length} job{unscheduledJobs.length !== 1 ? 's' : ''} waiting to be assigned
                </p>
              </div>
              {unscheduledJobs.map(job => (
                <div
                  key={job.id}
                  className="card-shell p-4 space-y-3"
                  style={{ borderLeft: '3px solid var(--amber)' }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-lg text-xs font-bold"
                      style={{ width: 30, height: 30, background: 'rgba(245,158,11,0.12)', color: 'var(--amber)', fontFamily: 'var(--font-sora)' }}
                    >
                      {job.jobOrder}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>{job.customerName}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{job.address}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <span className="badge" style={{ background: 'var(--shell-border)', color: 'var(--text-tertiary)', fontSize: '10px' }}>{job.jobType}</span>
                        <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: '#7C3AED', fontSize: '10px' }}>was {job.driverName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={taskBarAssign[job.id] || ''}
                      onChange={e => setTaskBarAssign(prev => ({ ...prev, [job.id]: e.target.value }))}
                      className={`${inp} flex-1`}
                      style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: taskBarAssign[job.id] ? '#fff' : 'var(--text-tertiary)' }}
                    >
                      <option value="">Assign to driver…</option>
                      {drivers.filter(d => d.isActive).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                    <button
                      onClick={() => handleAssignJob(job.id)}
                      disabled={!taskBarAssign[job.id]}
                      className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex-shrink-0"
                      style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
                    >
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Today's jobs with search + reallocation */}
          {dailyJobs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                  Today&apos;s Jobs
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                    {filteredDailyJobs.length} / {dailyJobs.length}
                  </span>
                  <button
                    onClick={() => { setSelectMode(s => !s); setSelectedJobIds(new Set()); }}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                    style={{
                      background: selectMode ? 'rgba(245,158,11,0.15)' : 'var(--shell-border)',
                      color: selectMode ? 'var(--amber)' : 'var(--text-tertiary)',
                      border: selectMode ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                  >
                    <Users2 className="w-3 h-3" />
                    {selectMode ? 'Cancel' : 'Reassign'}
                  </button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  type="search"
                  value={dailySearch}
                  onChange={e => setDailySearch(e.target.value)}
                  placeholder="Search customer or address…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--shell-raised)', border: '1px solid var(--shell-border)', color: '#fff', fontFamily: 'var(--font-dm-sans)' }}
                />
              </div>
              {selectMode && (
                <p className="text-xs px-1" style={{ color: 'var(--amber)', fontFamily: 'var(--font-dm-sans)' }}>
                  {selectedJobIds.size > 0 ? `${selectedJobIds.size} selected — pick a driver below` : 'Tap jobs to select for reassignment'}
                </p>
              )}
              <div className="space-y-2">
                {filteredDailyJobs.map(job => {
                  const isSelected = selectedJobIds.has(job.id);
                  return (
                    <div
                      key={job.id}
                      className="card-shell p-3 flex items-center gap-3 transition-all"
                      style={{ cursor: selectMode ? 'pointer' : undefined, outline: isSelected ? '2px solid var(--amber)' : undefined, outlineOffset: '-2px' }}
                      onClick={selectMode ? () => setSelectedJobIds(prev => {
                        const next = new Set(prev);
                        if (next.has(job.id)) next.delete(job.id); else next.add(job.id);
                        return next;
                      }) : undefined}
                    >
                      {selectMode && (
                        <div
                          className="flex-shrink-0 flex items-center justify-center rounded-md transition-all"
                          style={{ width: 20, height: 20, background: isSelected ? 'var(--amber)' : 'var(--shell-raised)', border: `1.5px solid ${isSelected ? 'var(--amber)' : 'var(--shell-border)'}` }}
                        >
                          {isSelected && <Check className="w-3 h-3" style={{ color: '#000' }} />}
                        </div>
                      )}
                      <div
                        className="flex-shrink-0 flex items-center justify-center rounded-lg text-xs font-bold"
                        style={{ width: 30, height: 30, background: `${statusColor(job.status)}18`, color: statusColor(job.status), fontFamily: 'var(--font-sora)' }}
                      >
                        {job.jobOrder}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>{job.customerName}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{job.address} · {job.driverName}</p>
                      </div>
                      <span className={`badge ${
                        job.status === 'Done' ? 'badge-done' : job.status === 'Issue' ? 'badge-issue' : job.status === 'CouldNotAccess' ? 'badge-cant' : 'badge-pending'
                      }`} style={{ flexShrink: 0, fontSize: '10px' }}>
                        {statusLabel(job.status)}
                      </span>
                    </div>
                  );
                })}
                {filteredDailyJobs.length === 0 && (
                  <p className="text-center text-sm py-6" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>No jobs match search</p>
                )}
              </div>
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
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                {masterJobs.length} jobs
              </p>
              <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)' }}>
                <button
                  onClick={() => setJobView('card')}
                  className="flex items-center justify-center w-7 h-7 rounded-md transition-all"
                  style={{ background: jobView === 'card' ? 'var(--amber)' : 'transparent', color: jobView === 'card' ? '#000' : 'var(--text-tertiary)' }}
                  title="Card view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setJobView('sheet')}
                  className="flex items-center justify-center w-7 h-7 rounded-md transition-all"
                  style={{ background: jobView === 'sheet' ? 'var(--amber)' : 'transparent', color: jobView === 'sheet' ? '#000' : 'var(--text-tertiary)' }}
                  title="Sheet view"
                >
                  <Table2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {jobView === 'card' && (<>
            {!search && displayJobs.length > 0 && (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>Drag rows to reorder</p>
                <button
                  onClick={handleSaveOrder}
                  disabled={reordering}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#34D399', border: '1px solid rgba(16,185,129,0.2)', fontFamily: 'var(--font-dm-sans)' }}
                >
                  {reordering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save Order
                </button>
              </div>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={displayJobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {displayJobs.map(job => (
                    <SortableJobItem
                      key={job.id}
                      job={job}
                      onEdit={() => setJobModal({ open: true, job })}
                      onDelete={() => handleDeleteJob(job.id)}
                    />
                  ))}
                  {displayJobs.length === 0 && (
                    <div className="text-center py-16" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                      <List className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No jobs found</p>
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </>)}

          {jobView === 'sheet' && (
            <div className="card-shell overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--shell-border)' }}>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{displayJobs.length} jobs</span>
                <button
                  onClick={() => downloadCsv(
                    'thunderbox-jobs.csv',
                    ['#', 'Customer', 'Address', 'Driver', 'Day', 'Type', 'Frequency', 'Phone', 'Items', 'Notes'],
                    displayJobs.map(j => [j.jobOrder, j.customerName, j.address, j.driverName, j.day, j.jobType, j.frequency ?? '', j.phone ?? '', j.items ?? '', j.notes ?? ''])
                  )}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                  style={{ background: 'rgba(16,185,129,0.08)', color: '#34D399', border: '1px solid rgba(16,185,129,0.2)', fontFamily: 'var(--font-dm-sans)' }}
                >
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ fontFamily: 'var(--font-dm-sans)', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--shell-border)', background: 'var(--shell-raised)' }}>
                      {['#', 'Customer', 'Address', 'Driver', 'Day', 'Type', 'Freq', 'Phone', ''].map(h => (
                        <th
                          key={h}
                          className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--text-tertiary)', fontSize: '10px', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayJobs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>No jobs found</td>
                      </tr>
                    ) : displayJobs.map((job, i) => (
                      <tr
                        key={job.id}
                        style={{
                          borderBottom: i < displayJobs.length - 1 ? '1px solid var(--shell-border)' : undefined,
                          background: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : undefined,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? 'rgba(255,255,255,0.015)' : '')}
                      >
                        <td className="px-3 py-2.5 font-mono font-bold" style={{ color: 'var(--amber)', fontVariantNumeric: 'tabular-nums', fontSize: '11px' }}>
                          {job.jobOrder}
                        </td>
                        <td className="px-3 py-2.5 font-semibold max-w-[140px]" style={{ color: '#fff' }}>
                          <span className="block truncate">{job.customerName}</span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[160px]" style={{ color: 'var(--text-tertiary)' }}>
                          <span className="block truncate">{job.address}</span>
                        </td>
                        <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{job.driverName}</td>
                        <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{job.day}</td>
                        <td className="px-3 py-2.5" style={{ whiteSpace: 'nowrap' }}>
                          <span className="badge" style={{ background: 'var(--shell-border)', color: 'var(--text-secondary)', fontSize: '10px' }}>{job.jobType}</span>
                        </td>
                        <td className="px-3 py-2.5" style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{job.frequency || '—'}</td>
                        <td className="px-3 py-2.5" style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                          {job.phone ? (
                            <a href={`tel:${job.phone}`} style={{ color: 'var(--amber)' }}>{job.phone}</a>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => setJobModal({ open: true, job })}
                              className="flex items-center justify-center w-6 h-6 rounded-md transition-all"
                              style={{ background: 'var(--shell-raised)', color: 'var(--text-tertiary)', border: '1px solid var(--shell-border)' }}
                              title="Edit"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteJob(job.id)}
                              className="flex items-center justify-center w-6 h-6 rounded-md transition-all"
                              style={{ background: 'rgba(239,68,68,0.08)', color: '#F87171', border: '1px solid rgba(239,68,68,0.15)' }}
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
          <div className="space-y-3">
            <div className="card-shell p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  type="search"
                  value={histSearch}
                  onChange={e => setHistSearch(e.target.value)}
                  placeholder="Search customer or address…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff', fontFamily: 'var(--font-dm-sans)' }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select value={histDriver} onChange={e => setHistDriver(e.target.value)} className={inp} style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff' }}>
                  <option value="">All Drivers</option>
                  {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
                <select value={histStatus} onChange={e => setHistStatus(e.target.value)} className={inp} style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff' }}>
                  <option value="">All Statuses</option>
                  <option value="Done">Done</option>
                  <option value="Issue">Issue</option>
                  <option value="CouldNotAccess">No Access</option>
                </select>
                <select value={histJobType} onChange={e => setHistJobType(e.target.value)} className={inp} style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff' }}>
                  <option value="">All Types</option>
                  {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                  {filteredHistory.length} of {(historyData?.data ?? []).length} entries · Last 14 days
                </p>
                <button
                  onClick={() => downloadCsv(
                    'thunderbox-history.csv',
                    ['Date', 'Customer', 'Address', 'Driver', 'Job Type', 'Status', 'Issue Notes'],
                    filteredHistory.map(e => [e.date, e.customerName, e.address, e.driverName, e.jobType, statusLabel(e.status), e.issueNotes ?? ''])
                  )}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                  style={{ background: 'rgba(16,185,129,0.08)', color: '#34D399', border: '1px solid rgba(16,185,129,0.2)', fontFamily: 'var(--font-dm-sans)' }}
                >
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {filteredHistory.length === 0 && (
                <div className="text-center py-16" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{(historyData?.data ?? []).length === 0 ? 'No history yet' : 'No entries match filters'}</p>
                </div>
              )}
              {filteredHistory.map(entry => (
                <div key={entry.id} className="card-shell p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>{entry.customerName}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{entry.address}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: '#7C3AED', fontSize: '10px' }}>{entry.driverName}</span>
                        <span className="badge" style={{ background: 'var(--shell-border)', color: 'var(--text-tertiary)', fontSize: '10px' }}>{entry.jobType}</span>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{formatDate(entry.date)}</span>
                      </div>
                      {entry.issueNotes && (
                        <p className="text-xs mt-1" style={{ color: '#FCA5A5', fontFamily: 'var(--font-dm-sans)' }}>{entry.issueNotes}</p>
                      )}
                    </div>
                    <span className={`badge flex-shrink-0 ${
                      entry.status === 'Done' ? 'badge-done' : entry.status === 'Issue' ? 'badge-issue' : entry.status === 'CouldNotAccess' ? 'badge-cant' : 'badge-pending'
                    }`}>
                      {statusLabel(entry.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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

        {/* ── IMPORT & API ───────────────────────────────────── */}
        {tab === 'import' && (<>

          {/* CSV Upload */}
          <div className="card-shell p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold" style={{ color: '#fff', fontFamily: 'var(--font-sora)', fontSize: '16px' }}>Bulk Import Jobs</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>Upload a CSV to add jobs to the Master schedule</p>
              </div>
              <a
                href="/api/template/jobs"
                download
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: 'var(--amber)', fontFamily: 'var(--font-dm-sans)' }}
              >
                <FileUp className="w-3.5 h-3.5" /> Download Template
              </a>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0] ?? null); }}
              className="flex flex-col items-center justify-center gap-2 py-10 rounded-2xl cursor-pointer transition-all"
              style={{ border: '2px dashed var(--shell-border)', background: 'var(--shell)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--amber)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--shell-border)')}
            >
              <Upload className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm font-semibold" style={{ color: csvFileName ? '#fff' : 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                {csvFileName || 'Drop CSV here or click to browse'}
              </p>
              {csvRows.length > 0 && (
                <span className="badge badge-done">{csvRows.length} rows loaded</span>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => handleFileChange(e.target.files?.[0] ?? null)} />

            {/* Preview table */}
            {csvRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--shell-border)' }}>
                <table className="w-full text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <thead>
                    <tr style={{ background: 'var(--shell)', borderBottom: '1px solid var(--shell-border)' }}>
                      {Object.keys(csvRows[0]).map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--shell-border)' }}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2 whitespace-nowrap" style={{ color: '#fff' }}>{v || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvRows.length > 5 && (
                  <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--shell-border)' }}>
                    + {csvRows.length - 5} more rows
                  </p>
                )}
              </div>
            )}

            {/* Import mode */}
            {csvRows.length > 0 && (
              <div className="flex gap-3">
                {(['append', 'replace'] as const).map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="importMode" value={m} checked={importMode === m} onChange={() => setImportMode(m)} className="accent-amber-500" />
                    <span className="text-sm font-medium" style={{ color: importMode === m ? '#fff' : 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                      {m === 'append' ? 'Append to existing jobs' : 'Replace all Master jobs'}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {importMode === 'replace' && csvRows.length > 0 && (
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-xs font-semibold" style={{ color: '#FCA5A5', fontFamily: 'var(--font-dm-sans)' }}>
                  ⚠️ Replace mode will permanently delete all existing Master jobs before importing.
                </p>
              </div>
            )}

            {csvRows.length > 0 && (
              <button
                onClick={handleBulkImport}
                disabled={importing}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Importing…' : `Import ${csvRows.length} Jobs`}
              </button>
            )}

            {/* Import result */}
            {importResult && (
              <div className="rounded-xl p-4 space-y-2" style={{ background: importResult.imported > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${importResult.imported > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <p className="text-sm font-semibold" style={{ color: importResult.imported > 0 ? '#34D399' : '#F87171', fontFamily: 'var(--font-dm-sans)' }}>
                  ✓ {importResult.imported} imported · {importResult.skipped} skipped
                </p>
                {importResult.errors.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {importResult.errors.slice(0, 10).map((e, i) => (
                      <p key={i} className="text-xs" style={{ color: '#FCA5A5', fontFamily: 'var(--font-dm-sans)' }}>
                        Row {e.row}: [{e.field}] {e.error}
                      </p>
                    ))}
                    {importResult.errors.length > 10 && (
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                        + {importResult.errors.length - 10} more errors
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* API Keys */}
          <div className="card-shell p-5 space-y-4">
            <div>
              <h2 className="font-display font-bold flex items-center gap-2" style={{ color: '#fff', fontFamily: 'var(--font-sora)', fontSize: '16px' }}>
                <Key className="w-4 h-4" style={{ color: 'var(--amber)' }} /> API Integration
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                Use API keys to import jobs programmatically from any integration
              </p>
            </div>

            {/* Endpoint reference */}
            <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>Endpoint</p>
              <code className="text-xs block" style={{ color: 'var(--amber)', fontFamily: 'monospace' }}>POST /api/jobs/bulk</code>
              <code className="text-xs block mt-1" style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>Authorization: Bearer {'<api-key>'}</code>
              <code className="text-xs block" style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{'{ "mode": "append|replace", "jobs": [...] }'}</code>
            </div>

            {/* Create key form */}
            <div className="flex gap-2">
              <input
                className={inp}
                style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff', flex: 1 }}
                placeholder="Key name (e.g. Production, Zapier)"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
              />
              <button
                onClick={handleCreateKey}
                disabled={creatingKey || !newKeyName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 transition-all disabled:opacity-40"
                style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
              >
                {creatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create
              </button>
            </div>

            {/* Key list */}
            <div className="space-y-2">
              {apiKeys.length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>No API keys yet</p>
              )}
              {apiKeys.map(k => (
                <div key={k.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', opacity: k.isActive ? 1 : 0.4 }}>
                  <Key className="w-4 h-4 flex-shrink-0" style={{ color: k.isActive ? 'var(--amber)' : 'var(--text-tertiary)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>{k.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{k.keyPrefix}…</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                      Created {formatDate(k.createdAt)} · {k.lastUsedAt ? `Last used ${formatDate(k.lastUsedAt)}` : 'Never used'}
                    </p>
                  </div>
                  {k.isActive && (
                    <button
                      onClick={() => handleRevokeKey(k.id)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold flex-shrink-0 transition-all"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', fontFamily: 'var(--font-dm-sans)' }}
                    >
                      Revoke
                    </button>
                  )}
                  {!k.isActive && (
                    <span className="badge" style={{ background: 'var(--shell-border)', color: 'var(--text-tertiary)', fontSize: '10px' }}>Revoked</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>)}

      </main>

      {/* Sticky reallocation bar */}
      {selectMode && selectedJobIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4" style={{ background: 'var(--shell-raised)', borderTop: '1px solid var(--shell-border)', backdropFilter: 'blur(8px)' }}>
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <select
              value={reallocDriver}
              onChange={e => setReallocDriver(e.target.value)}
              className={`${inp} flex-1`}
              style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff' }}
            >
              <option value="">Select driver to reassign to…</option>
              {drivers.filter(d => d.isActive).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
            <button
              onClick={handleReallocate}
              disabled={reallocating || !reallocDriver}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex-shrink-0"
              style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
            >
              {reallocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users2 className="w-4 h-4" />}
              Reassign {selectedJobIds.size}
            </button>
          </div>
        </div>
      )}

      {jobModal.open    && <JobForm       initial={jobModal.job}    drivers={drivers} onSave={handleSaveJob}  onClose={() => setJobModal({ open: false })} />}
      {driverModal.open && <DriverForm    initial={driverModal.driver}              onSave={handleSaveDriver} onClose={() => setDriverModal({ open: false })} />}
      {userModal.open   && <AdminUserForm initial={userModal.user}                  onSave={handleSaveUser}   onClose={() => setUserModal({ open: false })} />}

      {/* API Key reveal modal */}
      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl" style={{ background: 'var(--shell-raised)', border: '1px solid var(--shell-border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <Key className="w-5 h-5" style={{ color: 'var(--amber)' }} />
              </div>
              <div>
                <h3 className="font-display font-bold" style={{ color: '#fff', fontFamily: 'var(--font-sora)', fontSize: '16px' }}>API Key Created</h3>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>Copy it now — it won&apos;t be shown again</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)' }}>
              <code className="flex-1 text-xs break-all" style={{ color: 'var(--amber)', fontFamily: 'monospace' }}>{createdKey}</code>
              <button
                onClick={handleCopyKey}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{ background: copied ? 'rgba(16,185,129,0.12)' : 'var(--shell-raised)', border: '1px solid var(--shell-border)', color: copied ? '#34D399' : 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <p className="text-xs" style={{ color: 'var(--amber)', fontFamily: 'var(--font-dm-sans)' }}>
                Use this key in the <code style={{ fontFamily: 'monospace' }}>Authorization: Bearer</code> header when calling <code style={{ fontFamily: 'monospace' }}>POST /api/jobs/bulk</code>.
              </p>
            </div>
            <button
              onClick={() => { setCreatedKey(null); setCopied(false); }}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
