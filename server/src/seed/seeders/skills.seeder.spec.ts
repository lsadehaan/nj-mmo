import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { skills } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';

describe('skill seeding', () => {
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

  it('seeds Power Strike (id 3) with authentic Classic values', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(skills).where(eq(skills.skillId, 3)).get();
    expect(row).toEqual({
      skillId: 3,
      name: 'Power Strike',
      maxLevel: 9,
      operateType: 'A1',
      targetType: 'ENEMY',
      castRange: 40,
      reuseDelay: 3000,
      mpConsumeL1: 9,
      powerL1: 30,
    });
  });
});
