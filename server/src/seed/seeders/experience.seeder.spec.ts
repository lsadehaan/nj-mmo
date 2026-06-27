import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { experience } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';

describe('experience seeding', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-seed-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  it('seeds Classic XP curve with spot values and max level row', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const rows = db.select().from(experience).all();

    expect(rows.find((r) => r.level === 2)?.xpToNextLevel).toBe(68);
    expect(rows.find((r) => r.level === 3)?.xpToNextLevel).toBe(364);
    expect(rows.find((r) => r.level === 10)?.xpToNextLevel).toBe(48230);
    expect(rows.some((r) => r.level === 87)).toBe(true);
    expect(rows).toHaveLength(87);
  });
});
