import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { isInPeaceZone, isWalkable } from '@nj/game-core';
import { FIXTURE_DATA_DIR } from './seed';
import type { MobSpawnFixtureRow } from './parsers/spawns.parser';

/** Classic level per seeded mob — used for ring progression guard. */
const MOB_LEVEL: Record<number, number> = {
  20001: 1,
  20432: 1,
  20481: 1,
  20544: 3,
  20120: 4,
  20121: 5,
  20442: 5,
  20003: 5,
  20130: 6,
  20131: 7,
  20006: 8,
  20326: 8,
  20132: 9,
  20343: 10,
  20093: 10,
  20096: 11,
  20098: 12,
  20342: 12,
  20016: 13,
  20101: 14,
  20103: 15,
  20106: 16,
  20108: 17,
};

/** Hand-mapped ring tier (1 = nearest village, 10 = outer field). */
const RING_TIER: Record<number, number> = {
  20001: 1,
  20432: 1,
  20481: 2,
  20544: 2,
  20120: 3,
  20121: 3,
  20442: 4,
  20003: 5,
  20130: 5,
  20131: 6,
  20006: 6,
  20326: 6,
  20132: 7,
  20343: 7,
  20093: 7,
  20096: 8,
  20098: 8,
  20342: 8,
  20016: 9,
  20101: 9,
  20103: 10,
  20106: 10,
  20108: 10,
};

function loadSpawnFixture(): MobSpawnFixtureRow[] {
  const json = readFileSync(join(FIXTURE_DATA_DIR, 'mob_spawns.json'), 'utf-8');
  return JSON.parse(json) as MobSpawnFixtureRow[];
}

function distFromOrigin(x: number, z: number): number {
  return Math.hypot(x, z);
}

describe('mob spawn placement fixture', () => {
  const spawns = loadSpawnFixture();

  it('has at least 55 spawn rows (BEST22-19)', () => {
    expect(spawns.length).toBeGreaterThanOrEqual(55);
  });

  it('places every spawn outside the peace zone (BEST22-20)', () => {
    for (const { x, z, npcId } of spawns) {
      expect(isInPeaceZone(x, z), `npcId ${npcId} at (${x}, ${z})`).toBe(false);
    }
  });

  it('places every spawn on walkable terrain (BEST22-21)', () => {
    for (const { x, z, npcId } of spawns) {
      const pos = { x, z };
      expect(isWalkable(pos, pos), `npcId ${npcId} at (${x}, ${z})`).toBe(true);
      expect(isWalkable(pos, { x: x + 0.5, z }), `npcId ${npcId} east step`).toBe(true);
      expect(isWalkable(pos, { x, z: z + 0.5 }), `npcId ${npcId} south step`).toBe(true);
    }
  });

  it('increases mean mob level from ring 6 through ring 10 (BEST22-53)', () => {
    const tiers = [6, 7, 8, 9, 10];
    const avgLevel: number[] = [];

    for (const tier of tiers) {
      const rows = spawns.filter((s) => RING_TIER[s.npcId] === tier);
      expect(rows.length, `ring ${tier} has spawns`).toBeGreaterThan(0);
      avgLevel.push(rows.reduce((sum, s) => sum + MOB_LEVEL[s.npcId], 0) / rows.length);
    }

    for (let i = 1; i < tiers.length; i++) {
      expect(avgLevel[i]).toBeGreaterThanOrEqual(avgLevel[i - 1]);
    }
  });

  it('increases mean mob level across rings 1–5 (TIMOB-30)', () => {
    const tiers = [1, 2, 3, 4, 5];
    const avgDist: number[] = [];
    const avgLevel: number[] = [];

    for (const tier of tiers) {
      const rows = spawns.filter((s) => RING_TIER[s.npcId] === tier);
      expect(rows.length, `ring ${tier} has spawns`).toBeGreaterThan(0);
      avgDist.push(rows.reduce((sum, s) => sum + distFromOrigin(s.x, s.z), 0) / rows.length);
      avgLevel.push(rows.reduce((sum, s) => sum + MOB_LEVEL[s.npcId], 0) / rows.length);
    }

    for (let i = 1; i < tiers.length; i++) {
      expect(avgDist[i]).toBeGreaterThanOrEqual(avgDist[i - 1] - 0.01);
      expect(avgLevel[i]).toBeGreaterThanOrEqual(avgLevel[i - 1]);
    }
  });
});
