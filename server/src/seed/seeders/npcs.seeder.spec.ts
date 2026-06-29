import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { npcs } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';
import { TI_NPC_IDS } from '../paths';

describe('NPC metadata seeding', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-npcs-seed-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  it('seeds nine TI NPC rows (TINPC-02, SKILL20-10)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const rows = getDb(dbPath).select().from(npcs).all();
    expect(rows).toHaveLength(9);
    expect(rows.map((r) => r.npcId).sort((a, b) => a - b)).toEqual([...TI_NPC_IDS]);
  });

  it('seeds Lector weapon merchant metadata (TINPC-03)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(npcs).where(eq(npcs.npcId, 30001)).get();
    expect(row).toMatchObject({
      name: 'Lector',
      type: 'Merchant',
      title: 'Weapon Merchant',
      level: 70,
    });
  });

  it('seeds Jackson armor merchant metadata (TINPC-04)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(npcs).where(eq(npcs.npcId, 30002)).get();
    expect(row).toMatchObject({
      name: 'Jackson',
      type: 'Merchant',
      title: 'Armor Merchant',
      level: 70,
    });
  });

  it('seeds Silvia accessory merchant metadata (TINPC-05)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(npcs).where(eq(npcs.npcId, 30003)).get();
    expect(row).toMatchObject({
      name: 'Silvia',
      type: 'Merchant',
      title: 'Accessory Merchant',
      level: 70,
    });
  });

  it('seeds Wilford warehouse keeper metadata (TINPC-06)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(npcs).where(eq(npcs.npcId, 30005)).get();
    expect(row).toMatchObject({
      type: 'Warehouse',
      title: 'Warehouse Keeper',
    });
  });

  it('seeds Bitz fighter trainer metadata (TINPC-07)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(npcs).where(eq(npcs.npcId, 30026)).get();
    expect(row).toMatchObject({
      type: 'VillageMasterFighter',
      title: 'Grand Master',
    });
  });
});
