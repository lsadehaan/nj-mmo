import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { classLevelVitals, classTemplates } from '../../db/schema';
import { parseAllStartingClasses, parseStartingClassXml, parseClassListSnippet } from '../parsers/class-templates.parser';

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

const FIRST_CLASS_FILES = [
  'Warrior.xml',
  'HumanKnight.xml',
  'Rogue.xml',
  'HumanWizard.xml',
  'Cleric.xml',
  'ElvenKnight.xml',
  'ElvenScout.xml',
  'ElvenWizard.xml',
  'ElvenOracle.xml',
  'PalusKnight.xml',
  'Assassin.xml',
  'DarkWizard.xml',
  'ShillienOracle.xml',
  'OrcRaider.xml',
  'OrcMonk.xml',
  'OrcShaman.xml',
  'Scavenger.xml',
  'Artisan.xml',
] as const;

export function seedClassTemplates(db: AppDatabase, dataDir: string): number {
  const playersDir = join(dataDir, 'players');
  const startingDir = join(playersDir, 'StartingClass');
  const firstClassDir = join(playersDir, 'FirstClass');

  const classXmls = STARTING_CLASS_FILES.map((file) =>
    readFileSync(join(startingDir, file), 'utf-8')
  );
  const classListXml = readFileSync(join(playersDir, 'classList_snippet.xml'), 'utf-8');

  const { templates: starters, vitals: starterVitals } = parseAllStartingClasses(
    classXmls,
    classListXml
  );

  const classNames = parseClassListSnippet(classListXml);
  const firstTemplates = [];
  const firstVitals = [];
  for (const file of FIRST_CLASS_FILES) {
    const xml = readFileSync(join(firstClassDir, file), 'utf-8');
    const parsed = parseStartingClassXml(xml, classNames);
    firstTemplates.push(parsed.template);
    firstVitals.push(...parsed.vitals);
  }

  const templates = [...starters, ...firstTemplates];
  const vitals = [...starterVitals, ...firstVitals];

  db.insert(classTemplates).values(templates).run();
  db.insert(classLevelVitals).values(vitals).run();

  return templates.length;
}

export function readStartingClassFixtureNames(dataDir: string): string[] {
  const startingDir = join(dataDir, 'players', 'StartingClass');
  return readdirSync(startingDir).filter((f) => f.endsWith('.xml'));
}
