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
