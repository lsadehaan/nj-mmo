import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { teleportDestinations } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';

describe('teleport destinations seeding', () => {
  let cleanup: () => void;
  afterEach(() => {
    cleanup?.();
  });

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-tp-seed-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  it('seeds five Roxxy TI destinations (TOWN24-29)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const rows = getDb(dbPath)
      .select()
      .from(teleportDestinations)
      .where(eq(teleportDestinations.npcId, 30006))
      .all();
    expect(rows).toHaveLength(5);
    const obelisk = rows.find((r) => r.destinationId === 'obelisk');
    expect(obelisk?.feeAdena).toBe(200);
  });
});
