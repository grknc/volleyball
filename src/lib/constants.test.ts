import { describe, expect, it } from 'vitest';
import { isValidAvatarUrl, isValidPlayerPosition, PLAYER_POSITIONS } from './constants';

describe('isValidPlayerPosition', () => {
  it('accepts every value in PLAYER_POSITIONS', () => {
    for (const position of PLAYER_POSITIONS) {
      expect(isValidPlayerPosition(position)).toBe(true);
    }
  });

  it('rejects a value not in the list', () => {
    expect(isValidPlayerPosition('Kaptan')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isValidPlayerPosition(123)).toBe(false);
    expect(isValidPlayerPosition(null)).toBe(false);
    expect(isValidPlayerPosition(undefined)).toBe(false);
  });
});

describe('isValidAvatarUrl', () => {
  it('accepts an https URL', () => {
    expect(isValidAvatarUrl('https://example.com/avatar.png')).toBe(true);
  });

  it('accepts an http URL', () => {
    expect(isValidAvatarUrl('http://example.com/avatar.png')).toBe(true);
  });

  it('rejects a non-http(s) protocol', () => {
    expect(isValidAvatarUrl('ftp://example.com/avatar.png')).toBe(false);
    expect(isValidAvatarUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects a malformed string', () => {
    expect(isValidAvatarUrl('not a url')).toBe(false);
  });

  it('rejects empty string and non-string values', () => {
    expect(isValidAvatarUrl('')).toBe(false);
    expect(isValidAvatarUrl(null)).toBe(false);
    expect(isValidAvatarUrl(undefined)).toBe(false);
  });
});
