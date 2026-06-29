import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { classSkillTree, npcSpawns, npcs } from '../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from './seed';

describe('class skill tree seeding', () => {
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

  // SKILL20-05
  it('seeds Human Fighter (0) tree with Power Strike level 1', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath)
      .select()
      .from(classSkillTree)
      .where(
        and(
          eq(classSkillTree.classId, 0),
          eq(classSkillTree.skillId, 3),
          eq(classSkillTree.skillLevel, 1)
        )
      )
      .get();
    expect(row).toBeDefined();
    expect(row?.getLevel).toBe(5);
  });

  // SKILL20-06
  it('seeds Human Mystic (10) tree with autoGet Wind Strike', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath)
      .select()
      .from(classSkillTree)
      .where(
        and(
          eq(classSkillTree.classId, 10),
          eq(classSkillTree.skillId, 1177),
          eq(classSkillTree.skillLevel, 1)
        )
      )
      .get();
    expect(row?.autoGet).toBe(true);
  });

  // SKILL20-08
  it('seeds Orc Fighter (44) tree with Iron Punch level 1 getLevel 5', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath)
      .select()
      .from(classSkillTree)
      .where(
        and(
          eq(classSkillTree.classId, 44),
          eq(classSkillTree.skillId, 29),
          eq(classSkillTree.skillLevel, 1)
        )
      )
      .get();
    expect(row?.getLevel).toBe(5);
  });
});

describe('folk trainer NPC seeding', () => {
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

  it('seeds Gwinter 30027 and Baulro 30033 with spawns', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const gwinter = db.select().from(npcs).where(eq(npcs.npcId, 30027)).get();
    const baulro = db.select().from(npcs).where(eq(npcs.npcId, 30033)).get();
    expect(gwinter).toMatchObject({ name: 'Gwinter', type: 'Folk', title: 'Master' });
    expect(baulro).toMatchObject({ name: 'Baulro', type: 'Folk', title: 'Magister' });
    expect(db.select().from(npcSpawns).where(eq(npcSpawns.npcId, 30027)).get()).toBeDefined();
    expect(db.select().from(npcSpawns).where(eq(npcSpawns.npcId, 30033)).get()).toBeDefined();
  });
});
