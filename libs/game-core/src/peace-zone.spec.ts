import { describe, it, expect } from 'vitest';
import { NPC_INTERACT_RADIUS, isInPeaceZone } from './peace-zone';
import { getZoneAt } from './ti-zones';

describe('peace zone', () => {
  it('returns true at village center and false at obelisk', () => {
    expect(isInPeaceZone(0, 0)).toBe(true);
    expect(isInPeaceZone(-155, 58)).toBe(false);
  });

  it('matches getZoneAt peace type (TIW23-15)', () => {
    const samples = [
      { x: 0, z: 0 },
      { x: -20, z: 15 },
      { x: -155, z: 58 },
      { x: -110, z: 29 },
      { x: 250, z: 250 },
    ];
    for (const { x, z } of samples) {
      expect(isInPeaceZone(x, z)).toBe(getZoneAt(x, z).type === 'peace');
    }
  });

  it('exports NPC_INTERACT_RADIUS as 3.0 m', () => {
    expect(NPC_INTERACT_RADIUS).toBe(3.0);
  });
});
