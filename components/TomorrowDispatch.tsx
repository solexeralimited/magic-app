'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { ChevronUp, ChevronDown, X, Check, Loader2, Plus, Users2, CalendarClock } from 'lucide-react';
import { Job, ApiResponse } from '@/types';
import { qtyLabel } from './JobCard';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface DriverOption { id: string; name: string; isActive: boolean }

interface TomorrowDispatchProps {
  drivers: DriverOption[];
  onFlash: (text: string, ok: boolean) => void;
}

const JOB_TYPES = ['Service', 'Delivery', 'Pickup', 'Adhoc'];

/**
 * Dispatch working-copy editor: everything here edits ONLY tomorrow's run.
 * Reassignments, reordering, adhoc additions and removals never touch the
 * master schedule, so next week's recurring allocations stay intact.
 */
export default function TomorrowDispatch({ drivers, onFlash }: TomorrowDispatchProps) {
  const { data, mutate } = useSWR<ApiResponse<Job[]>>('/api/jobs/tomorrow', fetcher, { refreshInterval: 30_000 });
  const jobs = data?.data ?? [];

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reassignTo, setReassignTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdhoc, setShowAdhoc] = useState(false);
  const [adhoc, setAdhoc] = useState({ driverName: '', customerName: '', address: '', jobType: 'Adhoc', items: '', quantity: '', notes: '', phone: '', callAhead: false });

  if (jobs.length === 0) return null;

  const byDriver = new Map<string, Job[]>();
  for (const j of jobs) {
    const list = byDriver.get(j.driverName) ?? [];
    list.push(j);
    byDriver.set(j.driverName, list);
  }
  for (const list of byDriver.values()) list.sort((a, b) => a.jobOrder - b.jobOrder);

  const call = async (method: string, body: unknown) => {
    const res = await fetch('/api/jobs/tomorrow', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  };

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const handleMove = async (driverJobs: Job[], index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= driverJobs.length) return;
    const a = driverJobs[index];
    const b = driverJobs[target];
    const updates = [
      { id: a.id, jobOrder: b.jobOrder === a.jobOrder ? a.jobOrder + dir : b.jobOrder },
      { id: b.id, jobOrder: a.jobOrder },
    ];
    await call('PATCH', { action: 'reorder', jobs: updates });
    mutate();
  };

  const handleReassign = async () => {
    if (!reassignTo || selected.size === 0) return;
    setBusy(true);
    const j = await call('PATCH', { action: 'reassign', jobIds: [...selected], driverName: reassignTo });
    onFlash(j.success ? `✓ Moved ${selected.size} job(s) to ${reassignTo} for tomorrow` : `✗ ${j.error}`, j.success);
    if (j.success) { setSelected(new Set()); setSelectMode(false); setReassignTo(''); mutate(); }
    setBusy(false);
  };

  const handleRemove = async (job: Job) => {
    if (!confirm(`Push "${job.customerName}" out of tomorrow's run? The master schedule keeps the job for future weeks.`)) return;
    const j = await call('DELETE', { id: job.id });
    onFlash(j.success ? '✓ Removed from tomorrow (master schedule unchanged)' : `✗ ${j.error}`, j.success);
    mutate();
  };

  const handleAddAdhoc = async () => {
    if (!adhoc.driverName || !adhoc.customerName) return;
    setBusy(true);
    const j = await call('POST', { job: adhoc });
    onFlash(j.success ? `✓ Adhoc job added to ${adhoc.driverName}'s run for tomorrow` : `✗ ${j.error}`, j.success);
    if (j.success) {
      setShowAdhoc(false);
      setAdhoc({ driverName: '', customerName: '', address: '', jobType: 'Adhoc', items: '', quantity: '', notes: '', phone: '', callAhead: false });
      mutate();
    }
    setBusy(false);
  };

  const inp = 'input';

  return (
    <div className="card-shell p-4" style={{ borderLeft: '3px solid rgba(16,185,129,0.5)' }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4" style={{ color: '#34D399' }} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#34D399', fontFamily: 'var(--font-dm-sans)' }}>
            Tomorrow&apos;s Run — Dispatch
          </p>
          <span className="badge badge-done" style={{ fontSize: '10px' }}>{jobs.length} jobs</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdhoc(true)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.25)', fontFamily: 'var(--font-dm-sans)' }}
          >
            <Plus className="w-3 h-3" /> Adhoc
          </button>
          <button
            onClick={() => { setSelectMode(s => !s); setSelected(new Set()); }}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
            style={{
              background: selectMode ? 'rgba(245,158,11,0.15)' : 'var(--shell-border)',
              color: selectMode ? 'var(--amber)' : 'var(--text-tertiary)',
              border: selectMode ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
              fontFamily: 'var(--font-dm-sans)',
            }}
          >
            <Users2 className="w-3 h-3" /> {selectMode ? 'Cancel' : 'Reassign'}
          </button>
        </div>
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
        Changes here only affect tomorrow — the master schedule is untouched.
      </p>

      <div className="space-y-4">
        {Array.from(byDriver.entries()).map(([driverName, driverJobs]) => (
          <div key={driverName}>
            <p className="text-xs font-semibold mb-1.5 px-1" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>
              {driverName} <span style={{ color: 'var(--text-tertiary)' }}>· {driverJobs.length} jobs</span>
            </p>
            <div className="space-y-1.5">
              {driverJobs.map((job, i) => {
                const isSelected = selected.has(job.id);
                return (
                  <div
                    key={job.id}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
                    style={{
                      background: 'var(--shell)',
                      border: '1px solid var(--shell-border)',
                      outline: isSelected ? '2px solid var(--amber)' : undefined,
                      outlineOffset: '-2px',
                      cursor: selectMode ? 'pointer' : undefined,
                    }}
                    onClick={selectMode ? () => toggleSelect(job.id) : undefined}
                  >
                    {selectMode && (
                      <div
                        className="flex-shrink-0 flex items-center justify-center rounded-md"
                        style={{ width: 18, height: 18, background: isSelected ? 'var(--amber)' : 'var(--shell-raised)', border: `1.5px solid ${isSelected ? 'var(--amber)' : 'var(--shell-border)'}` }}
                      >
                        {isSelected && <Check className="w-3 h-3" style={{ color: '#000' }} />}
                      </div>
                    )}
                    <span className="flex-shrink-0 text-xs font-bold w-6 text-center" style={{ color: 'var(--amber)', fontFamily: 'var(--font-sora)' }}>
                      {job.jobOrder}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>
                        {job.customerName}
                        {qtyLabel(job) && <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}> · {qtyLabel(job)}</span>}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>{job.address}</p>
                    </div>
                    <span className="badge flex-shrink-0" style={{ background: 'var(--shell-border)', color: 'var(--text-tertiary)', fontSize: '9px' }}>{job.jobType}</span>
                    {!selectMode && (
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleMove(driverJobs, i, -1)} disabled={i === 0} className="w-6 h-6 flex items-center justify-center rounded-md disabled:opacity-20" style={{ background: 'var(--shell-raised)', color: 'var(--text-tertiary)', border: '1px solid var(--shell-border)' }}>
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleMove(driverJobs, i, 1)} disabled={i === driverJobs.length - 1} className="w-6 h-6 flex items-center justify-center rounded-md disabled:opacity-20" style={{ background: 'var(--shell-raised)', color: 'var(--text-tertiary)', border: '1px solid var(--shell-border)' }}>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleRemove(job)} className="w-6 h-6 flex items-center justify-center rounded-md" style={{ background: 'rgba(239,68,68,0.08)', color: '#F87171', border: '1px solid rgba(239,68,68,0.15)' }} title="Remove from tomorrow">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Reassign bar */}
      {selectMode && selected.size > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--shell-border)' }}>
          <select
            value={reassignTo}
            onChange={e => setReassignTo(e.target.value)}
            className={`${inp} flex-1`}
            style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff' }}
          >
            <option value="">Move {selected.size} job(s) to…</option>
            {drivers.filter(d => d.isActive).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          <button
            onClick={handleReassign}
            disabled={busy || !reassignTo}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex-shrink-0"
            style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users2 className="w-4 h-4" />}
            Move
          </button>
        </div>
      )}

      {/* Adhoc modal */}
      {showAdhoc && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto shadow-2xl" style={{ background: '#fff' }}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 z-10" style={{ background: '#fff', borderBottom: '1px solid var(--surface-border)' }}>
              <h2 className="font-bold text-base" style={{ fontFamily: 'var(--font-sora)', color: 'var(--text-primary)' }}>Add Adhoc Job to Tomorrow</h2>
              <button onClick={() => setShowAdhoc(false)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Driver *</label>
                  <select className={inp} value={adhoc.driverName} onChange={e => setAdhoc(f => ({ ...f, driverName: e.target.value }))}>
                    <option value="">Select driver…</option>
                    {drivers.filter(d => d.isActive).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Customer *</label>
                  <input className={inp} value={adhoc.customerName} onChange={e => setAdhoc(f => ({ ...f, customerName: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Address</label>
                  <input className={inp} value={adhoc.address} onChange={e => setAdhoc(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Job Type</label>
                  <select className={inp} value={adhoc.jobType} onChange={e => setAdhoc(f => ({ ...f, jobType: e.target.value }))}>
                    {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className={inp} type="tel" value={adhoc.phone} onChange={e => setAdhoc(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Unit Type</label>
                  <input className={inp} value={adhoc.items} onChange={e => setAdhoc(f => ({ ...f, items: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Quantity</label>
                  <input className={inp} value={adhoc.quantity} onChange={e => setAdhoc(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Notes</label>
                  <textarea className={inp} rows={2} value={adhoc.notes} onChange={e => setAdhoc(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <button
                onClick={handleAddAdhoc}
                disabled={busy || !adhoc.driverName || !adhoc.customerName}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add to Tomorrow&apos;s Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
