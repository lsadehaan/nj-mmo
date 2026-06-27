import type { NewMonster } from '../../db/schema';
import { xmlParser, parseNumber, parseString } from './xml-utils';

interface NpcNode {
  '@_id': string;
  '@_level': string;
  '@_type': string;
  '@_name': string;
  race?: string;
  acquire?: { '@_exp'?: string; '@_sp'?: string };
  stats?: { vitals?: { '@_hp'?: string; '@_mp'?: string } };
}

export function parseMonsters(xml: string, ids: number[]): NewMonster[] {
  const doc = xmlParser.parse(xml) as { list?: { npc?: NpcNode[] } };
  const nodes = doc.list?.npc ?? [];
  const idSet = new Set(ids.map(String));
  const results: NewMonster[] = [];

  for (const node of nodes) {
    const id = node['@_id'];
    if (!idSet.has(id)) continue;

    requireAttr(id, 'level', node['@_level']);
    requireAttr(id, 'type', node['@_type']);
    requireAttr(id, 'name', node['@_name']);
    requireAttr(id, 'race', node.race);
    requireAttr(id, 'acquire.exp', node.acquire?.['@_exp']);
    requireAttr(id, 'acquire.sp', node.acquire?.['@_sp']);
    requireAttr(id, 'vitals.hp', node.stats?.vitals?.['@_hp']);
    requireAttr(id, 'vitals.mp', node.stats?.vitals?.['@_mp']);

    results.push({
      npcId: parseNumber(id, 'id', id),
      name: parseString(id, 'name', node['@_name']),
      level: parseNumber(id, 'level', node['@_level']),
      type: parseString(id, 'type', node['@_type']),
      race: parseString(id, 'race', node.race),
      exp: parseNumber(id, 'acquire.exp', node.acquire?.['@_exp']),
      sp: parseNumber(id, 'acquire.sp', node.acquire?.['@_sp']),
      hp: parseNumber(id, 'vitals.hp', node.stats?.vitals?.['@_hp']),
      mp: parseNumber(id, 'vitals.mp', node.stats?.vitals?.['@_mp']),
    });
  }

  const found = new Set(results.map((r) => r.npcId));
  for (const want of ids) {
    if (!found.has(want)) {
      throw new Error(`Monster id ${want} not found in XML`);
    }
  }

  return results.sort((a, b) => (a.npcId ?? 0) - (b.npcId ?? 0));
}

function requireAttr(id: string | number, field: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required field "${field}" for entity id ${id}`);
  }
}
