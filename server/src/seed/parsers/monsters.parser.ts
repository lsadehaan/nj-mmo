import type { NewMonster } from '../../db/schema';
import { xmlParser, parseNumber, parseString } from './xml-utils';

interface NpcNode {
  '@_id': string;
  '@_level': string;
  '@_type': string;
  '@_name': string;
  race?: string;
  acquire?: { '@_exp'?: string; '@_sp'?: string };
  stats?: {
    vitals?: { '@_hp'?: string; '@_mp'?: string };
    attack?: {
      '@_physical'?: string;
      '@_random'?: string;
      '@_critical'?: string;
      '@_accuracy'?: string;
      '@_attackSpeed'?: string;
      '@_range'?: string;
    };
    defence?: { '@_physical'?: string };
  };
  ai?: {
    '@_aggroRange'?: string;
    '@_isAggressive'?: string;
  };
}

const DEFAULT_RESPAWN_SEC = 27;

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
    requireAttr(id, 'attack.physical', node.stats?.attack?.['@_physical']);
    requireAttr(id, 'attack.random', node.stats?.attack?.['@_random']);
    requireAttr(id, 'attack.critical', node.stats?.attack?.['@_critical']);
    requireAttr(id, 'attack.accuracy', node.stats?.attack?.['@_accuracy']);
    requireAttr(id, 'attack.attackSpeed', node.stats?.attack?.['@_attackSpeed']);
    requireAttr(id, 'attack.range', node.stats?.attack?.['@_range']);
    requireAttr(id, 'defence.physical', node.stats?.defence?.['@_physical']);

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
      pAtk: parseNumber(id, 'attack.physical', node.stats?.attack?.['@_physical']),
      pDef: parseNumber(id, 'defence.physical', node.stats?.defence?.['@_physical']),
      attackSpeed: parseNumber(id, 'attack.attackSpeed', node.stats?.attack?.['@_attackSpeed']),
      random: parseNumber(id, 'attack.random', node.stats?.attack?.['@_random']),
      critical: parseNumber(id, 'attack.critical', node.stats?.attack?.['@_critical']),
      accuracy: parseNumber(id, 'attack.accuracy', node.stats?.attack?.['@_accuracy']),
      attackRange: parseNumber(id, 'attack.range', node.stats?.attack?.['@_range']),
      aggroRange: parseAggroRange(id, node.ai?.['@_aggroRange']),
      isAggressive: parseIsAggressive(node.ai),
      respawnSec: DEFAULT_RESPAWN_SEC,
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

function parseAggroRange(id: string, raw: string | undefined): number {
  if (raw === undefined || raw === '') return 0;
  return parseNumber(id, 'ai.aggroRange', raw);
}

function parseIsAggressive(ai: NpcNode['ai']): boolean {
  if (!ai) return false;
  const explicit = ai['@_isAggressive'];
  if (explicit === 'false') return false;
  if (explicit === 'true') return true;
  const aggro = ai['@_aggroRange'];
  return aggro !== undefined && aggro !== '';
}

function requireAttr(id: string | number, field: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required field "${field}" for entity id ${id}`);
  }
}
