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
  aiType: text('ai_type'),
  clan: text('clan'),
  clanHelpRange: integer('clan_help_range'),
  preferredAttackRange: integer('preferred_attack_range'),
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
  hitTime: integer('hit_time').notNull().default(0),
  isMagic: integer('is_magic', { mode: 'boolean' }).notNull().default(false),
  effectKind: text('effect_kind').notNull().default('physical_damage'),
  abnormalTime: integer('abnormal_time').notNull().default(0),
  buffMultiplier: real('buff_multiplier'),
  debuffMultiplier: real('debuff_multiplier'),
});

export const classSkillTree = sqliteTable(
  'class_skill_tree',
  {
    classId: integer('class_id').notNull(),
    skillId: integer('skill_id').notNull(),
    skillLevel: integer('skill_level').notNull(),
    getLevel: integer('get_level').notNull(),
    levelUpSp: integer('level_up_sp').notNull(),
    autoGet: integer('auto_get', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.classId, table.skillId, table.skillLevel],
    }),
  })
);

export const characterSkills = sqliteTable(
  'character_skills',
  {
    characterId: text('character_id').notNull(),
    skillId: integer('skill_id').notNull(),
    skillLevel: integer('skill_level').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.characterId, table.skillId] }),
  })
);

export const experience = sqliteTable('experience', {
  level: integer('level').primaryKey(),
  xpToNextLevel: integer('xp_to_next_level').notNull(),
  trainingRate: real('training_rate').notNull(),
});

export const experienceLoss = sqliteTable('experience_loss', {
  level: integer('level').primaryKey(),
  percentLost: real('percent_lost').notNull(),
});

export const items = sqliteTable('items', {
  itemId: integer('item_id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  crystalType: text('crystal_type'),
  pAtk: real('p_atk'),
  pDef: real('p_def'),
  mDef: real('m_def'),
  randomDamage: integer('random_damage'),
  bodyPart: text('body_part'),
  weaponType: text('weapon_type'),
  enchantEnabled: integer('enchant_enabled', { mode: 'boolean' }).notNull().default(false),
  recipeId: integer('recipe_id'),
  isStackable: integer('is_stackable', { mode: 'boolean' }).notNull().default(false),
  isQuestItem: integer('is_quest_item', { mode: 'boolean' }).notNull().default(false),
  weight: integer('weight').notNull().default(0),
});

export const recipes = sqliteTable('recipes', {
  recipeId: integer('recipe_id').primaryKey(),
  name: text('name').notNull(),
  craftLevel: integer('craft_level').notNull(),
  successRate: integer('success_rate').notNull(),
  mpCost: integer('mp_cost').notNull(),
  productItemId: integer('product_item_id').notNull(),
  productCount: integer('product_count').notNull(),
  ingredientsJson: text('ingredients_json').notNull(),
});

export const armorSets = sqliteTable('armor_sets', {
  setId: integer('set_id').primaryKey(),
  requiredItemIdsJson: text('required_item_ids_json').notNull(),
  pDefPercentBonus: real('p_def_percent_bonus').notNull(),
  maxHpBonus: integer('max_hp_bonus').notNull(),
});

export const characterEquipment = sqliteTable(
  'character_equipment',
  {
    characterId: text('character_id').notNull(),
    slot: text('slot').notNull(),
    itemId: integer('item_id').notNull(),
    enchantLevel: integer('enchant_level').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.characterId, table.slot] }),
  })
);

export const quests = sqliteTable('quests', {
  questId: integer('quest_id').primaryKey(),
  name: text('name').notNull(),
  minLevel: integer('min_level').notNull(),
  stubGiverNpcId: integer('stub_giver_npc_id').notNull(),
  autoStart: integer('auto_start', { mode: 'boolean' }).notNull().default(false),
});

export const questObjectives = sqliteTable('quest_objectives', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  questId: integer('quest_id').notNull(),
  stepIndex: integer('step_index').notNull(),
  objectiveIndex: integer('objective_index').notNull(),
  kind: text('kind').notNull(),
  mobNpcId: integer('mob_npc_id'),
  npcId: integer('npc_id'),
  itemId: integer('item_id'),
  count: integer('count').notNull(),
  description: text('description').notNull(),
});

export const questRewards = sqliteTable('quest_rewards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  questId: integer('quest_id').notNull(),
  xp: integer('xp').notNull().default(0),
  adena: integer('adena').notNull().default(0),
  itemId: integer('item_id'),
  itemCount: integer('item_count').notNull().default(0),
  rewardClass: text('reward_class'),
});

export const characterQuests = sqliteTable(
  'character_quests',
  {
    characterId: text('character_id').notNull(),
    questId: integer('quest_id').notNull(),
    status: text('status').notNull(),
    step: integer('step').notNull(),
    countersJson: text('counters_json').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.characterId, table.questId] }),
  })
);

export const characterFriends = sqliteTable(
  'character_friends',
  {
    characterId: text('character_id').notNull(),
    friendCharacterId: text('friend_character_id').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.characterId, table.friendCharacterId] }),
  })
);

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

export const warehouseItems = sqliteTable(
  'warehouse_items',
  {
    characterId: text('character_id').notNull(),
    itemId: integer('item_id').notNull(),
    count: integer('count').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.characterId, table.itemId] }),
  })
);

export const teleportDestinations = sqliteTable(
  'teleport_destinations',
  {
    npcId: integer('npc_id').notNull(),
    destinationId: text('destination_id').notNull(),
    displayName: text('display_name').notNull(),
    localX: real('local_x').notNull(),
    localZ: real('local_z').notNull(),
    feeAdena: integer('fee_adena').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.npcId, table.destinationId] }),
  })
);

