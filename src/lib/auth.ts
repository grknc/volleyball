// src/lib/auth.ts
// Node-only (bcryptjs). Never import this from middleware.ts or anywhere
// that runs on the Edge Runtime — see session.ts for the edge-safe half.
import bcrypt from 'bcryptjs';

export function verifyCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminEmail || !adminPasswordHash) {
    throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD_HASH ortam değişkenleri tanımlı değil');
  }
  if (email !== adminEmail) return false;
  return bcrypt.compareSync(password, adminPasswordHash);
}
