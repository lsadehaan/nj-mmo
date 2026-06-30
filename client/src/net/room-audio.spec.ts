import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initGameState, getGameState } from '../test-hook';
import { getZoneAt } from '@nj/game-core';
import { wireRoom } from './room';
import type { GameRenderer } from '../scene/renderer';
import { createMockAudioBackend } from '../audio/audio-backend';
import { createAudioManager } from '../audio/audio-manager';

const { mockCallbacksGet } = vi.hoisted(() => ({
  mockCallbacksGet: vi.fn(),
}));

vi.mock('@colyseus/sdk', () => ({
  Callbacks: {
    get: mockCallbacksGet,
  },
}));

describe('wireRoom audio sync', () => {
  let localPlayer: Record<string, unknown>;
  let onLocalChange: (() => void) | undefined;
  let audioManager: ReturnType<typeof createAudioManager>;
  let syncZoneSpy: ReturnType<typeof vi.fn>;

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
    setAfterTick: vi.fn(),
    syncPlayerVfx: vi.fn(),
    syncMobVfx: vi.fn(),
    setVfxTargetMobId: vi.fn(),
    getCurrentAnimationClip: () => 'idle' as const,
  } as unknown as GameRenderer;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    initGameState();
    onLocalChange = undefined;
    const mock = createMockAudioBackend();
    audioManager = createAudioManager({ backend: mock.backend });
    syncZoneSpy = vi.spyOn(audioManager, 'syncZone');

    localPlayer = {
      x: 0,
      y: 4.26,
      z: 0,
      xp: 0,
      level: 1,
      hp: 100,
      maxHp: 100,
      mp: 50,
      maxMp: 50,
      adena: 0,
      equippedWeaponItemId: 0,
      powerStrikeCooldownEndMs: 0,
      healingPotionCooldownEndMs: 0,
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
      onChange: (target: unknown, handlerOrProperty?: string | (() => void)) => {
        if (target === localPlayer && typeof handlerOrProperty === 'function') {
          onLocalChange = handlerOrProperty;
        }
      },
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
        },
        onMessage: vi.fn(),
      } as never,
      game,
      { audioManager }
    );
  });

  it('AUD29-15: syncZone invoked when player position updates zone', () => {
    onLocalChange?.();
    const village = getZoneAt(0, 0);
    expect(syncZoneSpy).toHaveBeenCalledWith(village.zoneId);
    expect(getGameState().zone.id).toBe(village.zoneId);

    localPlayer.x = -150;
    localPlayer.z = 55;
    syncZoneSpy.mockClear();
    onLocalChange?.();
    const obelisk = getZoneAt(-150, 55);
    expect(syncZoneSpy).toHaveBeenCalledWith(obelisk.zoneId);
    expect(getGameState().zone.id).toBe(obelisk.zoneId);
  });
});
