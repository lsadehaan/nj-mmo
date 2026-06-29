import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { SPAWN_X, SPAWN_Y, SPAWN_Z } from '@nj/game-core';
import type { AppDatabase } from './client';
import {
  characters,
  characterItems,
  characterSkills,
  classSkillTree,
  type Character,
} from './schema';
import { loadClassVitalsAtLevel } from './class-template-repository';

const STARTER_NAME = 'Adventurer';
const STARTER_ADENA = 1000;
const DEFAULT_CLASS_ID = 0;
const DEFAULT_SEX = 0;

const FIGHTER_CLASS_IDS = new Set([0, 18, 31, 44, 53]);
const MYSTIC_CLASS_IDS = new Set([10, 25, 38, 49]);

export type CharacterItemCounts = Record<number, number>;
export type CharacterSkillLevels = Record<number, number>;

export interface CreateCharacterOptions {
  classId?: number;
  sex?: 0 | 1;
}

export function loadCharacterSkills(
  db: AppDatabase,
  characterId: string
): CharacterSkillLevels {
  const rows = db
    .select()
    .from(characterSkills)
    .where(eq(characterSkills.characterId, characterId))
    .all();
  const skills: CharacterSkillLevels = {};
  for (const row of rows) {
    skills[row.skillId] = row.skillLevel;
  }
  return skills;
}

export function saveCharacterSkills(
  db: AppDatabase,
  characterId: string,
  skills: CharacterSkillLevels
): void {
  db.delete(characterSkills)
    .where(eq(characterSkills.characterId, characterId))
    .run();
  const rows = Object.entries(skills)
    .map(([skillId, skillLevel]) => ({
      characterId,
      skillId: Number(skillId),
      skillLevel,
    }))
    .filter((row) => row.skillLevel > 0);
  if (rows.length === 0) return;
  db.insert(characterSkills).values(rows).run();
}

export function grantAutoGetSkills(
  db: AppDatabase,
  characterId: string,
  classId: number
): CharacterSkillLevels {
  const rows = db
    .select()
    .from(classSkillTree)
    .where(
      and(
        eq(classSkillTree.classId, classId),
        eq(classSkillTree.autoGet, true)
      )
    )
    .all();

  const skills: CharacterSkillLevels = {};
  for (const row of rows) {
    if (!skills[row.skillId] || row.skillLevel === 1) {
      skills[row.skillId] = row.skillLevel;
    }
  }

  if (Object.keys(skills).length > 0) {
    saveCharacterSkills(db, characterId, skills);
  }
  return skills;
}

export function migrateLegacyCharacterSkills(
  db: AppDatabase,
  character: Character
): CharacterSkillLevels {
  const existing = loadCharacterSkills(db, character.id);
  if (Object.keys(existing).length > 0) {
    return existing;
  }

  const skills: CharacterSkillLevels = { ...existing };

  if (FIGHTER_CLASS_IDS.has(character.classId)) {
    skills[3] = 1;
  } else if (MYSTIC_CLASS_IDS.has(character.classId)) {
    const autoRows = db
      .select()
      .from(classSkillTree)
      .where(
        and(
          eq(classSkillTree.classId, character.classId),
          eq(classSkillTree.autoGet, true)
        )
      )
      .all();
    for (const row of autoRows) {
      skills[row.skillId] = row.skillLevel;
    }
  }

  if (Object.keys(skills).length > 0) {
    saveCharacterSkills(db, character.id, skills);
  }
  return skills;
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
  grantAutoGetSkills(db, row.id, classId);
  return row;
}

export function loadCharacter(db: AppDatabase, id: string): Character | undefined {
  const row = db.select().from(characters).where(eq(characters.id, id)).get();
  if (!row) return undefined;
  migrateLegacyCharacterSkills(db, row);
  return row;
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
