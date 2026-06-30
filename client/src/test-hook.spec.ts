import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initGameState,
  setQuests,
  setMobs,
  getGameState,
  setPlayerPDef,
  setMaxHp,
  setMaxMp,
} from './test-hook';
import { createMockAudioBackend } from './audio/audio-backend';
import { createAudioManager } from './audio/audio-manager';

describe('test-hook mobs', () => {
  beforeEach(() => {
    initGameState();
  });

  it('setMobs exposes npcId for Phase 22 mob types (BEST22-51)', () => {
    setMobs([
      {
        id: 'a1',
        npcId: 20006,
        x: 1,
        y: 2,
        z: 3,
        hp: 100,
        maxHp: 100,
        action: 'idle',
        actionSeq: 0,
      },
      {
        id: 'w1',
        npcId: 20132,
        x: 2,
        y: 2,
        z: 3,
        hp: 50,
        maxHp: 50,
        action: 'idle',
        actionSeq: 0,
      },
      {
        id: 'g1',
        npcId: 20016,
        x: 3,
        y: 2,
        z: 3,
        hp: 200,
        maxHp: 200,
        action: 'idle',
        actionSeq: 0,
      },
      {
        id: 's1',
        npcId: 20103,
        x: 4,
        y: 2,
        z: 3,
        hp: 150,
        maxHp: 150,
        action: 'idle',
        actionSeq: 0,
      },
    ]);
    const npcIds = new Set(getGameState().mobs.map((m) => m.npcId));
    expect(npcIds.has(20006)).toBe(true);
    expect(npcIds.has(20132)).toBe(true);
    expect(npcIds.has(20016)).toBe(true);
    expect(npcIds.has(20103)).toBe(true);
  });

  it('setMobs preserves attack action on mob sync (BEST22-52)', () => {
    setMobs([
      {
        id: 'ow1',
        npcId: 20093,
        x: 0,
        y: 0,
        z: 0,
        hp: 80,
        maxHp: 172,
        action: 'attack',
        actionSeq: 2,
      },
    ]);
    const mob = getGameState().mobs.find((m) => m.npcId === 20093);
    expect(mob?.action).toBe('attack');
    expect(mob?.actionSeq).toBe(2);
  });
});

describe('test-hook audio', () => {
  beforeEach(() => {
    initGameState();
  });

  it('AUD29-42: __GAME_STATE__.audio exposes hook fields', () => {
    const mock = createMockAudioBackend();
    const mgr = createAudioManager({ backend: mock.backend });
    mgr.syncZone('ti_village');
    mgr.syncCombat('mob-1');
    mgr.publishHook();
    const audio = getGameState().audio;
    expect(audio).toMatchObject({
      currentMusicId: 'music_town',
      ambientId: 'ambient_village',
      musicVolume: 0.7,
      sfxVolume: 0.8,
      muted: false,
      inCombat: true,
    });
    expect(typeof audio.sfxCounts).toBe('object');
  });

  it('AUD29-43: inCombat mirrors targetMobId presence', () => {
    const mock = createMockAudioBackend();
    const mgr = createAudioManager({ backend: mock.backend });
    mgr.syncCombat(null);
    mgr.publishHook();
    expect(getGameState().audio.inCombat).toBe(false);
    mgr.syncCombat('mob-a');
    mgr.publishHook();
    expect(getGameState().audio.inCombat).toBe(true);
  });
});
describe('test-hook vitals HUD', () => {
  beforeEach(() => {
    initGameState();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the P.Def line stable when other vitals setters fire (no flicker)', () => {
    setPlayerPDef(42);
    const pdef = () =>
      (document.querySelector('[data-role="pdef"]') as HTMLElement | null)?.textContent ?? '';
    expect(pdef()).toBe('P.Def 42');

    // A later maxHp/maxMp update (which omits pDef) must not wipe the P.Def line.
    setMaxHp(120);
    expect(pdef()).toBe('P.Def 42');
    setMaxMp(60);
    expect(pdef()).toBe('P.Def 42');
  });
});

describe('test-hook quests', () => {
  beforeEach(() => {
    initGameState();
  });

  // QUEST21-38
  it('setQuests lists tutorial in active on join shape', () => {
    setQuests([{ questId: 255, status: 'in_progress', step: 0 }]);
    expect(getGameState().quests.active[0]?.title).toBe('Tutorial');
    expect(getGameState().quests.active[0]?.questId).toBe(255);
  });

  // QUEST21-40
  it('moves completed quest to completed list', () => {
    setQuests([
      { questId: 255, status: 'completed', step: 3 },
      { questId: 105, status: 'in_progress', step: 0 },
    ]);
    expect(getGameState().quests.completed.map((q) => q.questId)).toContain(255);
    expect(getGameState().quests.active.map((q) => q.questId)).toContain(105);
  });

  it('exposes quest defs catalog', () => {
    setQuests([]);
    expect(getGameState().quests.defs[255]?.name).toBe('Tutorial');
  });
});
