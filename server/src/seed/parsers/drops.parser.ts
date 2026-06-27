import type { NewMobDrop } from '../../db/schema';
import { xmlParser, parseNumber } from './xml-utils';

interface DropItemNode {
  '@_id': string;
  '@_min': string;
  '@_max': string;
  '@_chance': string;
}

interface NpcNode {
  '@_id': string;
  dropLists?: {
    drop?: { item?: DropItemNode | DropItemNode[] };
  };
}

export function parseMobDrops(xml: string, npcIds: number[]): NewMobDrop[] {
  const doc = xmlParser.parse(xml) as { list?: { npc?: NpcNode[] } };
  const nodes = doc.list?.npc ?? [];
  const idSet = new Set(npcIds.map(String));
  const results: NewMobDrop[] = [];

  for (const node of nodes) {
    const id = node['@_id'];
    if (!idSet.has(id)) continue;

    const items = node.dropLists?.drop?.item;
    if (!items) continue;

    const itemList = Array.isArray(items) ? items : [items];
    for (const item of itemList) {
      results.push({
        npcId: parseNumber(id, 'npcId', id),
        itemId: parseNumber(id, 'itemId', item['@_id']),
        minCount: parseNumber(id, 'min', item['@_min']),
        maxCount: parseNumber(id, 'max', item['@_max']),
        chance: parseNumber(id, 'chance', item['@_chance']),
      });
    }
  }

  return results;
}
