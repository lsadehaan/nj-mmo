import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { mobSpawns } from '../../db/schema';
import { parseMobSpawns, type MobSpawnFixtureRow } from '../parsers/spawns.parser';

export function seedMobSpawns(db: AppDatabase, dataDir: string): number {
  const json = readFileSync(join(dataDir, 'mob_spawns.json'), 'utf-8');
  const fixture = JSON.parse(json) as MobSpawnFixtureRow[];
  const rows = parseMobSpawns(fixture);
  db.insert(mobSpawns).values(rows).run();
  return rows.length;
}
