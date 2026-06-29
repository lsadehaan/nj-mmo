import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { classLevelVitals, classTemplates } from '../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from './seed';
import { STARTER_CLASS_IDS } from './parsers/class-templates.parser';

describe('class template seeding', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-class-seed-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  it('seeds nine starter class templates (CHAR19-01)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const rows = db.select().from(classTemplates).all();
    expect(rows).toHaveLength(9);
    const ids = rows.map((r) => r.classId).sort((a, b) => a - b);
    expect(ids).toEqual([...STARTER_CLASS_IDS].sort((a, b) => a - b));
  });

  it('Human Fighter base stats (CHAR19-02)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = db.select().from(classTemplates).where(eq(classTemplates.classId, 0)).get();
    expect(row?.baseStr).toBe(40);
    expect(row?.baseMen).toBe(25);
  });

  it('Human Mystic base stats (CHAR19-03)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = db.select().from(classTemplates).where(eq(classTemplates.classId, 10)).get();
    expect(row?.baseInt).toBe(41);
    expect(row?.baseStr).toBe(22);
  });

  it('Human Fighter level 1 vitals (CHAR19-04)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = db
      .select()
      .from(classLevelVitals)
      .where(eq(classLevelVitals.classId, 0))
      .all()
      .find((r) => r.level === 1);
    expect(row?.hp).toBe(80);
    expect(row?.mp).toBe(30);
  });

  it('Human Fighter level 2 vitals (CHAR19-05)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = db
      .select()
      .from(classLevelVitals)
      .where(eq(classLevelVitals.classId, 0))
      .all()
      .find((r) => r.level === 2);
    expect(row?.hp).toBeCloseTo(91.83, 2);
    expect(row?.mp).toBeCloseTo(35.46, 2);
  });

  it('Dark Mystic level 1 vitals (CHAR19-06)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = db
      .select()
      .from(classLevelVitals)
      .where(eq(classLevelVitals.classId, 38))
      .all()
      .find((r) => r.level === 1);
    expect(row?.hp).toBe(106);
    expect(row?.mp).toBe(40);
  });

  it('fixture StartingClass files are committed (AD-012)', () => {
    const dir = join(FIXTURE_DATA_DIR, 'players', 'StartingClass');
    const humanFighter = readFileSync(join(dir, 'HumanFighter.xml'), 'utf-8');
    expect(humanFighter).toContain('<classId>0</classId>');
    expect(humanFighter).toContain('<hp>80</hp>');
  });
});
