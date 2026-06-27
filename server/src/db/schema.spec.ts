import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { characters } from './schema';

describe('characters table', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-characters-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  it('round-trips insert and select on characters', () => {
    const db = getDb(tempDbPath());
    const now = Date.now();
    const row = {
      id: 'test-uuid-1',
      name: 'Adventurer',
      level: 1,
      xp: 0,
      hp: 100,
      mp: 50,
      x: 0,
      y: 4.26,
      z: 0,
      updatedAt: now,
    };
    db.insert(characters).values(row).run();
    const loaded = db.select().from(characters).where(eq(characters.id, row.id)).get();
    expect(loaded).toMatchObject(row);
  });
});
