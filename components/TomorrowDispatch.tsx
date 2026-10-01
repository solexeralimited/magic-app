'use client';
import { useState } from 'react';
import useSWR from 'swr';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, Check, Loader2, Plus, Users2, CalendarClock, Search, GripVertical } from 'lucide-react';
import { Job, ApiResponse } from '@/types';
import { qtyLabel } from './JobCard';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function getDefaultDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

interface DriverOption { id: string; name: string; isActive: boolean }

interface TomorrowDispatchProps {
  drivers: DriverOption[];
  onFlash: (text: string, ok: boolean) => void;
}

const JOB_TYPES = ['Service', 'Delivery', 'Pickup', 'Adhoc'];

// One row in a driver's list. The grip handle is the only draggable surface —
// the row body stays reserved for the select-mode click target — so dragging
// and multi-select work at the same time instead of one disabling the other.
function SortableJobRow({ job, selectMode, isSelected, draggable, onToggleSelect, onRemove }: {
  job: Job;
  selectMode: boolean;
  isSelected: boolean;
  draggable: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id, disabled: !draggable });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        position: 'relative',
        zIndex: isDragging ? 10 : undefined,
        background: 'var(--shell)',
        border: '1px solid var(--shell-border)',
        outline: isSelected ? '2px solid var(--amber)' : undefined,
        outlineOffset: '-2px',
        cursor: selectMode ? 'pointer' : undefined,
      }}
      className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
      onClick={selectMode ? onToggleSelect : undefined}
    >
      {draggable && (
        <button
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          className="flex-shrink-0 flex items-center justify-center rounded-md cursor-grab active:cursor-grabbing touch-none"
          style={{ width: 22, height: 22, background: 'var(--shell-raised)', color: 'var(--text-tertiary)', border: '1px solid var(--shell-border)' }}
        >
          <GripVertical className="w-3 h-3" />
        </button>
      )}
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
        <button onClick={e => { e.stopPropagation(); onRemove(); }} className="w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0" style={{ background: 'rgba(239,68,68,0.08)', color: '#F87171', border: '1px solid rgba(239,68,68,0.15)' }} title="Remove from tomorrow">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

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
  const [adhoc, setAdhoc] = useState({ driverName: '', customerName: '', address: '', jobType: 'Adhoc', items: '', quantity: '', notes: '', phone: '', callAhead: false, scheduledDate: getDefaultDate() });
  const [search, setSearch] = useState('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  if (jobs.length === 0) return null;

  // Reordering swaps with the visually-adjacent job, which only lines up with
  // the true underlying order when nothing is being filtered out.
  const searchActive = search.trim().length > 0;
  const matchesSearch = (j: Job) =>
    j.customerName.toLowerCase().includes(search.toLowerCase()) || j.address.toLowerCase().includes(search.toLowerCase());

  const byDriver = new Map<string, Job[]>();
  for (const j of jobs) {
    const list = byDriver.get(j.driverName) ?? [];
    list.push(j);
    byDriver.set(j.driverName, list);
  }
  for (const list of byDriver.values()) list.sort((a, b) => a.jobOrder - b.jobOrder);

  const visibleByDriver = Array.from(byDriver.entries())
    .map(([driverName, driverJobs]) => [driverName, searchActive ? driverJobs.filter(matchesSearch) : driverJobs] as const)
    .filter(([, visible]) => visible.length > 0);

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

  const handleDragStart = (event: DragStartEvent) => setActiveDragId(event.active.id as string);

  // Reordering is scoped to one driver's own list — dragging a job onto a
  // different driver's section is a no-op here (Reassign is the explicit,
  // separate action for moving a job to someone else's run).
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeJob = jobs.find(j => j.id === activeId);
    const overJob = jobs.find(j => j.id === overId);
    if (!activeJob || !overJob || activeJob.driverName !== overJob.driverName) return;

    const driverJobs = byDriver.get(activeJob.driverName)!;
    const ids = driverJobs.map(j => j.id);

    let newIds: string[];
    if (selectMode && selected.size > 1 && selected.has(activeId) && !selected.has(overId)) {
      // Drag a multi-selected group together: pull every selected job out,
      // keeping their relative order, and reinsert them as one block right
      // before the drop target.
      const movingIds = ids.filter(id => selected.has(id));
      const remaining = ids.filter(id => !selected.has(id));
      const overIdx = remaining.indexOf(overId);
      newIds = [...remaining.slice(0, overIdx), ...movingIds, ...remaining.slice(overIdx)];
    } else {
      const oldIdx = ids.indexOf(activeId);
      const overIdx = ids.indexOf(overId);
      newIds = arrayMove(ids, oldIdx, overIdx);
    }

    const updates = newIds.map((id, i) => ({ id, jobOrder: i + 1 }));
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
    const dateDisplay = new Date(adhoc.scheduledDate).toLocaleDateString('en-NZ');
    onFlash(j.success ? `✓ Adhoc job scheduled for ${adhoc.driverName} on ${dateDisplay}` : `✗ ${j.error}`, j.success);
    if (j.success) {
      setShowAdhoc(false);
      setAdhoc({ driverName: '', customerName: '', address: '', jobType: 'Adhoc', items: '', quantity: '', notes: '', phone: '', callAhead: false, scheduledDate: getDefaultDate() });
      mutate();
    }
    setBusy(false);
  };

  const inp = 'input';
  const activeDragJob = activeDragId ? jobs.find(j => j.id === activeDragId) : undefined;
  const draggingGroup = Boolean(activeDragId && selectMode && selected.size > 1 && selected.has(activeDragId));

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

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search customer or address…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--shell)', border: '1px solid var(--shell-border)', color: '#fff', fontFamily: 'var(--font-dm-sans)' }}
        />
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
        {selectMode
          ? 'Tap jobs to select them, then drag any selected job to move the group together — within the same driver only.'
          : 'Drag the handle to reorder within a driver. Changes here only affect tomorrow — the master schedule is untouched.'}
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-4">
          {visibleByDriver.map(([driverName, visibleJobs]) => (
            <div key={driverName}>
              <p className="text-xs font-semibold mb-1.5 px-1" style={{ color: '#fff', fontFamily: 'var(--font-dm-sans)' }}>
                {driverName} <span style={{ color: 'var(--text-tertiary)' }}>· {searchActive ? `${visibleJobs.length} / ${byDriver.get(driverName)!.length}` : visibleJobs.length} jobs</span>
              </p>
              <SortableContext items={visibleJobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {visibleJobs.map(job => (
                    <SortableJobRow
                      key={job.id}
                      job={job}
                      selectMode={selectMode}
                      isSelected={selected.has(job.id)}
                      draggable={!searchActive}
                      onToggleSelect={() => toggleSelect(job.id)}
                      onRemove={() => handleRemove(job)}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          ))}
          {searchActive && visibleByDriver.length === 0 && (
            <p className="text-center text-sm py-6" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>No jobs match search</p>
          )}
        </div>
        <DragOverlay>
          {activeDragJob ? (
            draggingGroup ? (
              <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'var(--amber)', color: '#000' }}>
                Moving {selected.size} jobs
              </div>
            ) : (
              <div className="rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2" style={{ background: 'var(--shell-raised)', border: '1px solid var(--shell-border)', color: '#fff' }}>
                <GripVertical className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                {activeDragJob.customerName}
              </div>
            )
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Reassign bar — fixed to the bottom, matching Today's Jobs' reassign bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4" style={{ background: 'var(--shell-raised)', borderTop: '1px solid var(--shell-border)', backdropFilter: 'blur(8px)' }}>
          <div className="max-w-5xl mx-auto flex items-center gap-3">
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
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex-shrink-0"
              style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users2 className="w-4 h-4" />}
              Move {selected.size}
            </button>
          </div>
        </div>
      )}

      {/* Adhoc modal */}
      {showAdhoc && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto shadow-2xl" style={{ background: '#fff' }}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 z-10" style={{ background: '#fff', borderBottom: '1px solid var(--surface-border)' }}>
              <h2 className="font-bold text-base" style={{ fontFamily: 'var(--font-sora)', color: 'var(--text-primary)' }}>Schedule Adhoc Job</h2>
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
                  <label className="label">Scheduled Date *</label>
                  <input className={inp} type="date" value={adhoc.scheduledDate} onChange={e => setAdhoc(f => ({ ...f, scheduledDate: e.target.value }))} />
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
                <div className="col-span-2 flex items-center gap-3">
                  <input type="checkbox" id="adhoc-ca" checked={adhoc.callAhead} onChange={e => setAdhoc(f => ({ ...f, callAhead: e.target.checked }))} className="w-4 h-4 rounded accent-amber-500" />
                  <label htmlFor="adhoc-ca" className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Call Ahead Required</label>
                </div>
              </div>
              <button
                onClick={handleAddAdhoc}
                disabled={busy || !adhoc.driverName || !adhoc.customerName}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Schedule Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
