'use client';
import { useState } from 'react';
import { Phone, MapPin, CheckCircle, AlertTriangle, Lock, Clock, Package, RotateCcw, Hash } from 'lucide-react';
import { Job } from '@/types';
import { cn, formatTime } from '@/lib/utils';

interface JobCardProps {
  job: Job;
  onStatusChange: (id: string, status: Job['status'], notes?: string) => Promise<boolean>;
  isCompleted?: boolean;
  readOnly?: boolean;
}

const statusConfig = {
  Pending:        { label: 'Pending',   accent: '#F59E0B', badge: 'badge-pending' },
  Done:           { label: 'Done',      accent: '#10B981', badge: 'badge-done'    },
  Issue:          { label: 'Issue',     accent: '#EF4444', badge: 'badge-issue'   },
  CouldNotAccess: { label: 'No Access', accent: '#F97316', badge: 'badge-cant'    },
};

const jobTypeColors: Record<string, { border: string; bg: string; text: string }> = {
  'Service':  { border: '#059669', bg: '#ecfdf5', text: '#065f46' },
  'Delivery': { border: '#D97706', bg: '#fffbeb', text: '#78350f' },
  'Pickup':   { border: '#DC2626', bg: '#fef2f2', text: '#7f1d1d' },
  'Adhoc':    { border: '#EA580C', bg: '#fff7ed', text: '#7c2d12' },
};

