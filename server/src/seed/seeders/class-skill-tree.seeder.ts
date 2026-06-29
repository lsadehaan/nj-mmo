import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { classSkillTree } from '../../db/schema';
import { parseClassSkillTreeXml } from '../parsers/class-skill-tree.parser';

export function seedClassSkillTree(db: AppDatabase, dataDir: string): number {
  const rows = readAllSkillTreeRows(dataDir);
  if (rows.length === 0) return 0;
  db.insert(classSkillTree).values(rows).run();
  return rows.length;
}

function readAllSkillTreeRows(dataDir: string): ReturnType<typeof parseClassSkillTreeXml> {
  const treeDir = join(dataDir, 'skillTrees/StartingClass');
  if (!existsSync(treeDir)) {
    const l2jDir = join(
      dataDir,
      'stats/players/skillTrees/StartingClass'
    );
    if (!existsSync(l2jDir)) {
      return [];
    }
    return readDirTrees(l2jDir);
  }
  return readDirTrees(treeDir);
}

function readDirTrees(dir: string) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.xml'));
  const allRows: ReturnType<typeof parseClassSkillTreeXml> = [];
  for (const file of files.sort()) {
    const xml = readFileSync(join(dir, file), 'utf-8');
    allRows.push(...parseClassSkillTreeXml(xml));
  }
  return allRows;
}
