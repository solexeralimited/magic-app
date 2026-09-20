'use client';

export default function Footer() {
  return (
    <footer
      className="mt-12 pt-8 border-t text-center text-xs"
      style={{ borderColor: 'var(--shell-border)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}
    >
      <p>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Thunderbox</span> • Built by{' '}
        <span style={{ color: 'var(--amber)', fontWeight: 500 }}>Solexera Limited</span> © 2026
      </p>
    </footer>
  );
}
