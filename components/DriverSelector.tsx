'use client';
import { useEffect, useState } from 'react';
import { Driver, ApiResponse } from '@/types';
import { ChevronRight, Loader2 } from 'lucide-react';

// Distinct colors per driver initial
const avatarColors = [
  '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1',
];

function getInitials(name: string) {
  return name.split(/[\s/]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

interface DriverSelectorProps {
  onSelect: (name: string) => void;
}

export default function DriverSelector({ onSelect }: DriverSelectorProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/drivers')
      .then(r => r.json() as Promise<ApiResponse<Driver[]>>)
      .then(d => {
        if (d.success && d.data) setDrivers(d.data);
        else setError(d.error || 'Failed to load');
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--amber)' }} />
        <p className="text-sm" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
          Loading drivers…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <p className="font-semibold text-sm" style={{ color: '#EF4444', fontFamily: 'var(--font-dm-sans)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {drivers.map((driver, i) => {
        const color = avatarColors[i % avatarColors.length];
        return (
          <button
            key={driver.id}
            onClick={() => onSelect(driver.name)}
            className="card flex items-center gap-4 p-4 w-full text-left transition-all duration-150 active:scale-[0.98] animate-fade-up"
            style={{
              animationDelay: `${i * 0.04}s`,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--amber)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(245,158,11,0.12)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--surface-border)';
              (e.currentTarget as HTMLElement).style.boxShadow = '';
            }}
          >
            {/* Avatar */}
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-xl"
              style={{ width: 44, height: 44, background: `${color}22`, border: `1.5px solid ${color}44` }}
            >
              <span
                className="font-display font-bold"
                style={{ color, fontSize: '14px', fontFamily: 'var(--font-sora)' }}
              >
                {getInitials(driver.name)}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p
                className="font-display font-semibold"
                style={{ color: 'var(--text-primary)', fontSize: '15px', fontFamily: 'var(--font-sora)' }}
              >
                {driver.name}
              </p>
              {driver.phone && (
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                  {driver.phone}
                </p>
              )}
            </div>

            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        );
      })}
    </div>
  );
}
