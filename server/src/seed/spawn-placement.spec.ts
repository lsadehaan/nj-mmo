import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isInPeaceZone,
  isWalkable,
  getZoneAt,
  l2ToLocal,
} from '@nj/game-core';
import { TI_MOB_IDS, TI_NPC_IDS } from './paths';
import { FIXTURE_DATA_DIR } from './seed';
import type { MobSpawnFixtureRow } from './parsers/spawns.parser';
import {
  resolveTerritoryZoneId,
} from './territory-spawns';

const MOB_LEVEL: Record<number, number> = {
  20001: 1, 20432: 1, 20481: 1, 20544: 3, 20120: 4, 20121: 5, 20442: 5,
  20003: 5, 20130: 6, 20131: 7, 20006: 8, 20326: 8, 20132: 9, 20343: 10,
  20093: 10, 20096: 11, 20098: 12, 20342: 12, 20016: 13, 20101: 14,
  20103: 15, 20106: 16, 20108: 17,
};

function loadSpawnFixture(): MobSpawnFixtureRow[] {
  const json = readFileSync(join(FIXTURE_DATA_DIR, 'mob_spawns.json'), 'utf-8');
  return JSON.parse(json) as MobSpawnFixtureRow[];
}

function centroid(rows: MobSpawnFixtureRow[]): { x: number; z: number } {
  const n = rows.length;
  return {
    x: rows.reduce((s, r) => s + r.x, 0) / n,
    z: rows.reduce((s, r) => s + r.z, 0) / n,
  };
}

describe('mob spawn placement fixture', () => {
  const spawns = loadSpawnFixture();

  it('has at least 55 spawn rows (TIW23-24)', () => {
    expect(spawns.length).toBeGreaterThanOrEqual(55);
    for (const id of TI_MOB_IDS) {
      expect(spawns.some((s) => s.npcId === id)).toBe(true);
    }
  });

  it('places every spawn outside the peace zone (TIW23-25)', () => {
    for (const { x, z, npcId } of spawns) {
      expect(isInPeaceZone(x, z), `npcId ${npcId} at (${x}, ${z})`).toBe(false);
    }
  });

  it('places every spawn on walkable terrain (TIW23-26)', () => {
    for (const { x, z, npcId } of spawns) {
      const pos = { x, z };
      expect(isWalkable(pos, pos), `npcId ${npcId} at (${x}, ${z})`).toBe(true);
    }
  });

  it('caps local spawn density so a level-1 player is not swarmed', () => {
    // Regression guard for the over-dense seed (≈290 mobs within 80 m, 8+ within
    // a tight pull radius) that made the fields unplayable and tanked client FPS.
    const maxWithin = (radius: number): number => {
      const r2 = radius * radius;
      let max = 0;
      for (const a of spawns) {
        let count = 0;
        for (const b of spawns) {
          const dx = a.x - b.x;
          const dz = a.z - b.z;
          if (dx * dx + dz * dz <= r2) count++;
        }
        if (count > max) max = count;
      }
      return max;
    };

    expect(maxWithin(80)).toBeLessThanOrEqual(90);
    expect(maxWithin(12)).toBeLessThanOrEqual(8);
  });

  it('distributes spawns across at least 4 named zones (TIW23-27)', () => {
    const zones = new Set(
      spawns.map((s) => getZoneAt(s.x, s.z).zoneId).filter((id) => id !== 'wilderness')
    );
    expect(zones.size).toBeGreaterThanOrEqual(4);
  });

  it('Bearded Keltir centroid near village/fields (TIW23-28)', () => {
    const rows = spawns.filter((s) => s.npcId === 20481);
    const c = centroid(rows);
    expect(Math.hypot(c.x, c.z)).toBeLessThan(130);
  });

  it('Giant Spider centroid in ruins or cave (TIW23-29)', () => {
    const rows = spawns.filter((s) => s.npcId === 20103);
    const c = centroid(rows);
    const zoneId = getZoneAt(c.x, c.z).zoneId;
    expect(['elven_ruins', 'cave_of_souls']).toContain(zoneId);
  });

  it('spreads spawns around the village instead of one side', () => {
    // Regression for "all monsters are together on the left": the radial layout
    // must populate every compass side around town, not just the western fields.
    const sector = (s: MobSpawnFixtureRow): 'E' | 'N' | 'S' | 'W' => {
      const a = (Math.atan2(s.z, s.x) * 180) / Math.PI;
      if (a >= -45 && a < 45) return 'E';
      if (a >= 45 && a < 135) return 'S';
      if (a >= 135 || a < -135) return 'W';
      return 'N';
    };
    const counts = { E: 0, N: 0, S: 0, W: 0 };
    for (const s of spawns) counts[sector(s)]++;
    for (const dir of ['E', 'N', 'S', 'W'] as const) {
      expect(counts[dir], `sector ${dir}`).toBeGreaterThan(0);
    }
  });

  it('keeps high-level mobs away from the village (newbie safety)', () => {
    // Regression for "some mobs are too strong near the city": L2J scatters a few
    // level 8-10 species into fields adjacent to town, which once collapsed into
    // the 640 m slice spawned ~85 m from the gate and ganked fresh level-1s. The
    // level→distance gradient must keep the immediate ring newbie-friendly.
    const distFromVillage = (s: MobSpawnFixtureRow): number => Math.hypot(s.x, s.z);
    const minDistForLevel = (level: number): number =>
      level >= 8 ? 220 : level >= 6 ? 140 : 0;

    for (const s of spawns) {
      const level = MOB_LEVEL[s.npcId] ?? 0;
      expect(
        distFromVillage(s),
        `npcId ${s.npcId} (lv ${level}) at (${s.x}, ${s.z})`
      ).toBeGreaterThanOrEqual(minDistForLevel(level));
    }

    // No mob above level 5 within 120 m of the village centre.
    const nearVillage = spawns.filter((s) => distFromVillage(s) < 120);
    const maxNearLevel = Math.max(...nearVillage.map((s) => MOB_LEVEL[s.npcId] ?? 0));
    expect(maxNearLevel).toBeLessThanOrEqual(5);
  });

  it('elven_ruins mean level exceeds eastern_fields (TIW23-31)', () => {
    const zoneLevels = (zoneId: string): number[] =>
      spawns
        .filter((s) => getZoneAt(s.x, s.z).zoneId === zoneId)
        .map((s) => MOB_LEVEL[s.npcId] ?? 0);

    const ruins = zoneLevels('elven_ruins');
    const fields = zoneLevels('eastern_fields');
    expect(ruins.length).toBeGreaterThan(0);
    expect(fields.length).toBeGreaterThan(0);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(ruins)).toBeGreaterThan(mean(fields));
  });
});

