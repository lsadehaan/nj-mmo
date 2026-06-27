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
      mp_consume_l1 INTEGER NOT NULL
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
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  migrateMonstersColumns(sqlite);
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
