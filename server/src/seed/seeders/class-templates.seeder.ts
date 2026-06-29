import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { classLevelVitals, classTemplates } from '../../db/schema';
import { parseAllStartingClasses } from '../parsers/class-templates.parser';

const STARTING_CLASS_FILES = [
  'HumanFighter.xml',
  'HumanMystic.xml',
  'ElvenFighter.xml',
  'ElvenMystic.xml',
  'DarkFighter.xml',
  'DarkMystic.xml',
  'OrcFighter.xml',
  'OrcMystic.xml',
  'DwarvenFighter.xml',
] as const;

export function seedClassTemplates(db: AppDatabase, dataDir: string): number {
  const playersDir = join(dataDir, 'players');
  const startingDir = join(playersDir, 'StartingClass');

  const classXmls = STARTING_CLASS_FILES.map((file) =>
    readFileSync(join(startingDir, file), 'utf-8')
  );
  const classListXml = readFileSync(join(playersDir, 'classList_snippet.xml'), 'utf-8');

  const { templates, vitals } = parseAllStartingClasses(classXmls, classListXml);

  db.insert(classTemplates).values(templates).run();
  db.insert(classLevelVitals).values(vitals).run();

  return templates.length;
}

export function readStartingClassFixtureNames(dataDir: string): string[] {
  const startingDir = join(dataDir, 'players', 'StartingClass');
  return readdirSync(startingDir).filter((f) => f.endsWith('.xml'));
}
