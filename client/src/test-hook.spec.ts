import { describe, it, expect, beforeEach } from 'vitest';
import { initGameState, setCharacterId, setOthers } from './test-hook';

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
});
