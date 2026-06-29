'use client';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import DriverSelector from '@/components/DriverSelector';
import { ArrowLeft } from 'lucide-react';

export default function DriversPage() {
  const router = useRouter();

  const handleSelect = (name: string) => {
    localStorage.setItem('selectedDriver', name);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Select Driver"
        subtitle="Who are you?"
        rightContent={
          <button onClick={() => router.back()} className="bg-white/20 rounded-full p-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
        }
      />
      <main className="max-w-2xl mx-auto p-4 pt-6">
        <p className="text-gray-500 text-sm mb-4">Tap your name to see your jobs for today</p>
        <DriverSelector onSelect={handleSelect} />
      </main>
    </div>
  );
}
