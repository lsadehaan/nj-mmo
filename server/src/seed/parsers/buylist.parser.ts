import type { NewMerchantItem } from '../../db/schema';
import { xmlParser, parseNumber } from './xml-utils';

const KATERINA_NPC_ID = 30004;

const SHOP_ITEM_IDS = [1060, 1835, 17] as const;

const ITEM_NAMES: Record<(typeof SHOP_ITEM_IDS)[number], string> = {
  1060: 'Healing Potion',
  1835: 'Soulshot',
  17: 'Wooden Arrow',
};

interface BuylistItemNode {
  '@_id': string;
  '@_price': string;
}

export function parseMerchantBuylist(xml: string, npcId = KATERINA_NPC_ID): NewMerchantItem[] {
  const doc = xmlParser.parse(xml) as { list?: { item?: BuylistItemNode | BuylistItemNode[] } };
  const nodes = doc.list?.item;
  if (!nodes) {
    throw new Error('Buylist XML missing item nodes');
  }

  const itemList = Array.isArray(nodes) ? nodes : [nodes];
  const idSet = new Set(SHOP_ITEM_IDS.map(String));
  const results: NewMerchantItem[] = [];

  for (const node of itemList) {
    const itemId = parseNumber(node['@_id'], 'itemId', node['@_id']);
    if (!idSet.has(String(itemId))) continue;

    const buyPrice = parseNumber(itemId, 'price', node['@_price']);
    const name = ITEM_NAMES[itemId as (typeof SHOP_ITEM_IDS)[number]];
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

  for (const want of SHOP_ITEM_IDS) {
    if (!results.some((r) => r.itemId === want)) {
      throw new Error(`Shop item ${want} not found in buylist XML`);
    }
  }

  return results.sort((a, b) => (a.itemId ?? 0) - (b.itemId ?? 0));
}
