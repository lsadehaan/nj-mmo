import { eq, and } from 'drizzle-orm';
import type { AppDatabase } from './client';
import {
  classLevelVitals,
  classTemplates,
  type ClassLevelVital,
  type ClassTemplate,
} from './schema';

export function loadClassTemplate(
  db: AppDatabase,
  classId: number
): ClassTemplate | undefined {
  return db.select().from(classTemplates).where(eq(classTemplates.classId, classId)).get();
}

export function loadClassVitalsCurve(
  db: AppDatabase,
  classId: number
): ClassLevelVital[] {
  return db
    .select()
    .from(classLevelVitals)
    .where(eq(classLevelVitals.classId, classId))
    .all();
}

export function loadClassVitalsAtLevel(
  db: AppDatabase,
  classId: number,
  level: number
): { maxHp: number; maxMp: number } | undefined {
  const row = db
    .select()
    .from(classLevelVitals)
    .where(and(eq(classLevelVitals.classId, classId), eq(classLevelVitals.level, level)))
    .get();
  if (!row) return undefined;
  return { maxHp: row.hp, maxMp: row.mp };
}
