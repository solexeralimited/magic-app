'use client';

interface StatsCardProps {
  label: string;
  value: number | string;
  color?: 'amber' | 'green' | 'red' | 'orange' | 'gray';
  icon?: React.ReactNode;
}

const accents: Record<string, string> = {
  amber:  'var(--amber)',
  green:  '#10B981',
  red:    '#EF4444',
  orange: '#F97316',
  gray:   'var(--shell-border)',
};

export default function StatsCard({ label, value, color = 'gray', icon }: StatsCardProps) {
  const accent = accents[color];

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-2"
      style={{
        background: 'var(--shell-raised)',
        border: '1px solid var(--shell-border)',
      }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accent }} />

      <div className="flex items-center justify-between">
        <span
          style={{
            fontFamily: 'var(--font-dm-sans)',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          {label}
        </span>
        {icon && (
          <span style={{ color: accent, opacity: 0.7 }}>
            {icon}
          </span>
        )}
      </div>

      <span
        className="font-display"
        style={{ fontSize: '28px', fontWeight: 800, color: accent, lineHeight: 1 }}
      >
        {value}
      </span>
    </div>
  );
}
