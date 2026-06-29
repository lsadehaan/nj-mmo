import type { NewItem } from '../../db/schema';
import { xmlParser, parseNumber, parseString } from './xml-utils';

const ITEM_IDS = [1060, 17, 1835, 2509, 2369] as const;

interface ItemSetNode {
  '@_name': string;
  '@_val': string;
}

interface ItemStatNode {
  '@_type': string;
  '#text'?: string | number;
}

interface ItemNode {
  '@_id': string;
  '@_name': string;
  '@_type': string;
  set?: ItemSetNode | ItemSetNode[];
  stats?: { stat?: ItemStatNode | ItemStatNode[] };
}

function collectSets(node: ItemNode): Map<string, string> {
  const map = new Map<string, string>();
  const sets = node.set;
  if (!sets) return map;
  const list = Array.isArray(sets) ? sets : [sets];
  for (const entry of list) {
    map.set(entry['@_name'], entry['@_val']);
  }
  return map;
}

function collectStats(node: ItemNode): Map<string, number> {
  const map = new Map<string, number>();
  const stats = node.stats?.stat;
  if (!stats) return map;
  const list = Array.isArray(stats) ? stats : [stats];
  for (const entry of list) {
    const value = entry['#text'] ?? entry['@_type'];
    const n = Number(value);
    if (!Number.isNaN(n)) {
      map.set(entry['@_type'], n);
    }
  }
  return map;
}

function mapItemType(l2Type: string, etcType?: string, defaultAction?: string): string {
  if (l2Type === 'Weapon') return 'weapon';
  if (etcType === 'POTION') return 'consumable';
  if (defaultAction === 'SPIRITSHOT' || etcType === 'SOULSHOT') return 'shot';
  return 'etc';
}

export function parseItemsXml(xml: string): NewItem[] {
  const doc = xmlParser.parse(xml) as { list?: { item?: ItemNode | ItemNode[] } };
  const nodes = doc.list?.item;
  if (!nodes) {
    throw new Error('Items XML missing item nodes');
  }

  const itemList = Array.isArray(nodes) ? nodes : [nodes];
  const want = new Set(ITEM_IDS.map(String));
  const results: NewItem[] = [];

  for (const node of itemList) {
    const itemId = parseNumber(node['@_id'], 'id', node['@_id']);
    if (!want.has(String(itemId))) continue;

    const name = parseString(itemId, 'name', node['@_name']);
    const l2Type = parseString(itemId, 'type', node['@_type']);
    const sets = collectSets(node);
    const stats = collectStats(node);
    const mappedType = mapItemType(
      l2Type,
      sets.get('etcitem_type'),
      sets.get('default_action')
    );

    const row: NewItem = {
      itemId,
      name,
      type: mappedType,
      pAtk: mappedType === 'weapon' ? stats.get('pAtk') ?? null : null,
      randomDamage: mappedType === 'weapon' ? stats.get('randomDamage') ?? null : null,
      bodyPart: sets.get('bodypart') ?? null,
    };
    results.push(row);
  }

  for (const id of ITEM_IDS) {
    if (!results.some((r) => r.itemId === id)) {
      throw new Error(`Item ${id} not found in items XML`);
    }
  }

  return results.sort((a, b) => (a.itemId ?? 0) - (b.itemId ?? 0));
}
