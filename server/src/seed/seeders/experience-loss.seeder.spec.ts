import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { getDb } from '../../db/client';
import { experience, experienceLoss } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';

describe('experience loss seeding (PROG27-13, PROG27-14)', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-seed-loss-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  it('PROG27-13: level 20 xpToNextLevel is 835864', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = db.select().from(experience).all().find((r) => r.level === 20);
    expect(row?.xpToNextLevel).toBe(835864);
  });

  it('PROG27-14: level 10 percentLost is 8.875', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = db.select().from(experienceLoss).all().find((r) => r.level === 10);
    expect(row?.percentLost).toBe(8.875);
  });
});
