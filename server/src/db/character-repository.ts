import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { SPAWN_X, SPAWN_Y, SPAWN_Z } from '@nj/game-core';
import type { QuestRuntimeState } from '@nj/game-core';
import type { AppDatabase } from './client';
import {
  characters,
  characterItems,
  characterSkills,
  characterQuests,
  classSkillTree,
  items,
  type Character,
} from './schema';
import { loadClassVitalsAtLevel } from './class-template-repository';

const STARTER_NAME = 'Adventurer';
const STARTER_ADENA = 1000;
const DEFAULT_CLASS_ID = 0;
const DEFAULT_SEX = 0;
export const MAX_CHARACTERS_PER_ACCOUNT = 3;
export const CHARACTER_NAME_MIN = 3;
export const CHARACTER_NAME_MAX = 16;

export interface CharacterListRow {
  id: string;
  name: string;
  level: number;
  classId: number;
}

export function isValidCharacterName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= CHARACTER_NAME_MIN && trimmed.length <= CHARACTER_NAME_MAX;
}

const FIGHTER_CLASS_IDS = new Set([0, 18, 31, 44, 53]);
const MYSTIC_CLASS_IDS = new Set([10, 25, 38, 49]);

export type CharacterItemCounts = Record<number, number>;
export type CharacterSkillLevels = Record<number, number>;

export interface CreateCharacterOptions {
  classId?: number;
  sex?: 0 | 1;
  accountName?: string;
  name?: string;
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

export function listCharactersByAccount(
  db: AppDatabase,
  accountName: string
): CharacterListRow[] {
  return db
    .select({
      id: characters.id,
      name: characters.name,
      level: characters.level,
      classId: characters.classId,
    })
    .from(characters)
    .where(eq(characters.accountName, accountName))
    .all();
}

export function countCharactersByAccount(db: AppDatabase, accountName: string): number {
  return listCharactersByAccount(db, accountName).length;
}

export function findCharacterByNameOnAccount(
  db: AppDatabase,
  accountName: string,
  name: string
): Character | undefined {
  return db
    .select()
    .from(characters)
    .where(and(eq(characters.accountName, accountName), eq(characters.name, name)))
    .get();
}

export function createCharacter(
  db: AppDatabase,
  opts: CreateCharacterOptions = {}
): Character {
  const classId = opts.classId ?? DEFAULT_CLASS_ID;
  const sex = opts.sex ?? DEFAULT_SEX;
  const accountName = opts.accountName ?? '';
  const name = opts.name?.trim() ?? STARTER_NAME;

  if (accountName && opts.name !== undefined && !isValidCharacterName(name)) {
    throw new Error('invalid character name');
  }
  if (accountName && findCharacterByNameOnAccount(db, accountName, name)) {
    throw new Error('duplicate character name');
  }
  if (accountName && countCharactersByAccount(db, accountName) >= MAX_CHARACTERS_PER_ACCOUNT) {
    throw new Error('character cap reached');
  }

  const vitals = loadClassVitalsAtLevel(db, classId, 1) ?? {
    maxHp: 100,
    maxMp: 50,
  };

  const row: Character = {
    id: randomUUID(),
    name,
    accountName,
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
    sp: 0,
    karma: 0,
    pvpKills: 0,
    pkKills: 0,
    expBeforeDeath: 0,
    unspentStatPoints: 0,
    bonusStr: 0,
    bonusDex: 0,
    bonusCon: 0,
    bonusInt: 0,
    bonusWit: 0,
    bonusMen: 0,
    pvpFlagEndMs: 0,
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
        sp: row.sp,
        karma: row.karma,
        pvpKills: row.pvpKills,
        pkKills: row.pkKills,
        expBeforeDeath: row.expBeforeDeath,
        unspentStatPoints: row.unspentStatPoints,
        bonusStr: row.bonusStr,
        bonusDex: row.bonusDex,
        bonusCon: row.bonusCon,
        bonusInt: row.bonusInt,
        bonusWit: row.bonusWit,
        bonusMen: row.bonusMen,
        pvpFlagEndMs: row.pvpFlagEndMs,
        accountName: row.accountName,
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

export function loadCharacterQuests(
  db: AppDatabase,
  characterId: string
): QuestRuntimeState[] {
  const rows = db
    .select()
    .from(characterQuests)
    .where(eq(characterQuests.characterId, characterId))
    .all();
  return rows.map((row) => ({
    questId: row.questId,
    status: row.status as QuestRuntimeState['status'],
    step: row.step,
    counters: JSON.parse(row.countersJson) as number[],
  }));
}

export function saveCharacterQuest(
  db: AppDatabase,
  characterId: string,
  entry: QuestRuntimeState
): void {
  db.insert(characterQuests)
    .values({
      characterId,
      questId: entry.questId,
      status: entry.status,
      step: entry.step,
      countersJson: JSON.stringify(entry.counters),
    })
    .onConflictDoUpdate({
      target: [characterQuests.characterId, characterQuests.questId],
      set: {
        status: entry.status,
        step: entry.step,
        countersJson: JSON.stringify(entry.counters),
      },
    })
    .run();
}

export function upsertQuestProgress(
  db: AppDatabase,
  characterId: string,
  entry: QuestRuntimeState
): void {
  saveCharacterQuest(db, characterId, entry);
}

export function isQuestItem(db: AppDatabase, itemId: number): boolean {
  const row = db.select().from(items).where(eq(items.itemId, itemId)).get();
  return row?.isQuestItem ?? false;
}
