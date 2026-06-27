import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { experience } from '../../db/schema';
import { parseExperience } from '../parsers/experience.parser';

export function seedExperience(db: AppDatabase, dataDir: string): number {
  const xml = readExperienceXml(dataDir);
  const rows = parseExperience(xml);
  db.insert(experience).values(rows).run();
  return rows.length;
}

function readExperienceXml(dataDir: string): string {
  const fixture = join(dataDir, 'experience.xml');
  if (existsSync(fixture)) {
    return readFileSync(fixture, 'utf-8');
  }

  const file = join(dataDir, 'stats/players/experience.xml');
  if (!existsSync(file)) {
    throw new Error(`Experience source XML not found: ${file}`);
  }
  return readFileSync(file, 'utf-8');
}
