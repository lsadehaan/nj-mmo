import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { merchantItems } from '../../db/schema';
import { parseMerchantBuylist } from '../parsers/buylist.parser';

export function seedMerchantItems(db: AppDatabase, dataDir: string): number {
  const xml = readFileSync(join(dataDir, 'buylist_30004.xml'), 'utf-8');
  const rows = parseMerchantBuylist(xml);
  db.insert(merchantItems).values(rows).run();
  return rows.length;
}
