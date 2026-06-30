import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { schema } from './schema';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export function getDb(path: string): AppDatabase {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite, { schema });
  applySchema(sqlite);
  return db;
}

function applySchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS monsters (
      npc_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      level INTEGER NOT NULL,
      type TEXT NOT NULL,
      race TEXT NOT NULL,
      exp INTEGER NOT NULL,
      sp INTEGER NOT NULL,
      hp REAL NOT NULL,
      mp REAL NOT NULL,
      p_atk REAL NOT NULL DEFAULT 0,
      p_def REAL NOT NULL DEFAULT 0,
      attack_speed INTEGER NOT NULL DEFAULT 0,
      random INTEGER NOT NULL DEFAULT 0,
      critical REAL NOT NULL DEFAULT 0,
      accuracy REAL NOT NULL DEFAULT 0,
      attack_range INTEGER NOT NULL DEFAULT 0,
      aggro_range INTEGER NOT NULL DEFAULT 0,
      is_aggressive INTEGER NOT NULL DEFAULT 0,
      respawn_sec INTEGER NOT NULL DEFAULT 27
    );
    CREATE TABLE IF NOT EXISTS mob_drops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      min_count INTEGER NOT NULL,
      max_count INTEGER NOT NULL,
      chance REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mob_spawns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id INTEGER NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL NOT NULL,
      respawn_sec INTEGER NOT NULL DEFAULT 27
    );
    CREATE TABLE IF NOT EXISTS npcs (
      npc_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      level INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS skills (
      skill_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      max_level INTEGER NOT NULL,
      operate_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      cast_range INTEGER NOT NULL,
      reuse_delay INTEGER NOT NULL,
      mp_consume_l1 INTEGER NOT NULL,
      power_l1 INTEGER NOT NULL DEFAULT 0,
      hit_time INTEGER NOT NULL DEFAULT 0,
      is_magic INTEGER NOT NULL DEFAULT 0,
      effect_kind TEXT NOT NULL DEFAULT 'physical_damage',
      abnormal_time INTEGER NOT NULL DEFAULT 0,
      buff_multiplier REAL,
      debuff_multiplier REAL
    );
    CREATE TABLE IF NOT EXISTS experience (
      level INTEGER PRIMARY KEY,
      xp_to_next_level INTEGER NOT NULL,
      training_rate REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS class_templates (
      class_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      race TEXT NOT NULL,
      archetype TEXT NOT NULL,
      base_str INTEGER NOT NULL,
      base_dex INTEGER NOT NULL,
      base_con INTEGER NOT NULL,
      base_int INTEGER NOT NULL,
      base_wit INTEGER NOT NULL,
      base_men INTEGER NOT NULL,
      base_p_atk REAL NOT NULL,
      base_random_damage INTEGER NOT NULL,
      base_p_atk_spd INTEGER NOT NULL,
      base_crit_rate REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS class_level_vitals (
      class_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      hp REAL NOT NULL,
      mp REAL NOT NULL,
      PRIMARY KEY (class_id, level)
    );
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      class_id INTEGER NOT NULL DEFAULT 0,
      sex INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL,
      xp INTEGER NOT NULL,
      hp REAL NOT NULL,
      mp REAL NOT NULL,
      max_hp REAL NOT NULL DEFAULT 100,
      max_mp REAL NOT NULL DEFAULT 50,
      equipped_weapon_item_id INTEGER,
      adena INTEGER NOT NULL DEFAULT 1000,
      starter_kit_granted INTEGER NOT NULL DEFAULT 0,
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS items (
      item_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      crystal_type TEXT,
      p_atk REAL,
      p_def REAL,
      m_def REAL,
      random_damage INTEGER,
      body_part TEXT,
      weapon_type TEXT,
      enchant_enabled INTEGER NOT NULL DEFAULT 0,
      recipe_id INTEGER,
      is_stackable INTEGER NOT NULL DEFAULT 0,
      is_quest_item INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS recipes (
      recipe_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      craft_level INTEGER NOT NULL,
      success_rate INTEGER NOT NULL,
      mp_cost INTEGER NOT NULL,
      product_item_id INTEGER NOT NULL,
      product_count INTEGER NOT NULL,
      ingredients_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS armor_sets (
      set_id INTEGER PRIMARY KEY,
      required_item_ids_json TEXT NOT NULL,
      p_def_percent_bonus REAL NOT NULL,
      max_hp_bonus INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS character_equipment (
      character_id TEXT NOT NULL,
      slot TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      enchant_level INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (character_id, slot)
    );
    CREATE TABLE IF NOT EXISTS merchant_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      buy_price INTEGER NOT NULL,
      sell_price INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS npc_spawns (
      npc_id INTEGER PRIMARY KEY,
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL NOT NULL,
      heading REAL
    );
    CREATE TABLE IF NOT EXISTS character_items (
      character_id TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (character_id, item_id)
    );
    CREATE TABLE IF NOT EXISTS class_skill_tree (
      class_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      skill_level INTEGER NOT NULL,
      get_level INTEGER NOT NULL,
      level_up_sp INTEGER NOT NULL,
      auto_get INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (class_id, skill_id, skill_level)
    );
    CREATE TABLE IF NOT EXISTS character_skills (
      character_id TEXT NOT NULL,
      skill_id INTEGER NOT NULL,
      skill_level INTEGER NOT NULL,
      PRIMARY KEY (character_id, skill_id)
    );
    CREATE TABLE IF NOT EXISTS quests (
      quest_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      min_level INTEGER NOT NULL,
      stub_giver_npc_id INTEGER NOT NULL,
      auto_start INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS quest_objectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quest_id INTEGER NOT NULL,
      step_index INTEGER NOT NULL,
      objective_index INTEGER NOT NULL,
      kind TEXT NOT NULL,
      mob_npc_id INTEGER,
      npc_id INTEGER,
      item_id INTEGER,
      count INTEGER NOT NULL,
      description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS quest_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quest_id INTEGER NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      adena INTEGER NOT NULL DEFAULT 0,
      item_id INTEGER,
      item_count INTEGER NOT NULL DEFAULT 0,
      reward_class TEXT
    );
    CREATE TABLE IF NOT EXISTS character_quests (
      character_id TEXT NOT NULL,
      quest_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      step INTEGER NOT NULL,
      counters_json TEXT NOT NULL,
      PRIMARY KEY (character_id, quest_id)
    );
    CREATE TABLE IF NOT EXISTS character_friends (
      character_id TEXT NOT NULL,
      friend_character_id TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      PRIMARY KEY (character_id, friend_character_id)
    );
  `);
  migrateMonstersColumns(sqlite);
  migrateSkillsColumns(sqlite);
  migrateCharactersColumns(sqlite);
  migrateProgressionColumns(sqlite);
  migrateClassTables(sqlite);
  migrateClassTemplateColumns(sqlite);
  migrateItemsColumns(sqlite);
  migrateTownServiceTables(sqlite);
}

function migrateTownServiceTables(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS warehouse_items (
      character_id TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (character_id, item_id)
    );
    CREATE TABLE IF NOT EXISTS teleport_destinations (
      npc_id INTEGER NOT NULL,
      destination_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      local_x REAL NOT NULL,
      local_z REAL NOT NULL,
      fee_adena INTEGER NOT NULL,
      PRIMARY KEY (npc_id, destination_id)
    );
  `);
}

function migrateClassTables(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS class_templates (
      class_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      race TEXT NOT NULL,
      archetype TEXT NOT NULL,
      base_str INTEGER NOT NULL,
      base_dex INTEGER NOT NULL,
      base_con INTEGER NOT NULL,
      base_int INTEGER NOT NULL,
      base_wit INTEGER NOT NULL,
      base_men INTEGER NOT NULL,
      base_p_atk REAL NOT NULL,
      base_random_damage INTEGER NOT NULL,
      base_p_atk_spd INTEGER NOT NULL,
      base_crit_rate REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS class_level_vitals (
      class_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      hp REAL NOT NULL,
      mp REAL NOT NULL,
      PRIMARY KEY (class_id, level)
    );
  `);
}

function migrateSkillsColumns(sqlite: Database.Database): void {
  const cols = sqlite.pragma('table_info(skills)') as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  const adds: [string, string][] = [
    ['power_l1', 'INTEGER NOT NULL DEFAULT 0'],
    ['hit_time', 'INTEGER NOT NULL DEFAULT 0'],
    ['is_magic', 'INTEGER NOT NULL DEFAULT 0'],
    ['effect_kind', "TEXT NOT NULL DEFAULT 'physical_damage'"],
    ['abnormal_time', 'INTEGER NOT NULL DEFAULT 0'],
    ['buff_multiplier', 'REAL'],
    ['debuff_multiplier', 'REAL'],
  ];
  for (const [col, def] of adds) {
    if (!names.has(col)) {
      sqlite.exec(`ALTER TABLE skills ADD COLUMN ${col} ${def}`);
    }
  }
}

function migrateClassTemplateColumns(sqlite: Database.Database): void {
  const cols = sqlite.pragma('table_info(class_templates)') as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('base_m_atk')) {
    sqlite.exec('ALTER TABLE class_templates ADD COLUMN base_m_atk REAL NOT NULL DEFAULT 6');
  }
}

function migrateCharactersColumns(sqlite: Database.Database): void {
  const cols = sqlite.pragma('table_info(characters)') as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('adena')) {
    sqlite.exec('ALTER TABLE characters ADD COLUMN adena INTEGER NOT NULL DEFAULT 1000');
  }
  if (!names.has('starter_kit_granted')) {
    sqlite.exec(
      'ALTER TABLE characters ADD COLUMN starter_kit_granted INTEGER NOT NULL DEFAULT 0'
    );
  }
  if (!names.has('max_hp')) {
    sqlite.exec('ALTER TABLE characters ADD COLUMN max_hp REAL NOT NULL DEFAULT 100');
  }
  if (!names.has('max_mp')) {
    sqlite.exec('ALTER TABLE characters ADD COLUMN max_mp REAL NOT NULL DEFAULT 50');
  }
  if (!names.has('equipped_weapon_item_id')) {
    sqlite.exec('ALTER TABLE characters ADD COLUMN equipped_weapon_item_id INTEGER');
  }
  if (!names.has('class_id')) {
    sqlite.exec('ALTER TABLE characters ADD COLUMN class_id INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('sex')) {
    sqlite.exec('ALTER TABLE characters ADD COLUMN sex INTEGER NOT NULL DEFAULT 0');
  }
}

function migrateProgressionColumns(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS experience_loss (
      level INTEGER PRIMARY KEY,
      percent_lost REAL NOT NULL
    );
  `);

  const cols = sqlite.pragma('table_info(characters)') as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  const adds: [string, string][] = [
    ['sp', 'INTEGER NOT NULL DEFAULT 0'],
    ['karma', 'INTEGER NOT NULL DEFAULT 0'],
    ['pvp_kills', 'INTEGER NOT NULL DEFAULT 0'],
    ['pk_kills', 'INTEGER NOT NULL DEFAULT 0'],
    ['exp_before_death', 'INTEGER NOT NULL DEFAULT 0'],
    ['unspent_stat_points', 'INTEGER NOT NULL DEFAULT 0'],
    ['bonus_str', 'INTEGER NOT NULL DEFAULT 0'],
    ['bonus_dex', 'INTEGER NOT NULL DEFAULT 0'],
    ['bonus_con', 'INTEGER NOT NULL DEFAULT 0'],
    ['bonus_int', 'INTEGER NOT NULL DEFAULT 0'],
    ['bonus_wit', 'INTEGER NOT NULL DEFAULT 0'],
    ['bonus_men', 'INTEGER NOT NULL DEFAULT 0'],
    ['pvp_flag_end_ms', 'INTEGER NOT NULL DEFAULT 0'],
    ['account_name', "TEXT NOT NULL DEFAULT ''"],
  ];
  for (const [col, def] of adds) {
    if (!names.has(col)) {
      sqlite.exec(`ALTER TABLE characters ADD COLUMN ${col} ${def}`);
    }
  }
}

function migrateItemsColumns(sqlite: Database.Database): void {
  const cols = sqlite.pragma('table_info(items)') as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  const adds: [string, string][] = [
    ['is_quest_item', 'INTEGER NOT NULL DEFAULT 0'],
    ['crystal_type', 'TEXT'],
    ['p_def', 'REAL'],
    ['m_def', 'REAL'],
    ['weapon_type', 'TEXT'],
    ['enchant_enabled', 'INTEGER NOT NULL DEFAULT 0'],
    ['recipe_id', 'INTEGER'],
    ['is_stackable', 'INTEGER NOT NULL DEFAULT 0'],
    ['weight', 'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [col, def] of adds) {
    if (!names.has(col)) {
      sqlite.exec(`ALTER TABLE items ADD COLUMN ${col} ${def}`);
    }
  }
  migratePhase25Tables(sqlite);
}

function migratePhase25Tables(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      recipe_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      craft_level INTEGER NOT NULL,
      success_rate INTEGER NOT NULL,
      mp_cost INTEGER NOT NULL,
      product_item_id INTEGER NOT NULL,
      product_count INTEGER NOT NULL,
      ingredients_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS armor_sets (
      set_id INTEGER PRIMARY KEY,
      required_item_ids_json TEXT NOT NULL,
      p_def_percent_bonus REAL NOT NULL,
      max_hp_bonus INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS character_equipment (
      character_id TEXT NOT NULL,
      slot TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      enchant_level INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (character_id, slot)
    );
  `);
}

function migrateMonstersColumns(sqlite: Database.Database): void {
  const cols = sqlite.pragma('table_info(monsters)') as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  const adds: [string, string][] = [
    ['p_atk', 'REAL NOT NULL DEFAULT 0'],
    ['p_def', 'REAL NOT NULL DEFAULT 0'],
    ['attack_speed', 'INTEGER NOT NULL DEFAULT 0'],
    ['random', 'INTEGER NOT NULL DEFAULT 0'],
    ['critical', 'REAL NOT NULL DEFAULT 0'],
    ['accuracy', 'REAL NOT NULL DEFAULT 0'],
    ['attack_range', 'INTEGER NOT NULL DEFAULT 0'],
    ['aggro_range', 'INTEGER NOT NULL DEFAULT 0'],
    ['is_aggressive', 'INTEGER NOT NULL DEFAULT 0'],
    ['respawn_sec', 'INTEGER NOT NULL DEFAULT 27'],
    ['ai_type', 'TEXT'],
    ['clan', 'TEXT'],
    ['clan_help_range', 'INTEGER'],
    ['preferred_attack_range', 'INTEGER'],
  ];
  for (const [col, def] of adds) {
    if (!names.has(col)) {
      sqlite.exec(`ALTER TABLE monsters ADD COLUMN ${col} ${def}`);
    }
  }
}
