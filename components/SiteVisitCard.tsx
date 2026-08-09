'use client';
import { useState } from 'react';
import { Phone, MapPin, X, Check, Lock, AlertTriangle, ClipboardList, Loader2 } from 'lucide-react';
import { Job } from '@/types';
import { qtyLabel } from './JobCard';

interface SiteVisitCardProps {
  jobs: Job[]; // >1 job, same customer + address, sorted by jobOrder
  onBatchStatus: (updates: { id: string; status: Job['status']; issueNotes?: string }[]) => Promise<boolean>;
}

type Outcome = { status: 'CouldNotAccess' | 'Issue'; comment: string };

const jobTypeColors: Record<string, string> = {
  Service: '#059669',
  Delivery: '#D97706',
  Pickup: '#DC2626',
  Adhoc: '#EA580C',
};

export default function SiteVisitCard({ jobs, onBatchStatus }: SiteVisitCardProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'checklist' | 'outcomes'>('checklist');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const first = jobs[0];
  const accent = jobTypeColors[first.jobType] ?? '#059669';
  const anyCallAhead = jobs.some(j => j.callAhead);
  const phone = jobs.find(j => j.phone)?.phone;
  const mapLink = jobs.find(j => j.mapLink)?.mapLink;
  const unticked = jobs.filter(j => !checked.has(j.id));
  const allTicked = unticked.length === 0;

  const toggle = (id: string) =>
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const selectAll = () =>
    setChecked(prev => (prev.size === jobs.length ? new Set() : new Set(jobs.map(j => j.id))));

  const reset = () => {
    setOpen(false);
    setPhase('checklist');
    setError('');
  };

  const handleCompleteSelected = () => {
    setError('');
    if (checked.size === 0) {
      setError('Tick the jobs you completed first');
      return;
    }
    if (allTicked) {
      void submit({});
    } else {
      setPhase('outcomes');
    }
  };

  const submit = async (finalOutcomes: Record<string, Outcome>) => {
    const updates: { id: string; status: Job['status']; issueNotes?: string }[] = [
      ...jobs.filter(j => checked.has(j.id)).map(j => ({ id: j.id, status: 'Done' as const })),
      ...unticked.map(j => ({
        id: j.id,
        status: finalOutcomes[j.id].status,
        issueNotes: finalOutcomes[j.id].comment || undefined,
      })),
    ];
    setSubmitting(true);
    const ok = await onBatchStatus(updates);
    setSubmitting(false);
    if (ok) reset();
    else setError('Could not save — check your connection and try again');
  };

  const handleSubmitOutcomes = () => {
    setError('');
    const missing = unticked.filter(j => !outcomes[j.id]?.status);
    if (missing.length > 0) {
      setError(`Choose No Access or Issue for Job #${missing.map(j => j.jobOrder).join(', #')}`);
      return;
    }
    void submit(outcomes);
  };

  return (
    <>
      {/* ── Site card ─────────────────────────────────────────────── */}
      <div
        className="card overflow-hidden transition-all duration-200 animate-fade-up cursor-pointer active:scale-[0.99]"
        style={{ borderLeft: `3px solid ${accent}` }}
        onClick={() => setOpen(true)}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-xl leading-none"
              style={{ width: 40, height: 40, background: `${accent}18`, color: accent, fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-sora)' }}
            >
              {first.jobOrder}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-sora)', lineHeight: 1.3 }}>
                  {first.address || first.customerName}
                </span>
                {anyCallAhead && (
                  <span className="badge" style={{ background: 'rgba(139,92,246,0.12)', color: '#7C3AED', fontSize: '10px' }}>
                    📞 Call
                  </span>
                )}
              </div>
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}>
                {first.customerName}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span
                  className="badge"
                  style={{ background: `${accent}20`, color: accent, fontSize: '10px', border: `1px solid ${accent}40` }}
                >
                  {jobs.length} Jobs on Site
                </span>
                <span className="badge badge-pending">Pending</span>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
            {phone && (
              <a
                href={`tel:${phone}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)', fontFamily: 'var(--font-dm-sans)' }}
              >
                <Phone className="w-3.5 h-3.5" /> Call
              </a>
            )}
            {(mapLink || first.address) && (
              <a
                href={mapLink || `https://maps.google.com/?q=${encodeURIComponent(first.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                style={mapLink
                  ? { background: 'rgba(245,158,11,0.1)', color: 'var(--amber-dark)', border: '1px solid rgba(245,158,11,0.2)', fontFamily: 'var(--font-dm-sans)' }
                  : { background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)', fontFamily: 'var(--font-dm-sans)' }
                }
              >
                <MapPin className="w-3.5 h-3.5" /> Map
              </a>
            )}
          </div>
        </div>

        {/* Open checklist hint */}
        <div
          className="flex items-center justify-center gap-2 py-3 text-xs font-semibold"
          style={{ borderTop: '1px solid var(--surface-border)', color: accent, fontFamily: 'var(--font-dm-sans)' }}
        >
          <ClipboardList className="w-4 h-4" />
          Open Service Checklist
        </div>
      </div>

      {/* ── Checklist modal ───────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto shadow-2xl" style={{ background: '#fff' }}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 z-10" style={{ background: '#fff', borderBottom: '1px solid var(--surface-border)' }}>
              <div className="min-w-0">
                <h2 className="font-bold text-base truncate" style={{ fontFamily: 'var(--font-sora)', color: 'var(--text-primary)' }}>
                  {phase === 'checklist' ? 'Service Checklist' : 'Jobs Not Completed'}
                </h2>
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}>
                  {first.customerName} · {first.address}
                </p>
              </div>
              <button onClick={reset} className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg" style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {phase === 'checklist' && (<>
                <button
                  onClick={selectAll}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background: 'var(--surface-subtle)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)', fontFamily: 'var(--font-dm-sans)' }}
                >
                  {checked.size === jobs.length ? 'Clear All' : 'Select All'}
                </button>

                <div className="space-y-2">
                  {jobs.map(job => {
                    const isChecked = checked.has(job.id);
                    return (
                      <button
                        key={job.id}
                        onClick={() => toggle(job.id)}
                        className="w-full flex items-start gap-3 p-3.5 rounded-xl text-left transition-all active:scale-[0.99]"
                        style={{
                          background: isChecked ? 'rgba(16,185,129,0.06)' : 'var(--surface-subtle)',
                          border: `1.5px solid ${isChecked ? 'rgba(16,185,129,0.4)' : 'var(--surface-border)'}`,
                        }}
                      >
                        <div
                          className="flex-shrink-0 flex items-center justify-center rounded-md mt-0.5 transition-all"
                          style={{ width: 22, height: 22, background: isChecked ? '#10B981' : '#fff', border: `1.5px solid ${isChecked ? '#10B981' : 'var(--surface-border)'}` }}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5" style={{ color: '#fff' }} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
                            Job #{job.jobOrder}
                            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}> · {qtyLabel(job) || job.jobType}</span>
                          </p>
                          {job.notes && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}>
                              Notes: {job.notes}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {error && <p className="text-xs font-semibold" style={{ color: '#B91C1C', fontFamily: 'var(--font-dm-sans)' }}>{error}</p>}

                <button
                  onClick={handleCompleteSelected}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-95"
                  style={{ background: '#059669', color: '#fff', fontFamily: 'var(--font-dm-sans)' }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {allTicked
                    ? `Complete All ${jobs.length} Jobs`
                    : `Complete Selected (${checked.size} of ${jobs.length})`}
                </button>
                {!allTicked && checked.size > 0 && (
                  <p className="text-xs text-center" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}>
                    You&apos;ll be asked what happened with the {unticked.length} unticked job{unticked.length !== 1 ? 's' : ''}
                  </p>
                )}
              </>)}

              {phase === 'outcomes' && (<>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}>
                  {checked.size} job{checked.size !== 1 ? 's' : ''} will be completed. What happened with the rest?
                </p>

                {unticked.map(job => {
                  const oc = outcomes[job.id];
                  return (
                    <div key={job.id} className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--surface-border)' }}>
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
                        Job #{job.jobOrder}
                        <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}> · {qtyLabel(job) || job.jobType}</span>
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { status: 'CouldNotAccess' as const, label: 'No Access', icon: Lock,          color: '#C2410C', bg: 'rgba(249,115,22,0.08)' },
                          { status: 'Issue' as const,          label: 'Issue',     icon: AlertTriangle, color: '#B91C1C', bg: 'rgba(239,68,68,0.08)'  },
                        ]).map(({ status, label, icon: Icon, color, bg }) => {
                          const active = oc?.status === status;
                          return (
                            <button
                              key={status}
                              onClick={() => setOutcomes(prev => ({ ...prev, [job.id]: { status, comment: prev[job.id]?.comment ?? '' } }))}
                              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                              style={{
                                background: active ? bg : '#fff',
                                color,
                                border: `1.5px solid ${active ? color : 'var(--surface-border)'}`,
                                fontFamily: 'var(--font-dm-sans)',
                              }}
                            >
                              <Icon className="w-3.5 h-3.5" /> {label}
                            </button>
                          );
                        })}
                      </div>
                      {oc?.status && (
                        <textarea
                          value={oc.comment}
                          onChange={e => setOutcomes(prev => ({ ...prev, [job.id]: { ...prev[job.id], comment: e.target.value } }))}
                          className="input resize-none"
                          rows={2}
                          placeholder={oc.status === 'CouldNotAccess' ? 'e.g. Locked behind site fence' : 'e.g. Unit blocked by scaffolding'}
                        />
                      )}
                    </div>
                  );
                })}

                {error && <p className="text-xs font-semibold" style={{ color: '#B91C1C', fontFamily: 'var(--font-dm-sans)' }}>{error}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={() => { setPhase('checklist'); setError(''); }}
                    className="px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-95"
                    style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmitOutcomes}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-95"
                    style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Submit Site Visit
                  </button>
                </div>
              </>)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
