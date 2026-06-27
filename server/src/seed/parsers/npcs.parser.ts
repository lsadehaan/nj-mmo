import type { NewNpc } from '../../db/schema';
import { xmlParser, parseNumber, parseString } from './xml-utils';

interface NpcNode {
  '@_id': string;
  '@_level': string;
  '@_type': string;
  '@_name': string;
  '@_title'?: string;
}

export function parseNpcs(xml: string, ids: number[]): NewNpc[] {
  const doc = xmlParser.parse(xml) as { list?: { npc?: NpcNode[] } };
  const nodes = doc.list?.npc ?? [];
  const idSet = new Set(ids.map(String));
  const results: NewNpc[] = [];

  for (const node of nodes) {
    const id = node['@_id'];
    if (!idSet.has(id)) continue;

    requireAttr(id, 'level', node['@_level']);
    requireAttr(id, 'type', node['@_type']);
    requireAttr(id, 'name', node['@_name']);
    requireAttr(id, 'title', node['@_title']);

    results.push({
      npcId: parseNumber(id, 'id', id),
      name: parseString(id, 'name', node['@_name']),
      title: parseString(id, 'title', node['@_title']),
      type: parseString(id, 'type', node['@_type']),
      level: parseNumber(id, 'level', node['@_level']),
    });
  }

  const found = new Set(results.map((r) => r.npcId));
  for (const want of ids) {
    if (!found.has(want)) {
      throw new Error(`NPC id ${want} not found in XML`);
    }
  }

  return results.sort((a, b) => (a.npcId ?? 0) - (b.npcId ?? 0));
}

function requireAttr(id: string | number, field: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required field "${field}" for entity id ${id}`);
  }
}
