import { sqliteTable, integer, text, real, primaryKey } from 'drizzle-orm/sqlite-core';

export const monsters = sqliteTable('monsters', {
  npcId: integer('npc_id').primaryKey(),
  name: text('name').notNull(),
  level: integer('level').notNull(),
  type: text('type').notNull(),
  race: text('race').notNull(),
  exp: integer('exp').notNull(),
  sp: integer('sp').notNull(),
  hp: real('hp').notNull(),
  mp: real('mp').notNull(),
  pAtk: real('p_atk').notNull(),
  pDef: real('p_def').notNull(),
  attackSpeed: integer('attack_speed').notNull(),
  random: integer('random').notNull(),
  critical: real('critical').notNull(),
  accuracy: real('accuracy').notNull(),
  attackRange: integer('attack_range').notNull(),
  aggroRange: integer('aggro_range').notNull(),
  isAggressive: integer('is_aggressive', { mode: 'boolean' }).notNull(),
  respawnSec: integer('respawn_sec').notNull(),
});

export const mobDrops = sqliteTable('mob_drops', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  npcId: integer('npc_id').notNull(),
  itemId: integer('item_id').notNull(),
  minCount: integer('min_count').notNull(),
  maxCount: integer('max_count').notNull(),
  chance: real('chance').notNull(),
});

export const mobSpawns = sqliteTable('mob_spawns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  npcId: integer('npc_id').notNull(),
  x: real('x').notNull(),
  y: real('y').notNull(),
  z: real('z').notNull(),
  respawnSec: integer('respawn_sec').notNull(),
});

export const npcs = sqliteTable('npcs', {
  npcId: integer('npc_id').primaryKey(),
  name: text('name').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  level: integer('level').notNull(),
});

export const skills = sqliteTable('skills', {
  skillId: integer('skill_id').primaryKey(),
  name: text('name').notNull(),
  maxLevel: integer('max_level').notNull(),
  operateType: text('operate_type').notNull(),
  targetType: text('target_type').notNull(),
  castRange: integer('cast_range').notNull(),
  reuseDelay: integer('reuse_delay').notNull(),
  mpConsumeL1: integer('mp_consume_l1').notNull(),
  powerL1: integer('power_l1').notNull(),
});

export const experience = sqliteTable('experience', {
  level: integer('level').primaryKey(),
  xpToNextLevel: integer('xp_to_next_level').notNull(),
  trainingRate: real('training_rate').notNull(),
});

export const merchantItems = sqliteTable('merchant_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  npcId: integer('npc_id').notNull(),
  itemId: integer('item_id').notNull(),
  name: text('name').notNull(),
  buyPrice: integer('buy_price').notNull(),
  sellPrice: integer('sell_price').notNull(),
});

export const npcSpawns = sqliteTable('npc_spawns', {
  npcId: integer('npc_id').primaryKey(),
  x: real('x').notNull(),
  y: real('y').notNull(),
  z: real('z').notNull(),
  heading: real('heading'),
});

export const characterItems = sqliteTable(
  'character_items',
  {
    characterId: text('character_id').notNull(),
    itemId: integer('item_id').notNull(),
    count: integer('count').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.characterId, table.itemId] }),
  })
);

export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  level: integer('level').notNull(),
  xp: integer('xp').notNull(),
  hp: real('hp').notNull(),
  mp: real('mp').notNull(),
  adena: integer('adena').notNull().default(1000),
  starterKitGranted: integer('starter_kit_granted', { mode: 'boolean' })
    .notNull()
    .default(false),
  x: real('x').notNull(),
  y: real('y').notNull(),
  z: real('z').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type Monster = typeof monsters.$inferSelect;
export type NewMonster = typeof monsters.$inferInsert;
export type MobDrop = typeof mobDrops.$inferSelect;
export type NewMobDrop = typeof mobDrops.$inferInsert;
export type MobSpawn = typeof mobSpawns.$inferSelect;
export type NewMobSpawn = typeof mobSpawns.$inferInsert;
export type Npc = typeof npcs.$inferSelect;
export type NewNpc = typeof npcs.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type ExperienceRow = typeof experience.$inferSelect;
export type NewExperienceRow = typeof experience.$inferInsert;
export type MerchantItem = typeof merchantItems.$inferSelect;
export type NewMerchantItem = typeof merchantItems.$inferInsert;
export type NpcSpawn = typeof npcSpawns.$inferSelect;
export type NewNpcSpawn = typeof npcSpawns.$inferInsert;
export type CharacterItem = typeof characterItems.$inferSelect;
export type NewCharacterItem = typeof characterItems.$inferInsert;
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;

export const schema = {
  monsters,
  mobDrops,
  mobSpawns,
  npcs,
  skills,
  experience,
  merchantItems,
  npcSpawns,
  characterItems,
  characters,
};
