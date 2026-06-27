import { describe, it, expect, beforeEach } from 'vitest';
import {
  initGameState,
  setCharacterId,
  setMobs,
  setOthers,
  setPlayer,
  setTargetMobId,
} from './test-hook';

describe('test-hook multiplayer state', () => {
  beforeEach(() => {
    initGameState();
  });

  it('stores remote players in others', () => {
    const input = [
      { id: 'a', x: 1, y: 2, z: 3 },
      { id: 'b', x: 4, y: 5, z: 6 },
    ];
    setOthers(input);

    const state = window.__GAME_STATE__;
    expect(state.others).toEqual(input);
    expect(state.others).not.toBe(input);
  });

  it('stores characterId', () => {
    setCharacterId('char-uuid');
    expect(window.__GAME_STATE__.characterId).toBe('char-uuid');
    setCharacterId(null);
    expect(window.__GAME_STATE__.characterId).toBeNull();
  });

  it('starts with zero local movement ticks', () => {
    expect(window.__GAME_STATE__.localMovementTicks).toBe(0);
  });

  it('stores mobs from server snapshots without local hp mutation', () => {
    const input = [
      {
        id: 'mob-1',
        npcId: 20001,
        x: 12,
        y: 4.26,
        z: -18,
        hp: 41,
        maxHp: 41,
      },
    ];
    setMobs(input);

    const state = window.__GAME_STATE__;
    expect(state.mobs).toEqual(input);
    expect(state.mobs).not.toBe(input);
    input[0].hp = 0;
    expect(state.mobs[0].hp).toBe(41);
  });

  it('stores combat target and player progression from server', () => {
    setTargetMobId('mob-1');
    setPlayer({ x: 1, y: 2, z: 3, xp: 44, level: 1 });

    const state = window.__GAME_STATE__;
    expect(state.targetMobId).toBe('mob-1');
    expect(state.player.xp).toBe(44);
    expect(state.player.level).toBe(1);
  });

  it('initializes combat hook fields', () => {
    expect(window.__GAME_STATE__.mobs).toEqual([]);
    expect(window.__GAME_STATE__.targetMobId).toBeNull();
    expect(window.__GAME_STATE__.player.xp).toBe(0);
    expect(window.__GAME_STATE__.player.level).toBe(1);
  });
});
