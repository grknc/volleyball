import { describe, expect, it } from 'vitest';
import { generateToken, hashToken, tokenMatches } from './gameTokens';

describe('game tokens', () => {
  it('generates distinct url-safe tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hashes deterministically to 64 hex characters without revealing the token', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });

  it('matches only the right token', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(tokenMatches(token, hash)).toBe(true);
    expect(tokenMatches(generateToken(), hash)).toBe(false);
    expect(tokenMatches(token + 'x', hash)).toBe(false);
  });

  it('never matches missing or malformed input', () => {
    const hash = hashToken(generateToken());
    expect(tokenMatches(null, hash)).toBe(false);
    expect(tokenMatches(undefined, hash)).toBe(false);
    expect(tokenMatches('', hash)).toBe(false);
    expect(tokenMatches(42, hash)).toBe(false);
    expect(tokenMatches('abc', null)).toBe(false);
    expect(tokenMatches('abc', undefined)).toBe(false);
    expect(tokenMatches('abc', 'not-a-hash')).toBe(false);
  });
});
