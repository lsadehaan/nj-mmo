import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { monsters } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';

describe('monster seeding', () => {
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

  it('seeds Gremlin (20001) with authentic values', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20001)).get();
    expect(row).toMatchObject({
      name: 'Gremlin',
      level: 1,
      exp: 44,
      hp: 41.145,
      mp: 44.247,
      race: 'FAIRY',
      pAtk: 8.47458,
      attackSpeed: 253,
      attackRange: 40,
      random: 30,
    });
  });

  it('seeds Bearded Keltir (20481) with authentic values', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20481)).get();
    expect(row).toMatchObject({
      name: 'Bearded Keltir',
      level: 1,
      exp: 44,
      sp: 1,
      race: 'ANIMAL',
    });
  });

  it('seeds Wolf (20120) with authentic values', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20120)).get();
    expect(row).toMatchObject({
      name: 'Wolf',
      level: 4,
      exp: 176,
      hp: 70.896,
      pAtk: 11.24892,
      pDef: 49.73343,
    });
  });

  it('seeds Goblin (20003) with authentic values', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20003)).get();
    expect(row).toMatchObject({
      name: 'Goblin',
      level: 5,
      exp: 220,
      hp: 84.189,
      race: 'HUMANOID',
      critical: 4.75,
      accuracy: 4.75,
    });
  });

  it('is idempotent when run twice', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const first = getDb(dbPath).select().from(monsters).all();

    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const second = getDb(dbPath).select().from(monsters).all();

    expect(second).toHaveLength(4);
    expect(second).toEqual(first);
  });
});
