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
      power_l1 INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS experience (
      level INTEGER PRIMARY KEY,
      xp_to_next_level INTEGER NOT NULL,
      training_rate REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level INTEGER NOT NULL,
      xp INTEGER NOT NULL,
      hp REAL NOT NULL,
      mp REAL NOT NULL,
      adena INTEGER NOT NULL DEFAULT 1000,
      starter_kit_granted INTEGER NOT NULL DEFAULT 0,
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL NOT NULL,
      updated_at INTEGER NOT NULL
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
  `);
  migrateMonstersColumns(sqlite);
  migrateSkillsColumns(sqlite);
  migrateCharactersColumns(sqlite);
}

function migrateSkillsColumns(sqlite: Database.Database): void {
  const cols = sqlite.pragma('table_info(skills)') as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('power_l1')) {
    sqlite.exec('ALTER TABLE skills ADD COLUMN power_l1 INTEGER NOT NULL DEFAULT 0');
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
  ];
  for (const [col, def] of adds) {
    if (!names.has(col)) {
      sqlite.exec(`ALTER TABLE monsters ADD COLUMN ${col} ${def}`);
    }
  }
}
