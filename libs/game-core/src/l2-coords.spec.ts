import { describe, it, expect } from 'vitest';
import { L2_ANCHOR, l2ToLocal, localToL2 } from './l2-coords';

describe('l2ToLocal', () => {
  it('maps village anchor to origin (TIW23-01)', () => {
    const { x, z } = l2ToLocal(L2_ANCHOR.x, L2_ANCHOR.y);
    expect(x).toBeCloseTo(0, 3);
    expect(z).toBeCloseTo(0, 3);
  });

  it('maps Obelisk L2 coords to design local metres (TIW23-02)', () => {
    const { x, z } = l2ToLocal(-99843, 237583);
    expect(x).toBeCloseTo(-155.43, 1);
    expect(z).toBeCloseTo(58.17, 1);
  });

  it('round-trips within 0.01 m', () => {
    const local = { x: -110.5, z: 29.25 };
    const l2 = localToL2(local.x, local.z);
    const back = l2ToLocal(l2.x, l2.y);
    expect(back.x).toBeCloseTo(local.x, 2);
    expect(back.z).toBeCloseTo(local.z, 2);
  });
});
