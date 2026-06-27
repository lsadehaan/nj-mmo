import { describe, it, expect } from 'vitest';
import { PEACE_ZONE, NPC_INTERACT_RADIUS, isInPeaceZone } from './peace-zone';

describe('peace zone', () => {
  it('returns true at village center and false outside bounds', () => {
    expect(isInPeaceZone(0, 0)).toBe(true);
    expect(isInPeaceZone(25, 0)).toBe(false);
  });

  it('includes axis-aligned corners at ±20 and excludes just outside', () => {
    expect(isInPeaceZone(-20, -20)).toBe(true);
    expect(isInPeaceZone(20, 20)).toBe(true);
    expect(isInPeaceZone(-20.1, 0)).toBe(false);
    expect(isInPeaceZone(0, 20.1)).toBe(false);
  });

  it('exports PEACE_ZONE rectangle x∈[−20,20], z∈[−20,20]', () => {
    expect(PEACE_ZONE).toEqual({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
  });

  it('exports NPC_INTERACT_RADIUS as 3.0 m', () => {
    expect(NPC_INTERACT_RADIUS).toBe(3.0);
  });
});
