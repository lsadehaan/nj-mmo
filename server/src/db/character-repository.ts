import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { SPAWN_X, SPAWN_Y, SPAWN_Z } from '@nj/game-core';
import type { AppDatabase } from './client';
import { characters, characterItems, type Character } from './schema';
import { loadClassVitalsAtLevel } from './class-template-repository';

const STARTER_NAME = 'Adventurer';
const STARTER_ADENA = 1000;
const DEFAULT_CLASS_ID = 0;
const DEFAULT_SEX = 0;

export type CharacterItemCounts = Record<number, number>;

export interface CreateCharacterOptions {
  classId?: number;
  sex?: 0 | 1;
}

export function createCharacter(
  db: AppDatabase,
  opts: CreateCharacterOptions = {}
): Character {
  const classId = opts.classId ?? DEFAULT_CLASS_ID;
  const sex = opts.sex ?? DEFAULT_SEX;

  const vitals = loadClassVitalsAtLevel(db, classId, 1) ?? {
    maxHp: 100,
    maxMp: 50,
  };

  const row: Character = {
    id: randomUUID(),
    name: STARTER_NAME,
    classId,
    sex,
    level: 1,
    xp: 0,
    hp: vitals.maxHp,
    mp: vitals.maxMp,
    maxHp: vitals.maxHp,
    maxMp: vitals.maxMp,
    equippedWeaponItemId: null,
    adena: STARTER_ADENA,
    starterKitGranted: false,
    x: SPAWN_X,
    y: SPAWN_Y,
    z: SPAWN_Z,
    updatedAt: Date.now(),
  };
  db.insert(characters).values(row).run();
  return row;
}

export function loadCharacter(db: AppDatabase, id: string): Character | undefined {
  return db.select().from(characters).where(eq(characters.id, id)).get();
}

export function saveCharacter(db: AppDatabase, row: Character): void {
  const updatedAt = Date.now();
  db.insert(characters)
    .values({ ...row, updatedAt })
    .onConflictDoUpdate({
      target: characters.id,
      set: {
        name: row.name,
        classId: row.classId,
        sex: row.sex,
        level: row.level,
        xp: row.xp,
        hp: row.hp,
        mp: row.mp,
        maxHp: row.maxHp,
        maxMp: row.maxMp,
        equippedWeaponItemId: row.equippedWeaponItemId,
        adena: row.adena,
        starterKitGranted: row.starterKitGranted,
        x: row.x,
        y: row.y,
        z: row.z,
        updatedAt,
      },
    })
    .run();
}

export function loadCharacterItems(
  db: AppDatabase,
  characterId: string
): CharacterItemCounts {
  const rows = db
    .select()
    .from(characterItems)
    .where(eq(characterItems.characterId, characterId))
    .all();
  const items: CharacterItemCounts = {};
  for (const row of rows) {
    items[row.itemId] = row.count;
  }
  return items;
}

export function saveCharacterItems(
  db: AppDatabase,
  characterId: string,
  items: CharacterItemCounts
): void {
  db.delete(characterItems).where(eq(characterItems.characterId, characterId)).run();
  const rows = Object.entries(items)
    .map(([itemId, count]) => ({
      characterId,
      itemId: Number(itemId),
      count,
    }))
    .filter((row) => row.count > 0);
  if (rows.length === 0) {
    return;
  }
  db.insert(characterItems).values(rows).run();
}
