import type { NewItem } from '../../db/schema';
import { TI_ITEM_IDS } from '../paths';
import { xmlParser, parseNumber, parseString } from './xml-utils';

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

function parseBool(val: string | undefined): boolean {
  return val === 'true' || val === '1';
}

function mapItemType(
  l2Type: string,
  etcType?: string,
  defaultAction?: string,
  bodyPart?: string
): string {
  if (l2Type === 'Weapon') return 'weapon';
  if (l2Type === 'Armor') {
    if (bodyPart && /neck|ear|finger/.test(bodyPart)) return 'accessory';
    return 'armor';
  }
  if (etcType === 'POTION') return 'consumable';
  if (etcType === 'RECIPE') return 'recipe';
  if (defaultAction === 'SPIRITSHOT' || etcType === 'SOULSHOT') return 'shot';
  if (etcType === 'MATERIAL') return 'material';
  return 'etc';
}

function mapCrystalType(val: string | undefined): string | null {
  if (!val) return null;
  const upper = val.toUpperCase();
  if (['NG', 'D', 'C', 'B', 'A', 'S'].includes(upper)) return upper;
  return null;
}

export function parseItemsXml(xml: string, itemIds: readonly number[] = TI_ITEM_IDS): NewItem[] {
  const doc = xmlParser.parse(xml) as { list?: { item?: ItemNode | ItemNode[] } };
  const nodes = doc.list?.item;
  if (!nodes) {
    throw new Error('Items XML missing item nodes');
  }

  const itemList = Array.isArray(nodes) ? nodes : [nodes];
  const want = new Set(itemIds.map(String));
  const results: NewItem[] = [];

  for (const node of itemList) {
    const itemId = parseNumber(node['@_id'], 'id', node['@_id']);
    if (!want.has(String(itemId))) continue;

    const name = parseString(itemId, 'name', node['@_name']);
    const l2Type = parseString(itemId, 'type', node['@_type']);
    const sets = collectSets(node);
    const stats = collectStats(node);
    const bodyPart = sets.get('bodypart') ?? null;
    const mappedType = mapItemType(
      l2Type,
      sets.get('etcitem_type'),
      sets.get('default_action'),
      bodyPart ?? undefined
    );

    const row: NewItem = {
      itemId,
      name,
      type: mappedType,
      crystalType: mapCrystalType(sets.get('crystal_type')),
      pAtk: mappedType === 'weapon' ? stats.get('pAtk') ?? null : null,
      pDef: mappedType === 'armor' || mappedType === 'accessory' ? stats.get('pDef') ?? null : null,
      mDef: mappedType === 'armor' || mappedType === 'accessory' ? stats.get('mDef') ?? null : null,
      randomDamage: mappedType === 'weapon' ? stats.get('randomDamage') ?? null : null,
      bodyPart,
      weaponType: sets.get('weapon_type') ?? null,
      enchantEnabled: parseBool(sets.get('enchant_enabled')),
      recipeId: sets.get('recipe_id') ? Number(sets.get('recipe_id')) : null,
      isStackable: parseBool(sets.get('is_stackable')),
      weight: sets.get('weight') ? Number(sets.get('weight')) : 0,
    };
    results.push(row);
  }

  for (const id of itemIds) {
    if (!results.some((r) => r.itemId === id)) {
      throw new Error(`Item ${id} not found in items XML`);
    }
  }

  return results.sort((a, b) => (a.itemId ?? 0) - (b.itemId ?? 0));
}
