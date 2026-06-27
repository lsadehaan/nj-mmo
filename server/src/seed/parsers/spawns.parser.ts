import type { NewMobSpawn } from '../../db/schema';

export const DEFAULT_SPAWN_Y = 4.26;

export interface MobSpawnFixtureRow {
  npcId: number;
  x: number;
  z: number;
  respawnSec?: number;
  y?: number;
}

export function parseMobSpawns(rows: MobSpawnFixtureRow[]): NewMobSpawn[] {
  return rows.map((row) => ({
    npcId: row.npcId,
    x: row.x,
    y: row.y ?? DEFAULT_SPAWN_Y,
    z: row.z,
    respawnSec: row.respawnSec ?? 27,
  }));
}
