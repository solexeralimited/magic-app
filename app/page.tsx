'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Truck } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if driver already selected
    const driver = localStorage.getItem('selectedDriver');
    if (driver) {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur rounded-3xl mb-6">
          <Truck className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-4xl font-extrabold text-white mb-2">Driver</h1>
        <p className="text-blue-100 text-lg mb-10">Workflow System</p>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/drivers')}
            className="w-full bg-white text-blue-700 font-bold py-4 rounded-2xl text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all"
          >
            I'm a Driver
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="w-full bg-white/20 text-white font-bold py-4 rounded-2xl text-lg border border-white/30 hover:bg-white/30 active:scale-95 transition-all"
          >
            Admin / Office
          </button>
        </div>

        <p className="text-blue-200 text-xs mt-8">v1.0 · Driver Workflow</p>
      </div>
    </div>
  );
}
