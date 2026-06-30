import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppDatabase } from '../../db/client';
import { recipes } from '../../db/schema';
import { parseRecipesXml } from '../parsers/recipes.parser';

export function seedRecipes(db: AppDatabase, dataDir: string): number {
  const xml = readFileSync(join(dataDir, 'recipes_ti.xml'), 'utf-8');
  const rows = parseRecipesXml(xml);
  db.insert(recipes).values(rows).run();
  return rows.length;
}
