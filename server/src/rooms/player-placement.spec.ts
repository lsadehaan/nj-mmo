import { describe, it, expect } from 'vitest';
import { applyE2eDamage, placePlayerAt } from './player-placement';

describe('placePlayerAt', () => {
  it('sets x/z, snaps y, and clears movement targets', () => {
    const player = { x: 0, y: 0, z: 0 };
    const tickState = { x: 0, z: 0, targetX: 5, targetZ: 5 };
    placePlayerAt(player, tickState, 30, -30);
    expect(player.x).toBe(30);
    expect(player.z).toBe(-30);
    expect(player.y).toBeGreaterThan(0);
    expect(tickState.x).toBe(30);
    expect(tickState.z).toBe(-30);
    expect(tickState.targetX).toBeNull();
    expect(tickState.targetZ).toBeNull();
  });
});

describe('applyE2eDamage', () => {
  it('reduces HP by amount floored at 1', () => {
    expect(applyE2eDamage(100, 20)).toBe(80);
    expect(applyE2eDamage(50, 100)).toBe(1);
    expect(applyE2eDamage(10, 10)).toBe(1);
  });
});
