// Runtime facts about where the app is deployed and what it is connected to.
// Hosting platforms hide secret values once set (Vercel's "Sensitive" vars are
// write-only), so the running process is often the only place left that can
// answer "which database is this?". Credentials are never included.

export interface DatabaseInfo {
  host: string;
  port: string;
  name: string;
  provider: string;
  ssl: boolean;
}

const PROVIDER_HOSTS: [RegExp, string][] = [
  [/rlwy\.net|railway\.app|railway\.internal/, 'Railway'],
  [/neon\.tech/,                               'Neon'],
  [/supabase\.(co|com)/,                       'Supabase'],
  [/vercel-storage\.com/,                      'Vercel Postgres'],
  [/render\.com/,                              'Render'],
  [/rds\.amazonaws\.com/,                      'AWS RDS'],
  [/azure\.com/,                               'Azure'],
  [/localhost|127\.0\.0\.1/,                   'Local'],
];

/**
 * Parse a Postgres connection string into its non-secret parts.
 * Username and password are deliberately dropped — this is surfaced in the UI.
 */
export function parseDatabaseUrl(url: string | undefined): DatabaseInfo | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname;
    const provider = PROVIDER_HOSTS.find(([re]) => re.test(host))?.[1] ?? 'Other';
    return {
      host,
      port: u.port || '5432',
      name: u.pathname.replace(/^\//, '') || '(default)',
      provider,
      ssl: /sslmode=(require|verify)/.test(u.search),
    };
  } catch {
    return null;
  }
}

/** Which host is actually serving this process, from the platform's own variables. */
export function detectPlatform(): { name: string; detail: string } {
  if (process.env.VERCEL) {
    return {
      name: 'Vercel',
      detail: [process.env.VERCEL_ENV, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).join(' · '),
    };
  }
  if (process.env.RAILWAY_PROJECT_NAME || process.env.RAILWAY_SERVICE_NAME) {
    return {
      name: 'Railway',
      detail: [process.env.RAILWAY_PROJECT_NAME, process.env.RAILWAY_SERVICE_NAME, process.env.RAILWAY_ENVIRONMENT_NAME]
        .filter(Boolean).join(' · '),
    };
  }
  return { name: 'Unknown / self-hosted', detail: '' };
}
