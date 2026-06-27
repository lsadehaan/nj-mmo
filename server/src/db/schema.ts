import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

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
});

export const experience = sqliteTable('experience', {
  level: integer('level').primaryKey(),
  xpToNextLevel: integer('xp_to_next_level').notNull(),
  trainingRate: real('training_rate').notNull(),
});

export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  level: integer('level').notNull(),
  xp: integer('xp').notNull(),
  hp: real('hp').notNull(),
  mp: real('mp').notNull(),
  x: real('x').notNull(),
  y: real('y').notNull(),
  z: real('z').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type Monster = typeof monsters.$inferSelect;
export type NewMonster = typeof monsters.$inferInsert;
export type Npc = typeof npcs.$inferSelect;
export type NewNpc = typeof npcs.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type ExperienceRow = typeof experience.$inferSelect;
export type NewExperienceRow = typeof experience.$inferInsert;
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;

export const schema = { monsters, npcs, skills, experience, characters };
