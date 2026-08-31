import { describe, it, expect } from 'vitest';
import { parseDatabaseUrl } from '@/lib/system-info';

describe('parseDatabaseUrl — identify the database without exposing credentials', () => {
  it('never returns the username or password', () => {
    const info = parseDatabaseUrl('postgresql://admin:sup3rs3cret@host.rlwy.net:5432/railway');
    expect(JSON.stringify(info)).not.toContain('sup3rs3cret');
    expect(JSON.stringify(info)).not.toContain('admin');
  });

  it('identifies a Railway database', () => {
    const info = parseDatabaseUrl('postgresql://u:p@monorail.proxy.rlwy.net:41234/railway');
    expect(info).toMatchObject({ provider: 'Railway', host: 'monorail.proxy.rlwy.net', port: '41234', name: 'railway' });
  });

  it('identifies Neon, Supabase and Vercel Postgres', () => {
    expect(parseDatabaseUrl('postgresql://u:p@ep-cool-1.eu-central-1.aws.neon.tech/db')?.provider).toBe('Neon');
    expect(parseDatabaseUrl('postgresql://u:p@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres')?.provider).toBe('Supabase');
    expect(parseDatabaseUrl('postgresql://u:p@db.vercel-storage.com/verceldb')?.provider).toBe('Vercel Postgres');
  });

  it('falls back to "Other" for an unknown host', () => {
    expect(parseDatabaseUrl('postgresql://u:p@db.example.com:5432/mydb')?.provider).toBe('Other');
  });

  it('defaults the port and detects sslmode', () => {
    const info = parseDatabaseUrl('postgresql://u:p@host.neon.tech/db?sslmode=require');
    expect(info?.port).toBe('5432');
    expect(info?.ssl).toBe(true);
  });

  it('returns null when unset or unparseable', () => {
    expect(parseDatabaseUrl(undefined)).toBeNull();
    expect(parseDatabaseUrl('not a url')).toBeNull();
  });
});
