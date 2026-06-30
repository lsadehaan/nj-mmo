import { describe, it, expect, afterEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb } from '../../db/client';
import { mobDrops } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';

describe('phase 25 TI drops', () => {
  let cleanup: () => void;
  afterEach(() => { cleanup?.(); });
  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-p25-drops-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  it('seeds Gremlin 20001 stem 1864 with chance > 0 (ITEM25-50)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath)
      .select()
      .from(mobDrops)
      .where(and(eq(mobDrops.npcId, 20001), eq(mobDrops.itemId, 1864)))
      .get();
    expect(row?.chance).toBeGreaterThan(0);
  });
});
