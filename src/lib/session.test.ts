// src/lib/session.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSessionToken, verifySessionToken } from './session';

describe('session', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'test-secret-value-1234567890');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates and verifies a valid session token', async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it('rejects a garbage token', async () => {
    expect(await verifySessionToken('not-a-real-token')).toBe(false);
  });
});
