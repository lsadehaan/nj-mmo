import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { mobDrops } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';

describe('mob drop seeding', () => {
  let cleanup: () => void;
  afterEach(() => { cleanup?.(); });
  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-drops-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }
  it('seeds Goblin adena drop row with authentic Classic values', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(mobDrops).where(and(eq(mobDrops.npcId, 20003), eq(mobDrops.itemId, 57))).get();
    expect(row).toMatchObject({ itemId: 57, chance: 70, minCount: 13, maxCount: 30 });
  });
  it('seeds Elpy adena drop anchor (20432)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(mobDrops).where(and(eq(mobDrops.npcId, 20432), eq(mobDrops.itemId, 57))).get();
    expect(row).toMatchObject({ itemId: 57, chance: 70, minCount: 4, maxCount: 8 });
  });
  it('seeds Elder Keltir shirt drop anchor (20544)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(mobDrops).where(and(eq(mobDrops.npcId, 20544), eq(mobDrops.itemId, 21))).get();
    expect(row).toMatchObject({ itemId: 21, chance: 9.292, minCount: 1, maxCount: 1 });
  });
  it('seeds Elder Wolf club drop anchor (20442)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(mobDrops).where(and(eq(mobDrops.npcId, 20442), eq(mobDrops.itemId, 4))).get();
    expect(row).toMatchObject({ itemId: 4, chance: 3.667, minCount: 1, maxCount: 1 });
  });
  it('seeds Giant Toad club drop anchor (20121)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(mobDrops).where(and(eq(mobDrops.npcId, 20121), eq(mobDrops.itemId, 4))).get();
    expect(row).toMatchObject({ itemId: 4, chance: 3.702, minCount: 1, maxCount: 1 });
  });
  it('seeds Orc cotton shoes drop anchor (20130)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(mobDrops).where(and(eq(mobDrops.npcId, 20130), eq(mobDrops.itemId, 1122))).get();
    expect(row).toMatchObject({ itemId: 1122, chance: 3.845, minCount: 1, maxCount: 1 });
  });

  const PHASE22_ADENA_ANCHORS: [number, number, number][] = [
    [20131, 20, 48],
    [20006, 25, 61],
    [20326, 25, 61],
    [20132, 31, 73],
    [20343, 37, 88],
    [20093, 37, 88],
    [20096, 41, 97],
    [20098, 45, 106],
    [20342, 39, 92],
    [20016, 49, 115],
    [20101, 53, 124],
    [20103, 57, 133],
    [20106, 61, 142],
    [20108, 65, 151],
  ];

  it.each(PHASE22_ADENA_ANCHORS)(
    'seeds adena drop anchor for npcId %i (BEST22-17)',
    (npcId, minCount, maxCount) => {
      const dbPath = tempDbPath();
      runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
      const row = getDb(dbPath)
        .select()
        .from(mobDrops)
        .where(and(eq(mobDrops.npcId, npcId), eq(mobDrops.itemId, 57)))
        .get();
      expect(row).toMatchObject({ itemId: 57, chance: 70, minCount, maxCount });
    }
  );

  it('seeds multiple drop rows for mobs with dropLists', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const goblinDrops = getDb(dbPath).select().from(mobDrops).where(eq(mobDrops.npcId, 20003)).all();
    expect(goblinDrops.length).toBeGreaterThanOrEqual(8);
  });
  it('is idempotent when run twice', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const first = getDb(dbPath)
      .select()
      .from(mobDrops)
      .all()
      .map(({ npcId, itemId, minCount, maxCount, chance }) => ({
        npcId,
        itemId,
        minCount,
        maxCount,
        chance,
      }));

    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const second = getDb(dbPath)
      .select()
      .from(mobDrops)
      .all()
      .map(({ npcId, itemId, minCount, maxCount, chance }) => ({
        npcId,
        itemId,
        minCount,
        maxCount,
        chance,
      }));

    expect(second).toEqual(first);
  });
});
