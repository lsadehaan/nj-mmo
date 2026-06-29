import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { merchantItems } from '../../db/schema';
import { parseMerchantBuylist } from '../parsers/buylist.parser';

const MERCHANT_BUYLISTS = [
  {
    npcId: 30004,
    file: 'buylist_30004.xml',
    itemIds: [1060, 1835, 17] as const,
    itemNames: {
      1060: 'Healing Potion',
      1835: 'Soulshot',
      17: 'Wooden Arrow',
    },
  },
  {
    npcId: 30001,
    file: 'buylist_30001.xml',
    itemIds: [1, 4, 13] as const,
    itemNames: {
      1: 'Short Sword',
      4: 'Club',
      13: 'Short Bow',
    },
  },
  {
    npcId: 30002,
    file: 'buylist_30002.xml',
    itemIds: [21, 28, 1121] as const,
    itemNames: {
      21: 'Shirt',
      28: 'Pants',
      1121: "Apprentice's Shoes",
    },
  },
  {
    npcId: 30003,
    file: 'buylist_30003.xml',
    itemIds: [116, 112, 118] as const,
    itemNames: {
      116: 'Magic Ring',
      112: "Apprentice's Earring",
      118: 'Necklace of Magic',
    },
  },
] as const;

export function seedMerchantItems(db: AppDatabase, dataDir: string): number {
  let total = 0;
  for (const merchant of MERCHANT_BUYLISTS) {
    const xml = readFileSync(join(dataDir, merchant.file), 'utf-8');
    const rows = parseMerchantBuylist(xml, {
      npcId: merchant.npcId,
      itemIds: merchant.itemIds,
      itemNames: merchant.itemNames,
    });
    db.insert(merchantItems).values(rows).run();
    total += rows.length;
  }
  return total;
}
