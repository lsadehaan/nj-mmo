import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { experienceLoss } from '../../db/schema';
import { parseExperienceLoss } from '../parsers/experience-loss.parser';

export function seedExperienceLoss(db: AppDatabase, dataDir: string): number {
  const xml = readExperienceLossXml(dataDir);
  const rows = parseExperienceLoss(xml);
  db.insert(experienceLoss).values(rows).run();
  return rows.length;
}

function readExperienceLossXml(dataDir: string): string {
  const fixture = join(dataDir, 'experienceLoss.xml');
  if (existsSync(fixture)) {
    return readFileSync(fixture, 'utf-8');
  }

  const file = join(dataDir, 'stats/players/experienceLoss.xml');
  if (!existsSync(file)) {
    throw new Error(`Experience loss source XML not found: ${file}`);
  }
  return readFileSync(file, 'utf-8');
}
