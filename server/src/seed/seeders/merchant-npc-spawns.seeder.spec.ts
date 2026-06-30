import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { merchantItems, npcSpawns } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';

describe('merchant item seeding', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-merchant-seed-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  it('seeds Healing Potion (1060) buy 103 sell 51 for Katerina', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath)
      .select()
      .from(merchantItems)
      .where(eq(merchantItems.itemId, 1060))
      .get();
    expect(row).toMatchObject({
      npcId: 30004,
      itemId: 1060,
      name: 'Healing Potion',
      buyPrice: 103,
      sellPrice: 51,
    });
  });

  it('seeds Soulshot (1835) buy 8 sell 4 and Wooden Arrow (17) buy 2 sell 1', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const soulshot = db
      .select()
      .from(merchantItems)
      .where(eq(merchantItems.itemId, 1835))
      .get();
    const arrow = db
      .select()
      .from(merchantItems)
      .where(eq(merchantItems.itemId, 17))
      .get();
    expect(soulshot).toMatchObject({ buyPrice: 8, sellPrice: 4 });
    expect(arrow).toMatchObject({ buyPrice: 2, sellPrice: 1 });
  });

  it('seeds Lector weapon items 1, 4, 13 with Classic prices (TINPC-08)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const shortSword = db
      .select()
      .from(merchantItems)
      .where(eq(merchantItems.npcId, 30001))
      .all()
      .find((r) => r.itemId === 1);
    const club = db
      .select()
      .from(merchantItems)
      .where(eq(merchantItems.npcId, 30001))
      .all()
      .find((r) => r.itemId === 4);
    const bow = db
      .select()
      .from(merchantItems)
      .where(eq(merchantItems.npcId, 30001))
      .all()
      .find((r) => r.itemId === 13);
    expect(shortSword).toMatchObject({ buyPrice: 883, sellPrice: 441 });
    expect(club).toMatchObject({ buyPrice: 883, sellPrice: 441 });
    expect(bow).toMatchObject({ buyPrice: 883, sellPrice: 441 });
  });

  it('seeds Jackson armor items 21, 28, 1121 with anchor prices (TINPC-09)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const rows = db.select().from(merchantItems).where(eq(merchantItems.npcId, 30002)).all();
    expect(rows.find((r) => r.itemId === 21)).toMatchObject({ buyPrice: 169, sellPrice: 84 });
    expect(rows.find((r) => r.itemId === 28)).toMatchObject({ buyPrice: 105, sellPrice: 52 });
    expect(rows.find((r) => r.itemId === 1121)).toMatchObject({ buyPrice: 8, sellPrice: 4 });
  });

  it('seeds Silvia accessory items 116, 112, 118 with anchor prices (TINPC-10)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const rows = db.select().from(merchantItems).where(eq(merchantItems.npcId, 30003)).all();
    expect(rows.find((r) => r.itemId === 116)).toMatchObject({ buyPrice: 37, sellPrice: 18 });
    expect(rows.find((r) => r.itemId === 112)).toMatchObject({ buyPrice: 56, sellPrice: 28 });
    expect(rows.find((r) => r.itemId === 118)).toMatchObject({ buyPrice: 75, sellPrice: 37 });
  });

  it('seed is idempotent for merchant rows (TINPC-14)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const first = getDb(dbPath)
      .select()
      .from(merchantItems)
      .all()
      .map(({ id: _id, ...row }) => row);
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const second = getDb(dbPath)
      .select()
      .from(merchantItems)
      .all()
      .map(({ id: _id, ...row }) => row);
    expect(second).toEqual(first);
  });
});

describe('NPC spawn seeding', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-npc-spawn-seed-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  const SPAWN_TABLE = JSON.parse(
    readFileSync(join(FIXTURE_DATA_DIR, 'npc_spawns.json'), 'utf-8')
  ) as { npcId: number; x: number; z: number }[];

  it('seeds 26 npc_spawns rows matching anchor table (TOWN24-06, ITEM25-16)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const rows = getDb(dbPath).select().from(npcSpawns).all();
    expect(rows).toHaveLength(26);
    for (const anchor of SPAWN_TABLE) {
      const row = rows.find((r) => r.npcId === anchor.npcId);
      expect(row).toMatchObject({ x: anchor.x, z: anchor.z });
    }
  });

  it('seeds Katerina (30004) from L2J fixture', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const expected = SPAWN_TABLE.find((r) => r.npcId === 30004)!;
    const row = getDb(dbPath)
      .select()
      .from(npcSpawns)
      .where(eq(npcSpawns.npcId, 30004))
      .get();
    expect(row).toMatchObject({ npcId: 30004, x: expected.x, z: expected.z });
  });

  it('seeds Roxxy (30006) from L2J fixture', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const expected = SPAWN_TABLE.find((r) => r.npcId === 30006)!;
    const row = getDb(dbPath)
      .select()
      .from(npcSpawns)
      .where(eq(npcSpawns.npcId, 30006))
      .get();
    expect(row).toMatchObject({ npcId: 30006, x: expected.x, z: expected.z });
  });

  it('seed is idempotent for npc spawn rows (TINPC-14)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const first = getDb(dbPath)
      .select()
      .from(npcSpawns)
      .all()
      .map(({ id: _id, ...row }) => row);
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const second = getDb(dbPath)
      .select()
      .from(npcSpawns)
      .all()
      .map(({ id: _id, ...row }) => row);
    expect(second).toEqual(first);
  });
});
