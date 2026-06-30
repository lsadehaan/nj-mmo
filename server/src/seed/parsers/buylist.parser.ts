import type { NewMerchantItem } from '../../db/schema';
import { xmlParser, parseNumber } from './xml-utils';

export interface MerchantBuylistConfig {
  npcId: number;
  itemIds: readonly number[];
  itemNames: Record<number, string>;
}

interface BuylistItemNode {
  '@_id': string;
  '@_price': string;
}

export function parseMerchantBuylist(
  xml: string,
  config: MerchantBuylistConfig
): NewMerchantItem[] {
  const { npcId, itemIds, itemNames } = config;
  const doc = xmlParser.parse(xml) as { list?: { item?: BuylistItemNode | BuylistItemNode[] } };
  const nodes = doc.list?.item;
  if (!nodes) {
    throw new Error('Buylist XML missing item nodes');
  }

  const itemList = Array.isArray(nodes) ? nodes : [nodes];
  const idSet = new Set(itemIds.map(String));
  const results: NewMerchantItem[] = [];

  for (const node of itemList) {
    const itemId = parseNumber(node['@_id'], 'itemId', node['@_id']);
    if (!idSet.has(String(itemId))) continue;

    const buyPrice = parseNumber(itemId, 'price', node['@_price']);
    const name = itemNames[itemId];
    if (!name) {
      throw new Error(`Missing display name for shop item ${itemId}`);
    }

    results.push({
      npcId,
      itemId,
      name,
      buyPrice,
      sellPrice: Math.floor(buyPrice / 2),
    });
  }

  for (const want of itemIds) {
    if (!results.some((r) => r.itemId === want)) {
      throw new Error(`Shop item ${want} not found in buylist XML`);
    }
  }

  return results.sort((a, b) => (a.itemId ?? 0) - (b.itemId ?? 0));
}

/** Parse every item row in a buylist XML; names resolved via lookup map. */
export function parseFullMerchantBuylist(
  xml: string,
  npcId: number,
  itemNames: Record<number, string>
): NewMerchantItem[] {
  const doc = xmlParser.parse(xml) as { list?: { item?: BuylistItemNode | BuylistItemNode[] } };
  const nodes = doc.list?.item;
  if (!nodes) {
    throw new Error('Buylist XML missing item nodes');
  }

  const itemList = Array.isArray(nodes) ? nodes : [nodes];
  const results: NewMerchantItem[] = [];

  for (const node of itemList) {
    const itemId = parseNumber(node['@_id'], 'itemId', node['@_id']);
    const buyPrice = parseNumber(itemId, 'price', node['@_price']);
    const name = itemNames[itemId];
    if (!name) {
      throw new Error(`Missing display name for shop item ${itemId} (npc ${npcId})`);
    }
    results.push({
      npcId,
      itemId,
      name,
      buyPrice,
      sellPrice: Math.floor(buyPrice / 2),
    });
  }

  return results.sort((a, b) => (a.itemId ?? 0) - (b.itemId ?? 0));
}
