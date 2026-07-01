'use client';
import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, ChevronDown } from 'lucide-react';

type Mode = 'driver' | 'admin';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode]       = useState<Mode>('driver');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [showPw, setShowPw]   = useState(false);

  const [driverName, setDriverName]   = useState('');
  const [pin, setPin]                 = useState('');
  const [driverNames, setDriverNames] = useState<string[]>([]);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    fetch('/api/drivers/names')
      .then(r => r.json())
      .then(d => { if (d.success) setDriverNames(d.data); });
  }, []);

  const handleDriverLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await signIn('driver-login', { name: driverName, pin, redirect: false });
    setLoading(false);
    if (res?.error) setError('Invalid name or PIN. Please try again.');
    else router.replace('/dashboard');
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await signIn('admin-login', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError('Invalid email or password.');
    else router.replace('/admin');
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-5 relative overflow-hidden"
      style={{ background: 'var(--shell)' }}
    >
      {/* Background grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,158,11,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      {/* Amber glow top-right */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-120px', right: '-120px',
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Brand lockup */}
      <div className="relative z-10 text-center mb-10 animate-fade-up">
        <div
          className="inline-flex items-center justify-center mx-auto mb-5"
          style={{
            width: 56, height: 56,
            background: 'var(--amber)',
            borderRadius: '14px',
            boxShadow: '0 8px 32px rgba(245,158,11,0.35)',
          }}
        >
          <span
            className="font-display font-800"
            style={{ fontSize: '20px', fontWeight: 800, color: '#000', fontFamily: 'var(--font-sora)', letterSpacing: '-0.03em' }}
          >
            TB
          </span>
        </div>
        <h1
          className="font-display"
          style={{ fontFamily: 'var(--font-sora)', fontSize: '26px', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}
        >
          THUNDERBOX
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
          Driver Workflow System
        </p>
      </div>

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-sm overflow-hidden animate-fade-up-1"
        style={{
          background: 'var(--shell-raised)',
          border: '1px solid var(--shell-border)',
          borderRadius: '20px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* Mode toggle */}
        <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--shell-border)' }}>
          {(['driver', 'admin'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className="py-3.5 text-sm font-semibold transition-all duration-150 relative"
              style={{
                fontFamily: 'var(--font-dm-sans)',
                color: mode === m ? '#fff' : 'var(--text-tertiary)',
                background: mode === m ? 'var(--shell-border)' : 'transparent',
              }}
            >
              {mode === m && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'var(--amber)' }}
                />
              )}
              {m === 'driver' ? '🚚 Driver' : '🛡 Admin'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Errors */}
          {(error || params.get('error')) && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm animate-fade-up"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#FCA5A5',
                fontFamily: 'var(--font-dm-sans)',
              }}
            >
              {error || 'Your session has expired. Please log in again.'}
            </div>
          )}

          {/* Driver form */}
          {mode === 'driver' && (
            <form onSubmit={handleDriverLogin} className="space-y-4">
              <div>
                <label className="label">Your Name</label>
                <div className="relative">
                  <select
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    required
                    className="input"
                    style={{ background: 'var(--shell)', border: '1.5px solid var(--shell-border)', color: driverName ? '#fff' : 'var(--text-tertiary)' }}
                  >
                    <option value="" disabled>— select your name —</option>
                    {driverNames.map(n => <option key={n} value={n} style={{ color: '#fff' }}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">PIN</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    inputMode="numeric"
                    required
                    className="input pr-12 font-mono tracking-widest"
                    style={{ background: 'var(--shell)', border: '1.5px solid var(--shell-border)', color: '#fff' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2"
                style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Sign In
              </button>
            </form>
          )}

          {/* Admin form */}
          {mode === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@thunderbox.co.nz"
                  required
                  className="input"
                  style={{ background: 'var(--shell)', border: '1.5px solid var(--shell-border)', color: '#fff' }}
                />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="input pr-12"
                    style={{ background: 'var(--shell)', border: '1.5px solid var(--shell-border)', color: '#fff' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2"
                style={{ background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-dm-sans)' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Sign In as Admin
              </button>
            </form>
          )}
        </div>
      </div>

      <p className="relative z-10 mt-8 text-xs animate-fade-up-2" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
        © {new Date().getFullYear()} Thunderbox · Secure Login
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
