import { describe, it, expect } from 'vitest';
import { isInPeaceZone } from './peace-zone';
import { isNpcSpawnBlocked } from './world-blockers';

/** Phase 17 spawn table — authoritative fixture coordinates. */
const TI_NPC_SPAWNS = [
  { npcId: 30001, x: -14, z: -2 },
  { npcId: 30002, x: -16, z: 4 },
  { npcId: 30003, x: -8, z: 2 },
  { npcId: 30004, x: -6, z: -8 },
  { npcId: 30005, x: 16, z: 0 },
  { npcId: 30006, x: 4, z: 10 },
  { npcId: 30026, x: 2, z: -4 },
] as const;

describe('TI NPC spawn placement guards', () => {
  it.each(TI_NPC_SPAWNS)(
    'npc $npcId at ($x,$z) is inside peace zone (TINPC-12)',
    ({ x, z }) => {
      expect(isInPeaceZone(x, z)).toBe(true);
    }
  );

  it.each(TI_NPC_SPAWNS)(
    'npc $npcId at ($x,$z) is not blocked with 0.8 m margin (TINPC-13)',
    ({ x, z }) => {
      expect(isNpcSpawnBlocked(x, z)).toBe(false);
    }
  );
});
