import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { npcs } from '../../db/schema';
import { parseNpcs } from '../parsers/npcs.parser';
import { TI_NPC_IDS } from '../paths';

export function seedNpcs(db: AppDatabase, dataDir: string): number {
  const xml = readNpcXml(dataDir);
  const rows = parseNpcs(xml, [...TI_NPC_IDS]);
  db.insert(npcs).values(rows).run();
  return rows.length;
}

function readNpcXml(dataDir: string): string {
  const fixture = join(dataDir, 'npcs.xml');
  if (existsSync(fixture)) {
    return readFileSync(fixture, 'utf-8');
  }

  const file = join(dataDir, 'stats/npcs/30000-30099.xml');
  if (!existsSync(file)) {
    throw new Error(`NPC source XML not found: ${file}`);
  }

  const text = readFileSync(file, 'utf-8');
  const nodes =
    text.match(/<npc id="[\s\S]*?<\/npc>/g)?.filter((n) =>
      TI_NPC_IDS.some((id) => n.includes(`id="${id}"`))
    ) ?? [];

  return `<?xml version="1.0" encoding="UTF-8"?><list>${nodes.join('')}</list>`;
}
