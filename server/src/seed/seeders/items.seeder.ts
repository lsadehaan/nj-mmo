import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { items } from '../../db/schema';
import { parseItemsXml } from '../parsers/items.parser';

export function seedItems(db: AppDatabase, dataDir: string): number {
  const xml = readFileSync(join(dataDir, 'items_ti.xml'), 'utf-8');
  const rows = parseItemsXml(xml);
  db.insert(items).values(rows).run();
  return rows.length;
}
