import { describe, it, expect, beforeEach } from 'vitest';
import { initGameState, getGameState, setQuests, setMobs, setZone } from '../test-hook';
import { getZoneAt } from '@nj/game-core';

describe('wireRoom mob sync (unit)', () => {
  beforeEach(() => {
    initGameState();
  });

  it('updates __GAME_STATE__.mobs with npcId for Phase 22 types (BEST22-51)', () => {
    setMobs([
      {
        id: 'archer',
        npcId: 20006,
        x: 10,
        y: 4,
        z: -10,
        hp: 131,
        maxHp: 131,
        action: 'idle',
        actionSeq: 0,
      },
    ]);
    expect(getGameState().mobs[0]?.npcId).toBe(20006);
  });

  it('updates __GAME_STATE__.mobs attack action for Orc Warrior (BEST22-52)', () => {
    setMobs([
      {
        id: 'warrior',
        npcId: 20093,
        x: 0,
        y: 0,
        z: 0,
        hp: 100,
        maxHp: 172,
        action: 'attack',
        actionSeq: 1,
      },
    ]);
    expect(getGameState().mobs[0]?.action).toBe('attack');
  });
});

describe('wireRoom quest sync (unit)', () => {
  beforeEach(() => {
    initGameState();
  });

  it('updates __GAME_STATE__.quests when entries change', () => {
    setQuests([{ questId: 255, status: 'in_progress', step: 1 }]);
    expect(getGameState().quests.active).toHaveLength(1);
    expect(getGameState().quests.active[0]?.objectiveText).toContain('Gremlin');

    setQuests([{ questId: 255, status: 'in_progress', step: 2 }]);
    expect(getGameState().quests.active[0]?.step).toBe(2);
  });
});

describe('test-hook zone defaults', () => {
  beforeEach(() => {
    initGameState();
  });

  it('TIW23-47: pre-join zone is unknown', () => {
    expect(getGameState().zone).toEqual({
      id: '',
      type: 'unknown',
      displayName: '',
    });
  });
});

describe('wireRoom zone sync (unit)', () => {
  beforeEach(() => {
    initGameState();
  });

  it('TIW23-45: exposes zone id and type from server zoneId', () => {
    const hit = getZoneAt(0, 0);
    setZone({ id: 'ti_village', type: hit.type, displayName: hit.displayName });
    expect(getGameState().zone.id).toBe('ti_village');
    expect(getGameState().zone.type).toBe('peace');
  });

  it('TIW23-46: updates zone when moving village → obelisk', () => {
    const village = getZoneAt(0, 0);
    setZone({ id: 'ti_village', type: village.type, displayName: village.displayName });
    const obelisk = getZoneAt(-150, 55);
    setZone({ id: 'obelisk', type: obelisk.type, displayName: obelisk.displayName });
    expect(getGameState().zone.id).toBe('obelisk');
    expect(getGameState().zone.type).toBe('combat');
  });
});
