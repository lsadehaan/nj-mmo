import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { SPAWN_X, SPAWN_Y, SPAWN_Z } from '@nj/game-core';
import { getDb } from './client';
import { createCharacter, loadCharacter, saveCharacter, loadCharacterItems, saveCharacterItems, loadCharacterSkills, saveCharacterSkills, loadCharacterQuests, saveCharacterQuest, upsertQuestProgress, listCharactersByAccount, findCharacterByNameOnAccount } from './character-repository';
import { runSeed, FIXTURE_DATA_DIR } from '../seed/seed';

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
      classId: 0,
      sex: 0,
      level: 1,
      xp: 0,
      hp: 100,
      mp: 50,
      maxHp: 100,
      maxMp: 50,
      equippedWeaponItemId: null,
      adena: 1000,
      starterKitGranted: false,
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

  it('createCharacter sets starting adena to 1000', () => {
    const db = tempDb();
    const row = createCharacter(db);
    expect(row.adena).toBe(1000);
    const loaded = loadCharacter(db, row.id);
    expect(loaded?.adena).toBe(1000);
  });

  it('saveCharacter round-trips adena and starterKitGranted', () => {
    const db = tempDb();
    const created = createCharacter(db);
    const updated = {
      ...created,
      adena: 897,
      starterKitGranted: true,
    };
    saveCharacter(db, updated);
    const loaded = loadCharacter(db, created.id);
    expect(loaded?.adena).toBe(897);
    expect(loaded?.starterKitGranted).toBe(true);
  });

  it('saveCharacterItems round-trips item counts', () => {
    const db = tempDb();
    const created = createCharacter(db);
    expect(loadCharacterItems(db, created.id)).toEqual({});

    saveCharacterItems(db, created.id, { 1060: 2, 1835: 5 });
    expect(loadCharacterItems(db, created.id)).toEqual({ 1060: 2, 1835: 5 });

    saveCharacterItems(db, created.id, { 1060: 1 });
    expect(loadCharacterItems(db, created.id)).toEqual({ 1060: 1 });
  });

  it('saveCharacterItems removes zero-count stacks', () => {
    const db = tempDb();
    const created = createCharacter(db);
    saveCharacterItems(db, created.id, { 1060: 1, 17: 3 });
    saveCharacterItems(db, created.id, { 17: 3 });
    expect(loadCharacterItems(db, created.id)).toEqual({ 17: 3 });
  });

  it('saveCharacter round-trips maxHp, maxMp, and equipped weapon', () => {
    const db = tempDb();
    const created = createCharacter(db);
    const updated = {
      ...created,
      maxHp: 112,
      maxMp: 55,
      hp: 112,
      mp: 55,
      equippedWeaponItemId: 2369,
    };
    saveCharacter(db, updated);
    const loaded = loadCharacter(db, created.id);
    expect(loaded).toMatchObject({
      maxHp: 112,
      maxMp: 55,
      hp: 112,
      mp: 55,
      equippedWeaponItemId: 2369,
    });
  });

  it('createCharacter defaults max vitals and null equipped weapon', () => {
    const db = tempDb();
    const row = createCharacter(db);
    expect(row.maxHp).toBe(100);
    expect(row.maxMp).toBe(50);
    expect(row.equippedWeaponItemId).toBeNull();
  });

  it('migrated characters table defaults max vitals on insert without explicit columns', () => {
    const db = tempDb();
    const now = Date.now();
    db.run(
      `INSERT INTO characters (id, name, level, xp, hp, mp, x, y, z, updated_at)
       VALUES ('legacy-1', 'Legacy', 1, 0, 100, 50, 0, 4.26, 0, ${now})`
    );
    const loaded = loadCharacter(db, 'legacy-1');
    expect(loaded?.maxHp).toBe(100);
    expect(loaded?.maxMp).toBe(50);
    expect(loaded?.equippedWeaponItemId).toBeNull();
    expect(loaded?.classId).toBe(0);
    expect(loaded?.sex).toBe(0);
  });

  it('createCharacter with classId 10 and sex 1 applies template vitals (CHAR19-14)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nj-char-class-'));
    const dbPath = join(dir, 'test.db');
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = createCharacter(db, { classId: 10, sex: 1 });
    expect(row).toMatchObject({
      classId: 10,
      sex: 1,
      maxHp: 101,
      maxMp: 40,
      hp: 101,
      mp: 40,
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it('saveCharacter round-trips classId and sex (CHAR19-15)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nj-char-class-'));
    const dbPath = join(dir, 'test.db');
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const created = createCharacter(db, { classId: 25, sex: 0 });
    const updated = { ...created, classId: 31, sex: 1 };
    saveCharacter(db, updated);
    const loaded = loadCharacter(db, created.id);
    expect(loaded?.classId).toBe(31);
    expect(loaded?.sex).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  // SKILL20-09
  it('createCharacter mystic classId 10 grants Wind Strike 1177', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nj-char-skills-'));
    const dbPath = join(dir, 'test.db');
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = createCharacter(db, { classId: 10 });
    expect(loadCharacterSkills(db, row.id)[1177]).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  // SKILL20-10
  it('createCharacter fighter classId 0 does not grant Power Strike 3', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nj-char-skills-'));
    const dbPath = join(dir, 'test.db');
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = createCharacter(db, { classId: 0 });
    expect(loadCharacterSkills(db, row.id)[3]).toBeUndefined();
    rmSync(dir, { recursive: true, force: true });
  });

  // SKILL20-11
  it('legacy fighter load migrates Power Strike 3', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nj-char-skills-'));
    const dbPath = join(dir, 'test.db');
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const now = Date.now();
    db.run(
      `INSERT INTO characters (id, name, class_id, sex, level, xp, hp, mp, max_hp, max_mp, adena, starter_kit_granted, x, y, z, updated_at)
       VALUES ('legacy-fighter', 'Legacy', 0, 0, 1, 0, 100, 50, 100, 50, 1000, 0, 0, 4.26, 0, ${now})`
    );
    loadCharacter(db, 'legacy-fighter');
    expect(loadCharacterSkills(db, 'legacy-fighter')).toEqual({ 3: 1 });
    rmSync(dir, { recursive: true, force: true });
  });

  // SKILL20-12
  it('saveCharacterSkills round-trips learned skills', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nj-char-skills-'));
    const dbPath = join(dir, 'test.db');
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = createCharacter(db, { classId: 0 });
    saveCharacterSkills(db, row.id, { 3: 1, 29: 1 });
    expect(loadCharacterSkills(db, row.id)).toEqual({ 3: 1, 29: 1 });
    rmSync(dir, { recursive: true, force: true });
  });

  // QUEST21-12
  it('saveCharacterQuest round-trips step and counters', () => {
    const db = tempDb();
    const row = createCharacter(db);
    const entry = {
      questId: 153,
      status: 'in_progress' as const,
      step: 2,
      counters: [1, 0, 1],
    };
    saveCharacterQuest(db, row.id, entry);
    const loaded = loadCharacterQuests(db, row.id);
    expect(loaded).toEqual([entry]);
  });

  it('upsertQuestProgress persists completed status', () => {
    const db = tempDb();
    const row = createCharacter(db);
    upsertQuestProgress(db, row.id, {
      questId: 153,
      status: 'completed',
      step: 3,
      counters: [],
    });
    expect(loadCharacterQuests(db, row.id)[0]?.status).toBe('completed');
  });

  it('loadCharacterQuests returns empty for new character', () => {
    const db = tempDb();
    const row = createCharacter(db);
    expect(loadCharacterQuests(db, row.id)).toEqual([]);
  });

  it('UI28-14: createCharacter persists account_name', () => {
    const db = tempDb();
    const row = createCharacter(db, {
      accountName: 'hero1',
      name: 'KnightOne',
      classId: 0,
      sex: 0,
    });
    expect(row.accountName).toBe('hero1');
    const loaded = loadCharacter(db, row.id);
    expect(loaded?.accountName).toBe('hero1');
  });

  it('listCharactersByAccount returns roster rows', () => {
    const db = tempDb();
    createCharacter(db, { accountName: 'hero1', name: 'Alpha', classId: 0, sex: 0 });
    createCharacter(db, { accountName: 'hero1', name: 'Beta', classId: 10, sex: 1 });
    const rows = listCharactersByAccount(db, 'hero1');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name).sort()).toEqual(['Alpha', 'Beta']);
  });

  it('rejects duplicate name on same account', () => {
    const db = tempDb();
    createCharacter(db, { accountName: 'hero1', name: 'Alpha', classId: 0, sex: 0 });
    expect(() =>
      createCharacter(db, { accountName: 'hero1', name: 'Alpha', classId: 0, sex: 0 })
    ).toThrow('duplicate character name');
    expect(findCharacterByNameOnAccount(db, 'hero1', 'Alpha')).toBeDefined();
  });
});
