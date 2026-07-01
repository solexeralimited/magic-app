'use client';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  showNotificationBell?: boolean;
  onNotificationClick?: () => void;
  rightContent?: React.ReactNode;
}

export default function Header({
  title,
  subtitle,
  onRefresh,
  refreshing,
  rightContent,
}: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-40"
      style={{ background: 'var(--shell)', borderBottom: '1px solid var(--shell-border)' }}
    >
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Left: brand + title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="tb-badge flex-shrink-0">TB</div>
          <div className="min-w-0">
            <h1
              className="font-display font-700 text-sm leading-tight truncate"
              style={{ color: 'var(--text-inverse)', fontSize: '15px', fontWeight: 700 }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {rightContent}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 disabled:opacity-40',
              )}
              style={{ background: 'var(--shell-raised)', border: '1px solid var(--shell-border)', color: 'var(--text-tertiary)' }}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
