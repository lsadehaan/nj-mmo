import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { npcSpawns } from '../../db/schema';
import { parseNpcSpawns, type NpcSpawnFixtureRow } from '../parsers/npc-spawns.parser';

export function seedNpcSpawns(db: AppDatabase, dataDir: string): number {
  const json = readFileSync(join(dataDir, 'npc_spawns.json'), 'utf-8');
  const fixture = JSON.parse(json) as NpcSpawnFixtureRow[];
  const rows = parseNpcSpawns(fixture);
  db.insert(npcSpawns).values(rows).run();
  return rows.length;
}
