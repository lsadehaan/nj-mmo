import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { skills } from '../../db/schema';
import { parseSkillsXml } from '../parsers/skills.parser';

export const TI_SKILL_IDS = [3, 29, 1068, 1100, 1164, 1177] as const;

export function seedSkills(db: AppDatabase, dataDir: string): number {
  const xml = readSkillsXml(dataDir);
  const rows = parseSkillsXml(xml, [...TI_SKILL_IDS]);
  db.insert(skills).values(rows).run();
  return rows.length;
}

function readSkillsXml(dataDir: string): string {
  const skillsDir = join(dataDir, 'skills');
  if (existsSync(skillsDir)) {
    const files = readdirSync(skillsDir).filter((f) => f.endsWith('.xml'));
    if (files.length > 0) {
      const parts = files
        .sort()
        .map((f) => {
          const text = readFileSync(join(skillsDir, f), 'utf-8');
          const inner = text.replace(/^[\s\S]*?<list[^>]*>/, '').replace(/<\/list>[\s\S]*$/, '');
          return inner.trim();
        })
        .filter(Boolean);
      return `<?xml version="1.0" encoding="UTF-8"?><list>${parts.join('\n')}</list>`;
    }
  }

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
