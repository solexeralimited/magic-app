'use client';

interface FooterProps {
  compact?: boolean;
  showLink?: boolean;
}

export default function Footer({ compact = false, showLink = false }: FooterProps) {
  const companyUrl = 'https://solexera.co.nz';

  if (compact) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}>
        © {new Date().getFullYear()} Thunderbox · Built by{' '}
        {showLink ? (
          <a
            href={companyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--amber)', fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            Solexera Limited
          </a>
        ) : (
          <span style={{ color: 'var(--amber)', fontWeight: 500 }}>Solexera Limited</span>
        )}
      </p>
    );
  }

  return (
    <footer
      className="mt-12 pt-8 border-t text-center text-xs"
      style={{ borderColor: 'var(--shell-border)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-dm-sans)' }}
    >
      <p>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Thunderbox</span> • Built by{' '}
        {showLink ? (
          <a
            href={companyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--amber)', fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            Solexera Limited
          </a>
        ) : (
          <span style={{ color: 'var(--amber)', fontWeight: 500 }}>Solexera Limited</span>
        )}
        {' '}© 2026
      </p>
    </footer>
  );
}
