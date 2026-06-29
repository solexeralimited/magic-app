'use client';
import { Truck, RefreshCw, Bell } from 'lucide-react';
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
  showNotificationBell,
  onNotificationClick,
  rightContent,
}: HeaderProps) {
  return (
    <header className="bg-blue-600 text-white sticky top-0 z-40 shadow-lg">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-xl p-2">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">{title}</h1>
            {subtitle && <p className="text-blue-100 text-xs">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rightContent}
          {showNotificationBell && (
            <button
              onClick={onNotificationClick}
              className="bg-white/20 rounded-full p-2 hover:bg-white/30 transition-colors"
            >
              <Bell className="w-4 h-4" />
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={cn('bg-white/20 rounded-full p-2 hover:bg-white/30 transition-colors', refreshing && 'opacity-50')}
              disabled={refreshing}
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
