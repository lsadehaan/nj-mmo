import { describe, it, expect } from 'vitest';
import { canTransferClass, getFirstClassOptions } from './class-transfer';

describe('class-transfer', () => {
  it('returns Human Fighter first-class options (TOWN24-36)', () => {
    expect(getFirstClassOptions(0)).toEqual([1, 4, 7]);
  });

  it('rejects transfer below level 20 (TOWN24-39)', () => {
    expect(
      canTransferClass({
        currentClassId: 0,
        targetClassId: 1,
        level: 19,
        masterKind: 'fighter',
      })
    ).toBe(false);
  });

  it('rejects mystic at fighter master (TOWN24-40)', () => {
    expect(
      canTransferClass({
        currentClassId: 10,
        targetClassId: 11,
        level: 20,
        masterKind: 'fighter',
      })
    ).toBe(false);
  });

  it('allows mystic transfer at priest master', () => {
    expect(
      canTransferClass({
        currentClassId: 10,
        targetClassId: 11,
        level: 20,
        masterKind: 'priest',
      })
    ).toBe(true);
  });
});
