import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLeave, readLeave, readManageToken, saveLeave, saveManageToken } from './gameStorage';

const blocked = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

describe('gameStorage when localStorage is blocked', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the manage token in memory so the owner box still appears after creating', () => {
    vi.stubGlobal('window', { localStorage: blocked });
    saveManageToken('g-blocked', 'tok123');
    expect(readManageToken('g-blocked')).toBe('tok123');
  });

  it('keeps and clears the leave record in memory', () => {
    vi.stubGlobal('window', { localStorage: blocked });
    saveLeave('g-blocked', { participantId: 'p1', token: 't1' });
    expect(readLeave('g-blocked')).toEqual({ participantId: 'p1', token: 't1' });
    clearLeave('g-blocked');
    expect(readLeave('g-blocked')).toBeNull();
  });
});
