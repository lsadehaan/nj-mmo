import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { mobDrops } from '../../db/schema';
import { parseMobDrops } from '../parsers/drops.parser';
import { TI_MOB_IDS } from '../paths';

/** Supplemental TI economy drops (materials) when fixture spoil rows are not parsed. */
const TI_EXTRA_DROPS = [
  { npcId: 20001, itemId: 1864, minCount: 1, maxCount: 1, chance: 17.73 },
  { npcId: 20003, itemId: 1864, minCount: 1, maxCount: 1, chance: 12.5 },
  { npcId: 20120, itemId: 1869, minCount: 1, maxCount: 1, chance: 8.0 },
  { npcId: 20481, itemId: 1870, minCount: 1, maxCount: 1, chance: 6.5 },
  { npcId: 20432, itemId: 1864, minCount: 1, maxCount: 1, chance: 10.0 },
  { npcId: 20544, itemId: 1868, minCount: 1, maxCount: 1, chance: 7.0 },
  { npcId: 20442, itemId: 1871, minCount: 1, maxCount: 1, chance: 5.5 },
  { npcId: 20121, itemId: 1864, minCount: 1, maxCount: 1, chance: 9.0 },
] as const;

export function seedMobDrops(db: AppDatabase, dataDir: string): number {
  const xml = readMonsterXml(dataDir);
  const rows = parseMobDrops(xml, [...TI_MOB_IDS]);
  const extra = TI_EXTRA_DROPS.map((d) => ({ ...d }));
  const merged = [...rows];
  for (const drop of extra) {
    if (!merged.some((r) => r.npcId === drop.npcId && r.itemId === drop.itemId)) {
      merged.push(drop);
    }
  }
  if (merged.length > 0) {
    db.insert(mobDrops).values(merged).run();
  }
  return merged.length;
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
