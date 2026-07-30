// src/lib/auth.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { verifyCredentials } from './auth';

describe('auth', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_EMAIL', 'admin@example.com');
    vi.stubEnv('ADMIN_PASSWORD_HASH', bcrypt.hashSync('correct-password', 10));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts correct admin credentials', () => {
    expect(verifyCredentials('admin@example.com', 'correct-password')).toBe(true);
  });

  it('rejects wrong password', () => {
    expect(verifyCredentials('admin@example.com', 'wrong-password')).toBe(false);
  });

  it('rejects wrong email', () => {
    expect(verifyCredentials('someone@else.com', 'correct-password')).toBe(false);
  });
});
