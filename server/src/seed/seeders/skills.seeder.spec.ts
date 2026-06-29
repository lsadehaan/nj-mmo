import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { items, skills } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';
import { TI_SKILL_IDS } from './skills.seeder';

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

  // SKILL20-01
  it('seeds TI skill subset with authentic Classic values', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const ids = db.select({ id: skills.skillId }).from(skills).all().map((r) => r.id);
    for (const skillId of TI_SKILL_IDS) {
      expect(ids).toContain(skillId);
    }
  });

  // SKILL20-02
  it('seeds Wind Strike (1177) as magic with hitTime 4000', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath)
      .select()
      .from(skills)
      .where(eq(skills.skillId, 1177))
      .get();
    expect(row?.isMagic).toBe(true);
    expect(row?.hitTime).toBe(4000);
  });

  // SKILL20-03
  it('seeds Power Strike (3) as physical_damage with powerL1 30', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath)
      .select()
      .from(skills)
      .where(eq(skills.skillId, 3))
      .get();
    expect(row?.effectKind).toBe('physical_damage');
    expect(row?.powerL1).toBe(30);
  });

  // SKILL20-04
  it('seeds Might (1068) as buff_self with buffMultiplier 1.08', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath)
      .select()
      .from(skills)
      .where(eq(skills.skillId, 1068))
      .get();
    expect(row?.effectKind).toBe('buff_self');
    expect(row?.buffMultiplier).toBeCloseTo(1.08);
  });

  // SKILL20-07
  it('seeds Spiritshot item 2509 as shot consumable', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath)
      .select()
      .from(items)
      .where(eq(items.itemId, 2509))
      .get();
    expect(row?.name).toBe('Spiritshot (No-grade)');
    expect(row?.type).toBe('shot');
  });
});
