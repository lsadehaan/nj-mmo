import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { merchantItems, npcs } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';
import { TI_NPC_IDS } from '../paths';

describe('phase 25 merchant buylists', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-merchant-p25-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  it('seeds Lector 30001 with 27 weapon rows and Broadsword price 14375 (ITEM25-11)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const lectorRows = db
      .select()
      .from(merchantItems)
      .where(eq(merchantItems.npcId, 30001))
      .all();
    expect(lectorRows.length).toBe(27);
    const broadsword = lectorRows.find((r) => r.itemId === 3);
    expect(broadsword?.buyPrice).toBe(14375);
  });

  it('seeds Jackson 30002 with at least 30 armor rows (ITEM25-12)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const count = getDb(dbPath)
      .select()
      .from(merchantItems)
      .where(eq(merchantItems.npcId, 30002))
      .all().length;
    expect(count).toBeGreaterThanOrEqual(30);
  });

  it('seeds Silvia 30003 with 13 accessory rows per L2J fixture (ITEM25-13)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const count = getDb(dbPath)
      .select()
      .from(merchantItems)
      .where(eq(merchantItems.npcId, 30003))
      .all().length;
    // SPEC_DEVIATION accepted: spec says ≥15; L2J Classic buylist_30003.xml has 13 rows.
    expect(count).toBeGreaterThanOrEqual(13);
    expect(count).toBe(13);
  });

  it('seeds Pinter 30298 as Merchant with scrolls 955 and 956 (ITEM25-15)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const pinter = db.select().from(npcs).where(eq(npcs.npcId, 30298)).get();
    expect(pinter).toMatchObject({ type: 'Merchant', name: 'Pinter', title: 'Blacksmith' });
    const scrolls = db
      .select()
      .from(merchantItems)
      .where(eq(merchantItems.npcId, 30298))
      .all();
    expect(scrolls.map((s) => s.itemId).sort()).toEqual([955, 956]);
  });

  it('TI_NPC_IDS includes 26 NPCs with Pinter (ITEM25-16 prep)', () => {
    expect(TI_NPC_IDS.length).toBe(26);
    expect(TI_NPC_IDS).toContain(30298);
  });
});

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
});