describe('territory spawn generator', () => {
  it('maps known L2J territory prefixes to zoneIds (TIW23-30)', () => {
    expect(resolveTerritoryZoneId('gludio31_1725_01', { x: -90000, y: 242000 })).toBe(
      'eastern_fields'
    );
    expect(resolveTerritoryZoneId('gludio31_1624_01', { x: -110000, y: 235000 })).toBe(
      'elven_ruins'
    );
    expect(resolveTerritoryZoneId('gludio32_1725_01', { x: -75000, y: 252000 })).toBe(
      'eastern_fields'
    );
  });
});

describe('TI NPC spawn placement', () => {
  const npcSpawns = JSON.parse(
    readFileSync(join(FIXTURE_DATA_DIR, 'npc_spawns.json'), 'utf-8')
  ) as { npcId: number; x: number; z: number }[];

  it('has exactly one row per TI_NPC_IDS (TIW23-32)', () => {
    expect(npcSpawns).toHaveLength(TI_NPC_IDS.length);
    for (const id of TI_NPC_IDS) {
      expect(npcSpawns.filter((r) => r.npcId === id)).toHaveLength(1);
    }
  });

  it('every NPC is in ti_village peace (TOWN24-07)', () => {
    for (const { npcId, x, z } of npcSpawns) {
      expect(getZoneAt(x, z).zoneId, `npc ${npcId}`).toBe('ti_village');
      expect(getZoneAt(x, z).type, `npc ${npcId}`).toBe('peace');
    }
  });

  it('every NPC spawn is on walkable terrain (TOWN24-08)', () => {
    for (const { npcId, x, z } of npcSpawns) {
      const pos = { x, z };
      expect(isWalkable(pos, pos), `npcId ${npcId} at (${x}, ${z})`).toBe(true);
    }
  });

  it('Katerina near grocery L2 anchor (TIW23-35)', () => {
    const katerina = npcSpawns.find((r) => r.npcId === 30004)!;
    const anchor = l2ToLocal(-84165, 240670);
    const dist = Math.hypot(katerina.x - anchor.x, katerina.z - anchor.z);
    expect(dist).toBeLessThan(8);
  });
});
