'use client';
import { useEffect, useState } from 'react';
import { Driver, ApiResponse } from '@/types';
import { Truck, ChevronRight, Loader2 } from 'lucide-react';

interface DriverSelectorProps {
  onSelect: (name: string) => void;
}

export default function DriverSelector({ onSelect }: DriverSelectorProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/drivers')
      .then(r => r.json() as Promise<ApiResponse<Driver[]>>)
      .then(d => {
        if (d.success && d.data) setDrivers(d.data);
        else setError(d.error || 'Failed to load drivers');
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Loading drivers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
        <p className="font-medium">Error loading drivers</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {drivers.map(driver => (
        <button
          key={driver.id}
          onClick={() => onSelect(driver.name)}
          className="w-full flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-4 hover:border-blue-300 hover:bg-blue-50/40 active:scale-[0.98] transition-all shadow-sm text-left"
        >
          <div className="bg-blue-100 text-blue-700 rounded-xl p-3 flex-shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base">{driver.name}</p>
            {driver.phone && <p className="text-sm text-gray-400">{driver.phone}</p>}
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}
