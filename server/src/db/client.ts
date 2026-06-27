import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { schema } from './schema';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export function getDb(path: string): AppDatabase {
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
      mp REAL NOT NULL
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
  `);
}
