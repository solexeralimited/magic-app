'use client';
import { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { Job } from '@/types';

const JOB_TYPES = ['Service', 'Delivery', 'Pickup', 'Adhoc', 'Swapout'];
const inp = 'input';

export interface DayJobEdit {
  jobType: string;
  address: string;
  phone: string;
  items: string;
  quantity: string;
  notes: string;
  mapLink: string;
  callAhead: boolean;
}

interface EditDayJobModalProps {
  job: Job;
  onSave: (fields: DayJobEdit) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

/**
 * One-off, day-specific edit for a Tomorrow/Daily job copy. Never touches the
 * Master job — the recurring schedule is untouched, this only changes what
 * happens today/tomorrow for this one occurrence.
 */
export default function EditDayJobModal({ job, onSave, onClose }: EditDayJobModalProps) {
  const [form, setForm] = useState<DayJobEdit>({
    jobType: job.jobType,
    address: job.address,
    phone: job.phone,
    items: job.items,
    quantity: job.quantity,
    notes: job.notes,
    mapLink: job.mapLink || '',
    callAhead: job.callAhead,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof DayJobEdit>(key: K, value: DayJobEdit[K]) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    const res = await onSave(form);
    setSaving(false);
    if (res.success) onClose();
    else setError(res.error || 'Failed to save');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto shadow-2xl" style={{ background: '#fff' }}>
        <div className="sticky top-0 flex items-start justify-between px-5 py-4 z-10" style={{ background: '#fff', borderBottom: '1px solid var(--surface-border)' }}>
          <div>
            <h2 className="font-bold text-base" style={{ fontFamily: 'var(--font-sora)', color: 'var(--text-primary)' }}>Edit Job — Today Only</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{job.customerName} — one-off change, the master schedule is untouched</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {error && <p className="text-xs font-medium" style={{ color: '#EF4444' }}>{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Job Type</label>
              <select className={inp} value={form.jobType} onChange={e => set('jobType', e.target.value)}>
                {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Phone</label>
              <input className={inp} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input className={inp} value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div>
              <label className="label">Unit Type</label>
              <input className={inp} value={form.items} onChange={e => set('items', e.target.value)} />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input className={inp} value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Map Link</label>
              <input className={inp} type="url" value={form.mapLink} onChange={e => set('mapLink', e.target.value)} placeholder="https://maps.google.com/…" />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <input type="checkbox" id="edit-day-ca" checked={form.callAhead} onChange={e => set('callAhead', e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
              <label htmlFor="edit-day-ca" className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Call Ahead Required</label>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save for Today Only
          </button>
        </div>
      </div>
    </div>
  );
}
