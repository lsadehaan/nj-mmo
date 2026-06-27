import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { characters, mobDrops, mobSpawns, monsters } from './schema';

describe('characters table', () => {
  let cleanup: () => void;
  afterEach(() => { cleanup?.(); });
  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-characters-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }
  it('round-trips insert and select on characters', () => {
    const db = getDb(tempDbPath());
    const now = Date.now();
    const row = { id: 'test-uuid-1', name: 'Adventurer', level: 1, xp: 0, hp: 100, mp: 50, x: 0, y: 4.26, z: 0, updatedAt: now };
    db.insert(characters).values(row).run();
    const loaded = db.select().from(characters).where(eq(characters.id, row.id)).get();
    expect(loaded).toMatchObject(row);
  });
});

describe('combat schema tables', () => {
  let cleanup: () => void;
  afterEach(() => { cleanup?.(); });
  function tempDb() {
    const dir = mkdtempSync(join(tmpdir(), 'nj-schema-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return getDb(dbPath);
  }
  it('round-trips mob_drops insert and select', () => {
    const db = tempDb();
    db.insert(mobDrops).values({ npcId: 20003, itemId: 57, minCount: 13, maxCount: 30, chance: 70 }).run();
    const row = db.select().from(mobDrops).where(eq(mobDrops.npcId, 20003)).get();
    expect(row).toMatchObject({ npcId: 20003, itemId: 57, minCount: 13, maxCount: 30, chance: 70 });
  });
  it('round-trips mob_spawns insert and select', () => {
    const db = tempDb();
    db.insert(mobSpawns).values({ npcId: 20001, x: 12, y: 4.26, z: -18, respawnSec: 27 }).run();
    const row = db.select().from(mobSpawns).where(eq(mobSpawns.npcId, 20001)).get();
    expect(row).toMatchObject({ npcId: 20001, x: 12, y: 4.26, z: -18, respawnSec: 27 });
  });
  it('stores monster combat columns including aggro and respawn', () => {
    const db = tempDb();
    db.insert(monsters).values({
      npcId: 20001, name: 'Gremlin', level: 1, type: 'Monster', race: 'FAIRY', exp: 44, sp: 0,
      hp: 41.145, mp: 44.247, pAtk: 8.47458, pDef: 44.44444, attackSpeed: 253, random: 30,
      critical: 4.75, accuracy: 4.75, attackRange: 40, aggroRange: 0, isAggressive: false, respawnSec: 27,
    }).run();
    const row = db.select().from(monsters).where(eq(monsters.npcId, 20001)).get();
    expect(row?.pDef).toBeCloseTo(44.44444, 5);
    expect(row?.aggroRange).toBe(0);
    expect(row?.isAggressive).toBe(false);
    expect(row?.respawnSec).toBe(27);
  });
});
