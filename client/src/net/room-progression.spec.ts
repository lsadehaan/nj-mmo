import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initGameState, getGameState } from '../test-hook';
import type { GameRenderer } from '../scene/renderer';

const { mockCallbacksGet } = vi.hoisted(() => ({
  mockCallbacksGet: vi.fn(),
}));

vi.mock('@colyseus/sdk', () => ({
  Callbacks: {
    get: mockCallbacksGet,
  },
}));

import { wireRoom } from './room';

describe('wireRoom progression (PROG27-36, PROG27-47)', () => {
  let localPlayer: Record<string, unknown>;

  const game = {
    syncLocalPlayer: vi.fn(),
    setLocalPlayerName: vi.fn(),
    syncRemotePlayer: vi.fn(),
    removeRemotePlayer: vi.fn(),
    syncMob: vi.fn(),
    removeMob: vi.fn(),
    syncNpc: vi.fn(),
    removeNpc: vi.fn(),
    triggerNpcGreet: vi.fn(),
    getNpcHookEntries: vi.fn(() => []),
    getMobHookEntries: vi.fn(() => []),
    setAfterTick: vi.fn(),
    syncPlayerVfx: vi.fn(),
    syncMobVfx: vi.fn(),
    setVfxTargetMobId: vi.fn(),
    listRemotePlayers: vi.fn(() => []),
    getCurrentAnimationClip: () => 'idle' as const,
  } as unknown as GameRenderer;

  beforeEach(() => {
    document.body.innerHTML = '';
    initGameState();
    localPlayer = {
      x: 0,
      y: 0,
      z: 0,
      xp: 100,
      level: 5,
      hp: 80,
      maxHp: 80,
      mp: 40,
      maxMp: 40,
      adena: 1000,
      equippedWeaponItemId: 0,
      pDef: 40,
      powerStrikeCooldownEndMs: 0,
      healingPotionCooldownEndMs: 0,
      sp: 99,
      karma: -720,
      pvpFlag: 1,
      expBeforeDeath: 5000,
      unspentStatPoints: 4,
      items: { entries: () => [] as const },
    };

    mockCallbacksGet.mockReturnValue({
      onAdd: (
        collectionOrPlayer: string | Record<string, unknown>,
        handlerOrProperty: string | ((entity: unknown, id: string) => void)
      ) => {
        if (collectionOrPlayer === 'players' && typeof handlerOrProperty === 'function') {
          (handlerOrProperty as (entity: unknown, id: string) => void)(
            localPlayer,
            'local-session'
          );
        }
      },
      onChange: vi.fn(),
      onRemove: vi.fn(),
      listen: vi.fn(),
    });

    wireRoom(
      {
        sessionId: 'local-session',
        send: vi.fn(),
        state: {
          players: new Map([['local-session', localPlayer]]),
          mobs: new Map(),
          npcs: new Map(),
          parties: new Map(),
        },
        onMessage: vi.fn(),
      } as never,
      game
    );
  });

  it('PROG27-36: exposes negative karma on __GAME_STATE__.player', () => {
    expect(getGameState().player.karma).toBe(-720);
  });

  it('PROG27-47: exposes sp, pvpFlag, expBeforeDeath, unspentStatPoints', () => {
    const p = getGameState().player;
    expect(p.sp).toBe(99);
    expect(p.pvpFlag).toBe(1);
    expect(p.expBeforeDeath).toBe(5000);
    expect(p.unspentStatPoints).toBe(4);
  });
});
