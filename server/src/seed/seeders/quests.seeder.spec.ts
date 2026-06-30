import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { items, questObjectives, questRewards, quests } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';
import { TI_QUEST_IDS } from './quests.seeder';
import { TI_NPC_IDS } from '../paths';

describe('quest seeding', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-quest-seed-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  // QUEST21-10
  it('seeds 17 TI starter quests', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const ids = db.select({ id: quests.questId }).from(quests).all().map((r) => r.id);
    expect(ids).toHaveLength(17);
    for (const questId of TI_QUEST_IDS) {
      expect(ids).toContain(questId);
    }
    const givers = db.select({ giver: quests.stubGiverNpcId }).from(quests).all();
    for (const row of givers) {
      expect(TI_NPC_IDS).toContain(row.giver as (typeof TI_NPC_IDS)[number]);
    }
  });

  // QUEST21-11
  it('seeds quest 105 kill objective for mob 20130 count 10', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = db
      .select()
      .from(questObjectives)
      .where(eq(questObjectives.questId, 105))
      .all()
      .find((o) => o.kind === 'KILL_COUNT' && o.mobNpcId === 20130);
    expect(row?.count).toBe(10);
  });

  // QUEST21-14
  it('flags quest item 1012 as is_quest_item', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath)
      .select()
      .from(items)
      .where(eq(items.itemId, 1012))
      .get();
    expect(row?.isQuestItem).toBe(true);
  });

  it('quest 153 third deliver leg targets Arnold guard 30041 (TOWN24-49)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const rows = getDb(dbPath)
      .select()
      .from(questObjectives)
      .where(eq(questObjectives.questId, 153))
      .all();
    const arnoldDeliver = rows.find(
      (o) => o.kind === 'DELIVER' && o.npcId === 30041 && o.itemId === 6355
    );
    expect(arnoldDeliver?.count).toBe(1);
  });

  it('seeds reward anchors for quests 101, 105, and 156', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const q101 = db.select().from(questRewards).where(eq(questRewards.questId, 101)).all();
    const q105 = db.select().from(questRewards).where(eq(questRewards.questId, 105)).all();
    const q156 = db.select().from(questRewards).where(eq(questRewards.questId, 156)).all();
    expect(q101.some((r) => r.itemId === 49043)).toBe(true);
    expect(q105.some((r) => r.xp === 27772)).toBe(true);
    expect(q156.some((r) => r.xp === 3000)).toBe(true);
  });
});
