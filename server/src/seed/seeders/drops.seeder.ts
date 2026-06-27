import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { mobDrops } from '../../db/schema';
import { parseMobDrops } from '../parsers/drops.parser';
import { TI_MOB_IDS } from '../paths';

export function seedMobDrops(db: AppDatabase, dataDir: string): number {
  const xml = readMonsterXml(dataDir);
  const rows = parseMobDrops(xml, [...TI_MOB_IDS]);
  if (rows.length > 0) {
    db.insert(mobDrops).values(rows).run();
  }
  return rows.length;
}

function readMonsterXml(dataDir: string): string {
  const fixture = join(dataDir, 'monsters.xml');
  if (existsSync(fixture)) {
    return readFileSync(fixture, 'utf-8');
  }

  const files = [
    join(dataDir, 'stats/npcs/20000-20099.xml'),
    join(dataDir, 'stats/npcs/20100-20199.xml'),
    join(dataDir, 'stats/npcs/20400-20499.xml'),
  ];

  const nodes: string[] = [];
  for (const file of files) {
    if (!existsSync(file)) {
      throw new Error(`Monster source XML not found: ${file}`);
    }
    const text = readFileSync(file, 'utf-8');
    const matches = text.match(/<npc id="[\s\S]*?<\/npc>/g) ?? [];
    nodes.push(...matches.filter((n) => TI_MOB_IDS.some((id) => n.includes(`id="${id}"`))));
  }

  return `<?xml version="1.0" encoding="UTF-8"?><list>${nodes.join('')}</list>`;
}
