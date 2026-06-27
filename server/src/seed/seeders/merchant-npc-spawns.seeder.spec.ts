import { mkdtempSync, rmSync } from 'node:fs';
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

  it('seeds Katerina (30004) at local x=-6, z=-8', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath)
      .select()
      .from(npcSpawns)
      .where(eq(npcSpawns.npcId, 30004))
      .get();
    expect(row).toMatchObject({ npcId: 30004, x: -6, z: -8 });
  });

  it('seeds Roxxy (30006) at local x=4, z=10', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath)
      .select()
      .from(npcSpawns)
      .where(eq(npcSpawns.npcId, 30006))
      .get();
    expect(row).toMatchObject({ npcId: 30006, x: 4, z: 10 });
  });
});
