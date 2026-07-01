'use client';

interface ProgressBarProps {
  completed: number;
  total: number;
}

export default function ProgressBar({ completed, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = total - completed;

  return (
    <div style={{ background: 'var(--shell-raised)', borderBottom: '1px solid var(--shell-border)' }} className="px-4 py-3">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-end justify-between mb-2">
          <div>
            <span
              className="font-display"
              style={{ fontSize: '28px', fontWeight: 800, color: 'var(--amber)', lineHeight: 1 }}
            >
              {pct}%
            </span>
            <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
              complete
            </span>
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
            {remaining > 0 ? `${remaining} remaining` : 'All done'}
          </span>
        </div>

        {/* Track */}
        <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--shell-border)' }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, background: 'var(--amber)' }}
          />
          {/* Tick marks */}
          {[25, 50, 75].map(tick => (
            <div
              key={tick}
              className="absolute top-0 bottom-0 w-px"
              style={{ left: `${tick}%`, background: 'var(--shell)' }}
            />
          ))}
        </div>

        <div className="flex justify-between mt-1.5">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
            {completed} of {total} jobs
          </span>
          <span className="text-xs" style={{ color: pct === 100 ? 'var(--status-done)' : 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)', fontWeight: pct === 100 ? 600 : 400 }}>
            {pct === 100 ? '✓ Run complete' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