export default function JobCard({ job, onStatusChange, isCompleted, readOnly }: JobCardProps) {
  const [loading, setLoading]           = useState(false);
  const [showIssueInput, setShowIssueInput] = useState(false);
  const [issueNotes, setIssueNotes]     = useState('');

  const cfg = statusConfig[job.status];
  const typeColor = jobTypeColors[job.jobType] ?? { border: cfg.accent, bg: '#ffffff', text: 'var(--text-secondary)' };

  const handleStatus = async (status: Job['status'], notes?: string) => {
    setLoading(true);
    await onStatusChange(job.id, status, notes);
    setLoading(false);
    setShowIssueInput(false);
    setIssueNotes('');
  };

  return (
    <div
      className={cn(
        'card overflow-hidden transition-all duration-200 animate-fade-up',
        isCompleted && 'opacity-60',
      )}
      style={{ borderLeft: `3px solid ${typeColor.border}`, background: typeColor.bg }}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Job order number — large tinted watermark */}
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-xl font-display font-800 leading-none"
            style={{
              width: 40,
              height: 40,
              background: `${cfg.accent}18`,
              color: cfg.accent,
              fontSize: '16px',
              fontWeight: 800,
              fontFamily: 'var(--font-sora)',
            }}
          >
            {job.jobOrder}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span
                className="font-display"
                style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-sora)', lineHeight: 1.3 }}
              >
                {job.address}
              </span>
              {job.callAhead && (
                <span className="badge" style={{ background: 'rgba(139,92,246,0.12)', color: '#7C3AED', fontSize: '10px' }}>
                  📞 Call
                </span>
              )}
            </div>
            <p className="text-xs truncate" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}>
              {job.customerName}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="badge" style={{ background: typeColor.border + '20', color: typeColor.border, fontSize: '10px', border: `1px solid ${typeColor.border}40` }}>
                {job.jobType}
              </span>
              <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
            </div>
          </div>
        </div>

        {/* Completion time */}
        {job.completionTime && (
          <div className="flex items-center gap-1.5 mt-2.5 px-1">
            <Clock className="w-3 h-3" style={{ color: 'var(--status-done)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--status-done)', fontFamily: 'var(--font-dm-sans)' }}>
              Completed {formatTime(job.completionTime)}
            </span>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex gap-2 mt-3">
          {job.phone && (
            <a
              href={`tel:${job.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)', fontFamily: 'var(--font-dm-sans)' }}
            >
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
          )}
          {(job.mapLink || job.address) && (
            <a
              href={job.mapLink || `https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={job.mapLink
                ? { background: 'rgba(245,158,11,0.1)', color: 'var(--amber-dark)', border: '1px solid rgba(245,158,11,0.2)', fontFamily: 'var(--font-dm-sans)' }
                : { background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)', fontFamily: 'var(--font-dm-sans)' }
              }
            >
              <MapPin className="w-3.5 h-3.5" /> Map
            </a>
          )}
        </div>
      </div>

      {/* ── Details (always visible) ───────────────────────────────── */}
      {(job.items || job.quantity || job.notes || job.frequency || job.issueNotes) && (
        <div className="px-4 pb-4 space-y-2.5" style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '12px' }}>
          {job.items && (
            <div className="flex gap-2.5 items-start">
              <Package className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)', letterSpacing: '0.05em' }}>Items</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-dm-sans)' }}>{job.items}</p>
              </div>
            </div>
          )}
          {job.quantity && (
            <div className="flex gap-2.5 items-start">
              <Hash className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)', letterSpacing: '0.05em' }}>Qty</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-dm-sans)' }}>{job.quantity}</p>
              </div>
            </div>
          )}
          {job.notes && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--amber-dark)', fontFamily: 'var(--font-dm-sans)' }}>Notes</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-dm-sans)' }}>{job.notes}</p>
            </div>
          )}
          {job.frequency && (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
              Frequency: {job.frequency}
            </p>
          )}
          {job.issueNotes && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#B91C1C', fontFamily: 'var(--font-dm-sans)' }}>Issue Notes</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-dm-sans)' }}>{job.issueNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Issue notes input ──────────────────────────────────────── */}
      {!readOnly && showIssueInput && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--surface-border)', background: 'rgba(239,68,68,0.03)' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
            Describe the issue:
          </p>
          <textarea
            value={issueNotes}
            onChange={e => setIssueNotes(e.target.value)}
            className="input resize-none"
            rows={3}
            placeholder="What went wrong?"
          />
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={() => handleStatus('Issue', issueNotes)}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all"
              style={{ background: '#EF4444', color: '#fff', fontFamily: 'var(--font-dm-sans)' }}
            >
              {loading ? 'Saving…' : 'Submit Issue'}
            </button>
            <button
              onClick={() => setShowIssueInput(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium active:scale-95 transition-all"
              style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)', fontFamily: 'var(--font-dm-sans)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Action row (pending only) ──────────────────────────────── */}
      {!readOnly && !isCompleted && job.status === 'Pending' && !showIssueInput && (
        <div className="grid grid-cols-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
          {[
            { label: 'Done',      icon: CheckCircle,    status: 'Done' as const,           color: '#059669', bg: 'rgba(16,185,129,0.06)'  },
            { label: 'No Access', icon: Lock,           status: 'CouldNotAccess' as const, color: '#C2410C', bg: 'rgba(249,115,22,0.06)'  },
            { label: 'Issue',     icon: AlertTriangle,  status: null,                      color: '#B91C1C', bg: 'rgba(239,68,68,0.06)'   },
          ].map(({ label, icon: Icon, status, color, bg }, i) => (
            <button
              key={label}
              onClick={() => status ? handleStatus(status) : setShowIssueInput(true)}
              disabled={loading}
              className={cn(
                'flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-all disabled:opacity-40 active:scale-95',
                i < 2 && 'border-r'
              )}
              style={{
                color,
                borderColor: 'var(--surface-border)',
                fontFamily: 'var(--font-dm-sans)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = bg)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Reopen ────────────────────────────────────────────────── */}
      {!readOnly && isCompleted && job.status !== 'Pending' && (
        <div className="px-4 py-2.5" style={{ borderTop: '1px solid var(--surface-border)' }}>
          <button
            onClick={() => handleStatus('Pending')}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40"
            style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}
          >
            <RotateCcw className="w-3 h-3" /> Reopen job
          </button>
        </div>
      )}
    </div>
  );
}
