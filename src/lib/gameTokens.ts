// Node-only (node:crypto). Sadece sunucu kodundan içe aktarın.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Yönetim ve ayrılma anahtarları. Veritabanında yalnızca hash'i tutulur. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenMatches(token: unknown, hash: string | null | undefined): boolean {
  if (typeof token !== 'string' || token === '' || !hash) return false;
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
