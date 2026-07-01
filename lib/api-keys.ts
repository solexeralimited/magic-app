import crypto from 'crypto';
import { prisma } from './prisma';

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = 'tb_' + crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 14);
  return { key, hash, prefix };
}

export async function verifyApiKey(key: string): Promise<boolean> {
  if (!key?.startsWith('tb_')) return false;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const record = await prisma.apiKey.findUnique({ where: { keyHash: hash } });
  if (!record || !record.isActive) return false;
  prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return true;
}
