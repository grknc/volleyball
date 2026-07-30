// src/lib/session.ts
// Edge Runtime-safe: only uses `jose`. Kept separate from auth.ts so that
// middleware.ts (which must run on the Edge Runtime) never pulls in
// bcryptjs, whose Node-only APIs (process.nextTick, setImmediate) silently
// break there.
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'volleybol_session';
const ALG = 'HS256';

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET ortam değişkeni tanımlı değil');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload.role === 'admin';
  } catch {
    return false;
  }
}
