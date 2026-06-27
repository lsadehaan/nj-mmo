import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { skills } from '../../db/schema';
import { parsePowerStrike } from '../parsers/skills.parser';

export function seedSkills(db: AppDatabase, dataDir: string): number {
  const xml = readSkillXml(dataDir);
  const row = parsePowerStrike(xml);
  db.insert(skills).values(row).run();
  return 1;
}

function readSkillXml(dataDir: string): string {
  const fixture = join(dataDir, 'skills.xml');
  if (existsSync(fixture)) {
    return readFileSync(fixture, 'utf-8');
  }

  const file = join(dataDir, 'stats/skills/00000-00099.xml');
  if (!existsSync(file)) {
    throw new Error(`Skill source XML not found: ${file}`);
  }
  return readFileSync(file, 'utf-8');
}
