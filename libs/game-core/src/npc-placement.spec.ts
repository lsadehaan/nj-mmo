import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { isInPeaceZone } from './peace-zone';
import { isNpcSpawnBlocked } from './world-blockers';

const FIXTURE_NPC_SPAWNS = JSON.parse(
  readFileSync(
    join(__dirname, '../../../server/src/seed/__fixtures__/npc_spawns.json'),
    'utf-8'
  )
) as { npcId: number; x: number; z: number }[];

describe('TI NPC spawn placement guards', () => {
  it.each(FIXTURE_NPC_SPAWNS)(
    'npc $npcId at ($x,$z) is inside peace zone (TINPC-12)',
    ({ x, z }) => {
      expect(isInPeaceZone(x, z)).toBe(true);
    }
  );

  it.each(FIXTURE_NPC_SPAWNS)(
    'npc $npcId at ($x,$z) is not blocked with 0.8 m margin (TINPC-13)',
    ({ x, z }) => {
      expect(isNpcSpawnBlocked(x, z)).toBe(false);
    }
  );
});
