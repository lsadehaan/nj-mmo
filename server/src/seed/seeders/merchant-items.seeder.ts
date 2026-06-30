import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { merchantItems } from '../../db/schema';
import { parseFullMerchantBuylist } from '../parsers/buylist.parser';
import { parseItemsXml } from '../parsers/items.parser';

const MERCHANT_BUYLISTS = [
  { npcId: 30004, file: 'buylist_30004.xml' },
  { npcId: 30001, file: 'buylist_30001.xml' },
  { npcId: 30002, file: 'buylist_30002.xml' },
  { npcId: 30003, file: 'buylist_30003.xml' },
  { npcId: 30298, file: 'buylist_30298.xml' },
] as const;

function buildItemNameMap(dataDir: string): Record<number, string> {
  const xml = readFileSync(join(dataDir, 'items_ti.xml'), 'utf-8');
  const rows = parseItemsXml(xml);
  const map: Record<number, string> = {};
  for (const row of rows) {
    if (row.itemId != null) {
      map[row.itemId] = row.name;
    }
  }
  return map;
}

export function seedMerchantItems(db: AppDatabase, dataDir: string): number {
  const itemNames = buildItemNameMap(dataDir);
  let total = 0;
  for (const merchant of MERCHANT_BUYLISTS) {
    const xml = readFileSync(join(dataDir, merchant.file), 'utf-8');
    const rows = parseFullMerchantBuylist(xml, merchant.npcId, itemNames);
    db.insert(merchantItems).values(rows).run();
    total += rows.length;
  }
  return total;
}
