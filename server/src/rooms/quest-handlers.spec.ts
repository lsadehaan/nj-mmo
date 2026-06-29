import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDb } from '../db/client';
import { loadQuestDefinitions } from '../db/quest-repository';
import { runSeed, FIXTURE_DATA_DIR } from '../seed/seed';
import { PlayerState } from './schema/TownState';
import {
  buildQuestDialog,
  getQuestEntriesForNpc,
  type QuestRoomContext,
} from './quest-handlers';

function tempDb(): { dbPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'nj-quest-handlers-'));
  const dbPath = join(dir, 'test.db');
  return { dbPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const BITZ_NPC_ID = 30026;
const ROXXY_NPC = 30006;

function makeCtx(
  questDefs: Map<number, import('@nj/game-core').QuestDefinition>,
  dbPath: string,
  overrides: Partial<QuestRoomContext> = {}
): QuestRoomContext {
  const player = new PlayerState();
  player.level = overrides.player?.level ?? player.level;
  return {
    db: getDb(dbPath),
    characterId: 'char-1',
    player,
    stored: { classId: 0, equippedWeaponItemId: null },
    questDefs,
    questEntries: [],
    playerItems: {},
    experienceCurve: [],
    setItemCount: vi.fn(),
    getItemCount: () => 0,
    persistItems: vi.fn(),
    persistCharacter: vi.fn(),
    syncQuestEntries: vi.fn(),
    ...overrides,
    player: overrides.player ?? player,
  };
}

describe('quest-handlers', () => {
  let dbPath: string;
  let cleanup: () => void;
  let questDefs: Map<number, import('@nj/game-core').QuestDefinition>;

  beforeAll(() => {
    ({ dbPath, cleanup } = tempDb());
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    questDefs = loadQuestDefinitions(getDb(dbPath));
  });

  afterAll(() => {
    cleanup();
  });

  // QUEST21-15 dialog branch
  it('buildQuestDialog below min level shows levelTooLow without accept', () => {
    const ctx = makeCtx(questDefs, dbPath, { player: Object.assign(new PlayerState(), { level: 9 }) });
    const dialog = buildQuestDialog(ctx, BITZ_NPC_ID);
    expect(dialog).toMatchObject({
      questId: 105,
      levelTooLow: true,
      minLevel: 10,
      buttons: [],
    });
  });

  // QUEST21-24
  it('buildQuestDialog tutorial step 0 offers Continue tutorial', () => {
    const ctx = makeCtx(questDefs, dbPath, {
      questEntries: [{ questId: 255, status: 'in_progress', step: 0, counters: [0] }],
    });
    const dialog = buildQuestDialog(ctx, ROXXY_NPC);
    expect(dialog?.buttons).toContainEqual({ action: 'talk', label: 'Continue tutorial' });
  });

  // QUEST21-28
  it('getQuestEntriesForNpc excludes completed tutorial', () => {
    const ctx = makeCtx(questDefs, dbPath, {
      questEntries: [{ questId: 255, status: 'completed', step: 3, counters: [] }],
    });
    const atRoxxy = getQuestEntriesForNpc(ctx, ROXXY_NPC);
    expect(atRoxxy.some(({ def }) => def.questId === 255)).toBe(false);
  });
});
