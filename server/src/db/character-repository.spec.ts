import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { SPAWN_X, SPAWN_Y, SPAWN_Z } from '@nj/game-core';
import { getDb } from './client';
import { createCharacter, loadCharacter, saveCharacter } from './character-repository';

describe('character repository', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDb() {
    const dir = mkdtempSync(join(tmpdir(), 'nj-char-repo-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return getDb(dbPath);
  }

  it('createCharacter inserts starter stats at spawn position', () => {
    const db = tempDb();
    const row = createCharacter(db);
    expect(row.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(row).toMatchObject({
      name: 'Adventurer',
      level: 1,
      xp: 0,
      hp: 100,
      mp: 50,
      x: SPAWN_X,
      y: SPAWN_Y,
      z: SPAWN_Z,
    });
    expect(row.updatedAt).toBeGreaterThan(0);
  });

  it('loadCharacter round-trips a saved row', () => {
    const db = tempDb();
    const created = createCharacter(db);
    const loaded = loadCharacter(db, created.id);
    expect(loaded).toEqual(created);
  });

  it('loadCharacter returns undefined for unknown id', () => {
    const db = tempDb();
    expect(loadCharacter(db, 'missing-id')).toBeUndefined();
  });

  it('saveCharacter updates position and stats', () => {
    const db = tempDb();
    const created = createCharacter(db);
    const updated = {
      ...created,
      x: 10,
      y: 5,
      z: -20,
      hp: 80,
      mp: 40,
      level: 2,
      xp: 100,
      name: 'Hero',
    };
    saveCharacter(db, updated);
    const loaded = loadCharacter(db, created.id);
    expect(loaded).toMatchObject({
      x: 10,
      y: 5,
      z: -20,
      hp: 80,
      mp: 40,
      level: 2,
      xp: 100,
      name: 'Hero',
    });
    expect(loaded!.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });
});
