import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initGameState } from '../test-hook';

const { mockOnAdd, mockOnChange, mockOnRemove, mockListen } = vi.hoisted(() => ({
  mockOnAdd: vi.fn(),
  mockOnChange: vi.fn(),
  mockOnRemove: vi.fn(),
  mockListen: vi.fn(),
}));

vi.mock('@colyseus/sdk', () => ({
  Callbacks: {
    get: () => ({
      onAdd: mockOnAdd,
      onChange: mockOnChange,
      onRemove: mockOnRemove,
      listen: mockListen,
    }),
  },
}));

const mockSyncLocalPlayer = vi.fn();
const mockTriggerSkillFlash = vi.fn();
const mockGame = {
  syncLocalPlayer: mockSyncLocalPlayer,
  syncRemotePlayer: vi.fn(),
  removeRemotePlayer: vi.fn(),
  syncMob: vi.fn(),
  removeMob: vi.fn(),
  syncNpc: vi.fn(),
  removeNpc: vi.fn(),
  triggerNpcGreet: vi.fn(),
  getNpcHookEntries: vi.fn(() => []),
  setAfterTick: vi.fn(),
  triggerSkillFlash: mockTriggerSkillFlash,
  getCurrentAnimationClip: () => 'idle' as const,
};

describe('wireRoom player combat sync', () => {
  beforeEach(() => {
    initGameState();
    mockOnAdd.mockReset();
    mockOnChange.mockReset();
    mockOnRemove.mockReset();
    mockListen.mockReset();
    mockSyncLocalPlayer.mockReset();
    mockTriggerSkillFlash.mockReset();
    vi.resetModules();
  });

  it('syncs mp and powerStrikeCooldownEndMs when local player is added', async () => {
    let localPlayer: Record<string, unknown> | null = null;
    let localOnChange: (() => void) | null = null;
    const cooldownEndMs = Date.now() + 3_000;

    mockOnChange.mockImplementation(
      (target: unknown, handlerOrProperty: string | (() => void), handler?: () => void) => {
        if (target === localPlayer && typeof handlerOrProperty === 'function') {
          localOnChange = handlerOrProperty;
        }
        if (
          target === localPlayer &&
          handlerOrProperty === 'items' &&
          typeof handler === 'function'
        ) {
          void handler;
        }
      }
    );

    mockOnAdd.mockImplementation(
      (
        collectionOrPlayer: string | Record<string, unknown>,
        handlerOrProperty: string | ((item: unknown, id: string) => void),
        handler?: (stack: unknown) => void
      ) => {
        if (collectionOrPlayer === 'players' && typeof handlerOrProperty === 'function') {
          const player = {
            x: 1,
            y: 2,
            z: 3,
            xp: 10,
            level: 1,
            hp: 100,
            maxHp: 100,
            maxMp: 50,
            mp: 41,
            adena: 1000,
            equippedWeaponItemId: 0,
            powerStrikeCooldownEndMs: cooldownEndMs,
            items: { entries: () => [] as const },
          };
          localPlayer = player;
          handlerOrProperty(player, 'local-session');
        }
        if (
          localPlayer &&
          collectionOrPlayer === localPlayer &&
          handlerOrProperty === 'items' &&
          typeof handler === 'function'
        ) {
          for (const [, stack] of (localPlayer.items as { entries: () => Iterable<[string, unknown]> }).entries()) {
            handler(stack);
          }
        }
      }
    );

    const { wireRoom } = await import('./room');
    const room = {
      sessionId: 'local-session',
      state: { mobs: new Map(), players: new Map(), npcs: new Map() },
      onMessage: vi.fn(),
      send: vi.fn(),
    };
    wireRoom(room as never, mockGame as never);

    const state = window.__GAME_STATE__;
    expect(state.player.mp).toBe(41);
    expect(state.player.powerStrikeCooldownEndMs).toBe(cooldownEndMs);
    expect(state.player.powerStrikeCooldownRemainingMs).toBeGreaterThan(0);

    if (!localPlayer) throw new Error('expected local player');
    const onChange = localOnChange;
    if (!onChange) throw new Error('expected onChange handler');
    const playerRef = localPlayer as { mp: number; powerStrikeCooldownEndMs: number };
    playerRef.mp = 32;
    playerRef.powerStrikeCooldownEndMs = 0;
    (onChange as () => void)();

    expect(window.__GAME_STATE__.player.mp).toBe(32);
    expect(window.__GAME_STATE__.player.powerStrikeCooldownEndMs).toBe(0);
    expect(window.__GAME_STATE__.player.powerStrikeCooldownRemainingMs).toBe(0);
  });

  it('triggers skill flash when powerStrikeCooldownEndMs transitions from 0 to active', async () => {
    let localPlayer: Record<string, unknown> | null = null;
    let localOnChange: (() => void) | null = null;

    mockOnChange.mockImplementation(
      (target: unknown, handlerOrProperty: string | (() => void), handler?: () => void) => {
        if (target === localPlayer && typeof handlerOrProperty === 'function') {
          localOnChange = handlerOrProperty;
        }
        if (
          target === localPlayer &&
          handlerOrProperty === 'items' &&
          typeof handler === 'function'
        ) {
          void handler;
        }
      }
    );

    mockOnAdd.mockImplementation(
      (
        collectionOrPlayer: string | Record<string, unknown>,
        handlerOrProperty: string | ((item: unknown, id: string) => void),
        handler?: (stack: unknown) => void
      ) => {
        if (collectionOrPlayer === 'players' && typeof handlerOrProperty === 'function') {
          const player = {
            x: 0,
            y: 0,
            z: 0,
            xp: 0,
            level: 1,
            hp: 100,
            maxHp: 100,
            maxMp: 50,
            mp: 50,
            adena: 1000,
            equippedWeaponItemId: 0,
            powerStrikeCooldownEndMs: 0,
            items: { entries: () => [] as const },
          };
          localPlayer = player;
          handlerOrProperty(player, 'local-session');
        }
        if (
          localPlayer &&
          collectionOrPlayer === localPlayer &&
          handlerOrProperty === 'items' &&
          typeof handler === 'function'
        ) {
          for (const [, stack] of (localPlayer.items as { entries: () => Iterable<[string, unknown]> }).entries()) {
            handler(stack);
          }
        }
      }
    );

    const { wireRoom } = await import('./room');
    wireRoom({ sessionId: 'local-session', state: { mobs: new Map(), players: new Map(), npcs: new Map() }, onMessage: vi.fn(), send: vi.fn() } as never, mockGame as never);

    expect(mockTriggerSkillFlash).not.toHaveBeenCalled();

    if (!localPlayer) throw new Error('expected local player');
    const onChange = localOnChange;
    if (!onChange) throw new Error('expected onChange handler');
    (localPlayer as { powerStrikeCooldownEndMs: number }).powerStrikeCooldownEndMs = Date.now() + 3_000;
    (onChange as () => void)();

    expect(mockTriggerSkillFlash).toHaveBeenCalledTimes(1);
  });
});
