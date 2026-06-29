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

  it('seeds Gremlin combat stats for melee formula', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20001)).get();
    expect(row?.pDef).toBeCloseTo(44.44444, 4);
    expect(row?.pAtk).toBeCloseTo(8.47458, 4);
    expect(row?.attackSpeed).toBe(253);
    expect(row?.isAggressive).toBe(false);
  });

  it('seeds Goblin as aggressive with raw aggroRange 450', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20003)).get();
    expect(row?.isAggressive).toBe(true);
    expect(row?.aggroRange).toBe(450);
  });

  it('seeds Elpy (20432) with authentic values', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20432)).get();
    expect(row).toMatchObject({
      name: 'Elpy',
      level: 1,
      exp: 44,
      hp: 41.145,
      race: 'ANIMAL',
      isAggressive: false,
    });
  });

  it('seeds Elder Keltir (20544) with authentic values', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20544)).get();
    expect(row).toMatchObject({
      name: 'Elder Keltir',
      level: 3,
      exp: 132,
      hp: 60.135,
    });
    expect(row?.pAtk).toBeCloseTo(10.24492, 4);
  });

  it('seeds Elder Wolf (20442) with authentic values', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20442)).get();
    expect(row).toMatchObject({
      name: 'Elder Wolf',
      level: 5,
      exp: 220,
      hp: 84.189,
    });
  });

  it('seeds Giant Toad (20121) with authentic values', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20121)).get();
    expect(row).toMatchObject({
      name: 'Giant Toad',
      level: 5,
      hp: 84.189,
    });
    expect(row?.pDef).toBeCloseTo(51.60553, 4);
  });

  it('seeds Orc (20130) with authentic values', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20130)).get();
    expect(row).toMatchObject({
      name: 'Orc',
      level: 6,
      exp: 264,
      hp: 98.115,
      isAggressive: true,
      aggroRange: 450,
    });
  });

  it('seeds Goblin Scout (20326) with authentic values (BEST22-05)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20326)).get();
    expect(row).toMatchObject({
      name: 'Goblin Scout',
      level: 8,
      hp: 131.031,
      isAggressive: false,
    });
  });

  it('seeds Werewolf Hunter (20343) with authentic values (BEST22-07)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20343)).get();
    expect(row).toMatchObject({
      name: 'Werewolf Hunter',
      level: 10,
      hp: 172.176,
      isAggressive: true,
    });
  });

  it('seeds Orc Warrior (20093) with authentic values (BEST22-08)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20093)).get();
    expect(row).toMatchObject({
      name: 'Orc Warrior',
      level: 10,
      exp: 441,
      isAggressive: true,
    });
  });

  it('seeds Orc Lieutenant (20096) with authentic values (BEST22-09)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20096)).get();
    expect(row).toMatchObject({ name: 'Orc Lieutenant', level: 11, exp: 482 });
  });

  it('seeds Orc Captain (20098) with authentic values (BEST22-10)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20098)).get();
    expect(row).toMatchObject({ name: 'Orc Captain', level: 12, exp: 530 });
  });

  it('seeds Werewolf Chieftain (20342) with authentic values (BEST22-11)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20342)).get();
    expect(row).toMatchObject({ name: 'Werewolf Chieftain', level: 12, hp: 81.77492 });
    expect(row?.pAtk).toBeCloseTo(25.295666, 4);
  });

  it('seeds Stone Golem (20016) with authentic values (BEST22-12)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20016)).get();
    expect(row).toMatchObject({
      name: 'Stone Golem',
      level: 13,
      race: 'CONSTRUCT',
      hp: 87.93267,
    });
  });

  it('seeds Crasher (20101) with authentic values (BEST22-13)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20101)).get();
    expect(row).toMatchObject({ name: 'Crasher', level: 14, race: 'CONSTRUCT' });
  });

  it('seeds Giant Spider (20103) with authentic values (BEST22-14)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20103)).get();
    expect(row).toMatchObject({ name: 'Giant Spider', level: 15 });
  });

  it('seeds Giant Fang Spider (20106) with authentic values (BEST22-15)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20106)).get();
    expect(row).toMatchObject({ name: 'Giant Fang Spider', level: 16 });
  });

  it('seeds Giant Blade Spider (20108) with authentic values (BEST22-16)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20108)).get();
    expect(row).toMatchObject({ name: 'Giant Blade Spider', level: 17 });
  });

  it('seeds 23 monsters total (BEST22-02)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    expect(getDb(dbPath).select().from(monsters).all()).toHaveLength(23);
  });

  it('seeds Orc Soldier (20131) with authentic values (BEST22-03)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20131)).get();
    expect(row).toMatchObject({
      name: 'Orc Soldier',
      level: 7,
      exp: 308,
      hp: 113.94,
      isAggressive: false,
      clan: 'ORC',
    });
  });

  it('seeds Orc Archer (20006) with ARCHER aiType (BEST22-04)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20006)).get();
    expect(row).toMatchObject({
      name: 'Orc Archer',
      level: 8,
      aiType: 'ARCHER',
      isAggressive: true,
      aggroRange: 450,
      preferredAttackRange: 80,
    });
  });

  it('seeds Werewolf (20132) with WEREWOLF clan (BEST22-06)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(monsters).where(eq(monsters.npcId, 20132)).get();
    expect(row).toMatchObject({
      name: 'Werewolf',
      level: 9,
      clan: 'WEREWOLF',
      clanHelpRange: 300,
      isAggressive: false,
    });
  });

  it('is idempotent when run twice', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const first = getDb(dbPath).select().from(monsters).all();

    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const second = getDb(dbPath).select().from(monsters).all();

    expect(second).toHaveLength(23);
    expect(second).toEqual(first);
  });
});
