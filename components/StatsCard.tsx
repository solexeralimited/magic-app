'use client';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  label: string;
  value: number | string;
  color?: 'blue' | 'green' | 'red' | 'orange' | 'gray';
  icon?: React.ReactNode;
}

const colors = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  green: 'bg-green-50 text-green-700 border-green-100',
  red: 'bg-red-50 text-red-700 border-red-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-100',
  gray: 'bg-gray-50 text-gray-700 border-gray-100',
};

export default function StatsCard({ label, value, color = 'gray', icon }: StatsCardProps) {
  return (
    <div className={cn('rounded-2xl border p-4 flex flex-col gap-1', colors[color])}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium opacity-70">{label}</span>
        {icon && <span className="opacity-60">{icon}</span>}
      </div>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
}