export const classTemplates = sqliteTable('class_templates', {
  classId: integer('class_id').primaryKey(),
  name: text('name').notNull(),
  race: text('race').notNull(),
  archetype: text('archetype').notNull(),
  baseStr: integer('base_str').notNull(),
  baseDex: integer('base_dex').notNull(),
  baseCon: integer('base_con').notNull(),
  baseInt: integer('base_int').notNull(),
  baseWit: integer('base_wit').notNull(),
  baseMen: integer('base_men').notNull(),
  basePAtk: real('base_p_atk').notNull(),
  baseRandomDamage: integer('base_random_damage').notNull(),
  basePAtkSpd: integer('base_p_atk_spd').notNull(),
  baseCritRate: real('base_crit_rate').notNull(),
  baseMAtk: real('base_m_atk').notNull().default(6),
});

export const classLevelVitals = sqliteTable(
  'class_level_vitals',
  {
    classId: integer('class_id').notNull(),
    level: integer('level').notNull(),
    hp: real('hp').notNull(),
    mp: real('mp').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.classId, table.level] }),
  })
);

export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  classId: integer('class_id').notNull().default(0),
  sex: integer('sex').notNull().default(0),
  level: integer('level').notNull(),
  xp: integer('xp').notNull(),
  hp: real('hp').notNull(),
  mp: real('mp').notNull(),
  maxHp: real('max_hp').notNull().default(100),
  maxMp: real('max_mp').notNull().default(50),
  equippedWeaponItemId: integer('equipped_weapon_item_id'),
  adena: integer('adena').notNull().default(1000),
  starterKitGranted: integer('starter_kit_granted', { mode: 'boolean' })
    .notNull()
    .default(false),
  x: real('x').notNull(),
  y: real('y').notNull(),
  z: real('z').notNull(),
  updatedAt: integer('updated_at').notNull(),
  sp: integer('sp').notNull().default(0),
  karma: integer('karma').notNull().default(0),
  pvpKills: integer('pvp_kills').notNull().default(0),
  pkKills: integer('pk_kills').notNull().default(0),
  expBeforeDeath: integer('exp_before_death').notNull().default(0),
  unspentStatPoints: integer('unspent_stat_points').notNull().default(0),
  bonusStr: integer('bonus_str').notNull().default(0),
  bonusDex: integer('bonus_dex').notNull().default(0),
  bonusCon: integer('bonus_con').notNull().default(0),
  bonusInt: integer('bonus_int').notNull().default(0),
  bonusWit: integer('bonus_wit').notNull().default(0),
  bonusMen: integer('bonus_men').notNull().default(0),
  pvpFlagEndMs: integer('pvp_flag_end_ms').notNull().default(0),
  accountName: text('account_name').notNull().default(''),
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
export type ClassSkillTreeRow = typeof classSkillTree.$inferSelect;
export type NewClassSkillTreeRow = typeof classSkillTree.$inferInsert;
export type CharacterSkill = typeof characterSkills.$inferSelect;
export type NewCharacterSkill = typeof characterSkills.$inferInsert;
export type ExperienceRow = typeof experience.$inferSelect;
export type NewExperienceRow = typeof experience.$inferInsert;
export type ExperienceLossRow = typeof experienceLoss.$inferSelect;
export type NewExperienceLossRow = typeof experienceLoss.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type ArmorSet = typeof armorSets.$inferSelect;
export type NewArmorSet = typeof armorSets.$inferInsert;
export type CharacterEquipment = typeof characterEquipment.$inferSelect;
export type NewCharacterEquipment = typeof characterEquipment.$inferInsert;
export type Quest = typeof quests.$inferSelect;
export type NewQuest = typeof quests.$inferInsert;
export type QuestObjective = typeof questObjectives.$inferSelect;
export type NewQuestObjective = typeof questObjectives.$inferInsert;
export type QuestReward = typeof questRewards.$inferSelect;
export type NewQuestReward = typeof questRewards.$inferInsert;
export type CharacterQuest = typeof characterQuests.$inferSelect;
export type NewCharacterQuest = typeof characterQuests.$inferInsert;
export type CharacterFriend = typeof characterFriends.$inferSelect;
export type NewCharacterFriend = typeof characterFriends.$inferInsert;
export type MerchantItem = typeof merchantItems.$inferSelect;
export type NewMerchantItem = typeof merchantItems.$inferInsert;
export type NpcSpawn = typeof npcSpawns.$inferSelect;
export type NewNpcSpawn = typeof npcSpawns.$inferInsert;
export type ClassTemplate = typeof classTemplates.$inferSelect;
export type NewClassTemplate = typeof classTemplates.$inferInsert;
export type ClassLevelVital = typeof classLevelVitals.$inferSelect;
export type NewClassLevelVital = typeof classLevelVitals.$inferInsert;
export type CharacterItem = typeof characterItems.$inferSelect;
export type NewCharacterItem = typeof characterItems.$inferInsert;
export type WarehouseItem = typeof warehouseItems.$inferSelect;
export type NewWarehouseItem = typeof warehouseItems.$inferInsert;
export type TeleportDestination = typeof teleportDestinations.$inferSelect;
export type NewTeleportDestination = typeof teleportDestinations.$inferInsert;
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;

export const schema = {
  classTemplates,
  classLevelVitals,
  monsters,
  mobDrops,
  mobSpawns,
  npcs,
  skills,
  classSkillTree,
  characterSkills,
  experience,
  experienceLoss,
  items,
  recipes,
  armorSets,
  characterEquipment,
  merchantItems,
  npcSpawns,
  characterItems,
  warehouseItems,
  teleportDestinations,
  characters,
  quests,
  questObjectives,
  questRewards,
  characterQuests,
  characterFriends,
};
