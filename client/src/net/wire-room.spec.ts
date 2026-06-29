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
const mockSyncPlayerVfx = vi.fn();
const mockSyncMobVfx = vi.fn();
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
  syncPlayerVfx: mockSyncPlayerVfx,
  syncMobVfx: mockSyncMobVfx,
  setVfxTargetMobId: vi.fn(),
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
    mockSyncPlayerVfx.mockReset();
    mockSyncMobVfx.mockReset();
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
            action: 0,
            actionSeq: 0,
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

  it('syncs healingPotionCooldownEndMs and derives remaining ms from server', async () => {
    let localPlayer: Record<string, unknown> | null = null;
    let localOnChange: (() => void) | null = null;
    const cooldownEndMs = 20_000;
    const nowMs = 10_000;

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
            hp: 80,
            maxHp: 100,
            maxMp: 50,
            mp: 50,
            adena: 1000,
            equippedWeaponItemId: 0,
            powerStrikeCooldownEndMs: 0,
            healingPotionCooldownEndMs: cooldownEndMs,
            action: 0,
            actionSeq: 0,
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
    vi.spyOn(Date, 'now').mockReturnValue(nowMs);
    wireRoom(
      {
        sessionId: 'local-session',
        state: { mobs: new Map(), players: new Map(), npcs: new Map() },
        onMessage: vi.fn(),
        send: vi.fn(),
      } as never,
      mockGame as never
    );

    expect(window.__GAME_STATE__.player.healingPotionCooldownEndMs).toBe(cooldownEndMs);
    expect(window.__GAME_STATE__.player.healingPotionCooldownRemainingMs).toBe(10_000);

    if (!localPlayer) throw new Error('expected local player');
    const onChange = localOnChange;
    if (!onChange) throw new Error('expected onChange handler');
    (localPlayer as { healingPotionCooldownEndMs: number }).healingPotionCooldownEndMs = 5_000;
    (onChange as () => void)();

    expect(window.__GAME_STATE__.player.healingPotionCooldownRemainingMs).toBe(0);
    vi.restoreAllMocks();
  });

  it('forwards mob hp deltas to syncMobVfx on change', async () => {
    let mobOnChange: (() => void) | null = null;
    let mobState: Record<string, unknown> | null = null;

    mockOnChange.mockImplementation((target: unknown, handler: () => void) => {
      if (target === mobState) mobOnChange = handler;
    });

    mockOnAdd.mockImplementation(
      (collection: string, handler: (item: unknown, id: string) => void) => {
        if (collection === 'mobs') {
          mobState = {
            npcId: 20001,
            x: 1,
            y: 0,
            z: 2,
            hp: 41,
            maxHp: 41,
            action: 0,
            actionSeq: 0,
          };
          handler(mobState, 'mob-a');
        }
        if (collection === 'players') {
          handler(
            {
              x: 0,
              y: 0,
              z: 0,
              xp: 0,
              level: 1,
              hp: 100,
              maxHp: 100,
              maxMp: 50,
              mp: 50,
              adena: 0,
              equippedWeaponItemId: 0,
              powerStrikeCooldownEndMs: 0,
              action: 0,
              actionSeq: 0,
              items: { entries: () => [] as const },
            },
            'local-session'
          );
        }
      }
    );

    const { wireRoom } = await import('./room');
    wireRoom(
      {
        sessionId: 'local-session',
        state: { mobs: new Map(), players: new Map(), npcs: new Map() },
        onMessage: vi.fn(),
        send: vi.fn(),
      } as never,
      mockGame as never
    );

    expect(mockSyncMobVfx).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mob-a', hp: 41 })
    );
    mockSyncMobVfx.mockClear();

    if (!mobState || !mobOnChange) throw new Error('expected mob handler');
    (mobState as { hp: number }).hp = 24;
    (mobOnChange as () => void)();

    expect(mockSyncMobVfx).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mob-a', hp: 24 })
    );
  });

  it('does not trigger Power Strike VFX solely from cooldown 0→active', async () => {
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
            action: 0,
            actionSeq: 0,
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
    wireRoom(
      {
        sessionId: 'local-session',
        state: { mobs: new Map(), players: new Map(), npcs: new Map() },
        onMessage: vi.fn(),
        send: vi.fn(),
      } as never,
      mockGame as never
    );

    if (!localPlayer) throw new Error('expected local player');
    const onChange = localOnChange;
    if (!onChange) throw new Error('expected onChange handler');
    (localPlayer as { powerStrikeCooldownEndMs: number }).powerStrikeCooldownEndMs =
      Date.now() + 3_000;
    (onChange as () => void)();

    expect(mockSyncPlayerVfx).toHaveBeenCalled();
    const calls = mockSyncPlayerVfx.mock.calls;
    const last = calls[calls.length - 1][0] as { action: number; actionSeq: number };
    expect(last.action).toBe(0);
    expect(last.actionSeq).toBe(0);
  });

  it('fires greet for interacted merchant npcId on shop open (TINPC-29)', async () => {
    let interactHandler: ((message: { npcId: number; type: string; name: string }) => void) | null =
      null;

    mockOnAdd.mockImplementation(
      (
        collectionOrPlayer: string | Record<string, unknown>,
        handlerOrProperty: string | ((item: unknown, id: string) => void),
        handler?: (stack: unknown) => void
      ) => {
        if (collectionOrPlayer === 'players' && typeof handlerOrProperty === 'function') {
          handlerOrProperty(
            {
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
              action: 0,
              actionSeq: 0,
              items: { entries: () => [] as const },
            },
            'local-session'
          );
        }
        if (
          collectionOrPlayer !== 'players' &&
          collectionOrPlayer === 'players' &&
          handlerOrProperty === 'items' &&
          typeof handler === 'function'
        ) {
          void handler;
        }
      }
    );

    const { wireRoom } = await import('./room');
    const room = {
      sessionId: 'local-session',
      state: { mobs: new Map(), players: new Map(), npcs: new Map() },
      onMessage: vi.fn((type: string, cb: (message: unknown) => void) => {
        if (type === 'interactResult') interactHandler = cb as typeof interactHandler;
      }),
      send: vi.fn(),
    };
    wireRoom(room as never, mockGame as never);

    expect(interactHandler).not.toBeNull();
    interactHandler!({ npcId: 30001, type: 'Merchant', name: 'Lector' });
    expect(mockGame.triggerNpcGreet).toHaveBeenCalledWith(30001, expect.any(Object), expect.any(Number));
  });
});

describe('wireRoom class identity', () => {
  beforeEach(() => {
    initGameState();
    mockOnAdd.mockReset();
    mockOnChange.mockReset();
    mockOnRemove.mockReset();
    mockListen.mockReset();
    mockSyncLocalPlayer.mockReset();
    mockSyncPlayerVfx.mockReset();
    vi.resetModules();
  });

  it('CHAR19-33: syncs classId, sex, and str to __GAME_STATE__.player', async () => {
    mockOnAdd.mockImplementation(
      (
        collectionOrPlayer: string | Record<string, unknown>,
        handlerOrProperty: string | ((item: unknown, id: string) => void)
      ) => {
        if (collectionOrPlayer === 'players' && typeof handlerOrProperty === 'function') {
          handlerOrProperty(
            {
              x: 1,
              y: 2,
              z: 3,
              classId: 18,
              sex: 0,
              str: 36,
              dex: 35,
              con: 36,
              int: 23,
              wit: 14,
              men: 26,
              xp: 0,
              level: 1,
              hp: 89,
              maxHp: 89,
              mp: 30,
              maxMp: 30,
              adena: 1000,
              equippedWeaponItemId: 0,
              powerStrikeCooldownEndMs: 0,
              items: { entries: () => [] as const },
            },
            'local-session'
          );
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

    const { player } = (await import('../test-hook')).getGameState();
    expect(player.classId).toBe(18);
    expect(player.str).toBe(36);
  });

  it('CHAR19-34: classId 10 exposes Mage avatar model in __GAME_STATE__', async () => {
    mockOnAdd.mockImplementation(
      (
        collectionOrPlayer: string | Record<string, unknown>,
        handlerOrProperty: string | ((item: unknown, id: string) => void)
      ) => {
        if (collectionOrPlayer === 'players' && typeof handlerOrProperty === 'function') {
          handlerOrProperty(
            {
              x: 0,
              y: 0,
              z: 0,
              classId: 10,
              sex: 0,
              str: 22,
              xp: 0,
              level: 1,
              hp: 101,
              maxHp: 101,
              mp: 40,
              maxMp: 40,
              adena: 1000,
              equippedWeaponItemId: 0,
              powerStrikeCooldownEndMs: 0,
              items: { entries: () => [] as const },
            },
            'local-session'
          );
        }
      }
    );

    const { wireRoom } = await import('./room');
    wireRoom(
      {
        sessionId: 'local-session',
        state: { mobs: new Map(), players: new Map(), npcs: new Map() },
        onMessage: vi.fn(),
        send: vi.fn(),
      } as never,
      mockGame as never
    );

    const { player } = (await import('../test-hook')).getGameState();
    expect(player.avatarModel).toBe('/models/characters/Mage.glb');
  });

  it('CHAR19-35: forwards classId to syncLocalPlayer', async () => {
    mockOnAdd.mockImplementation(
      (
        collectionOrPlayer: string | Record<string, unknown>,
        handlerOrProperty: string | ((item: unknown, id: string) => void)
      ) => {
        if (collectionOrPlayer === 'players' && typeof handlerOrProperty === 'function') {
          handlerOrProperty(
            {
              x: 5,
              y: 6,
              z: 7,
              classId: 31,
              sex: 1,
              xp: 0,
              level: 1,
              hp: 94,
              maxHp: 94,
              mp: 30,
              maxMp: 30,
              adena: 1000,
              equippedWeaponItemId: 0,
              powerStrikeCooldownEndMs: 0,
              items: { entries: () => [] as const },
            },
            'local-session'
          );
        }
      }
    );

    const { wireRoom } = await import('./room');
    wireRoom(
      {
        sessionId: 'local-session',
        state: { mobs: new Map(), players: new Map(), npcs: new Map() },
        onMessage: vi.fn(),
        send: vi.fn(),
      } as never,
      mockGame as never
    );

    expect(mockSyncLocalPlayer).toHaveBeenCalledWith(5, 6, 7, 0, 0, 0, 31, 1);
  });

  it('SKILL20-50: syncs knownSkillIds and skill cooldown arrays from PlayerState', async () => {
    mockOnAdd.mockImplementation(
      (
        collectionOrPlayer: string | Record<string, unknown>,
        handlerOrProperty: string | ((item: unknown, id: string) => void)
      ) => {
        if (collectionOrPlayer === 'players' && typeof handlerOrProperty === 'function') {
          handlerOrProperty(
            {
              x: 0,
              y: 0,
              z: 0,
              xp: 0,
              level: 1,
              hp: 100,
              maxHp: 100,
              mp: 50,
              maxMp: 50,
              adena: 1000,
              equippedWeaponItemId: 0,
              powerStrikeCooldownEndMs: 5_000,
              healingPotionCooldownEndMs: 0,
              knownSkillIds: [3, 1177],
              skillCooldownEndMs: [5_000, 0],
              castingSkillId: 0,
              castEndMs: 0,
              activeBuffSkillId: 0,
              action: 0,
              actionSeq: 0,
              items: { entries: () => [] as const },
            },
            'local-session'
          );
        }
      }
    );

    const { wireRoom } = await import('./room');
    wireRoom(
      {
        sessionId: 'local-session',
        state: { mobs: new Map(), players: new Map(), npcs: new Map() },
        onMessage: vi.fn(),
        send: vi.fn(),
      } as never,
      mockGame as never
    );

    expect(window.__GAME_STATE__.player.knownSkillIds).toEqual([3, 1177]);
    expect(window.__GAME_STATE__.player.skillCooldownEndMs).toEqual([5_000, 0]);
  });

  it('SKILL20-42: exposes active Might buff in player.effects hook', async () => {
    mockOnAdd.mockImplementation(
      (
        collectionOrPlayer: string | Record<string, unknown>,
        handlerOrProperty: string | ((item: unknown, id: string) => void)
      ) => {
        if (collectionOrPlayer === 'players' && typeof handlerOrProperty === 'function') {
          handlerOrProperty(
            {
              x: 0,
              y: 0,
              z: 0,
              xp: 0,
              level: 1,
              hp: 100,
              maxHp: 100,
              mp: 50,
              maxMp: 50,
              adena: 1000,
              equippedWeaponItemId: 0,
              powerStrikeCooldownEndMs: 0,
              healingPotionCooldownEndMs: 0,
              knownSkillIds: [1068],
              skillCooldownEndMs: [0],
              castingSkillId: 0,
              castEndMs: 0,
              activeBuffSkillId: 1068,
              action: 0,
              actionSeq: 0,
              items: { entries: () => [] as const },
            },
            'local-session'
          );
        }
      }
    );

    const { wireRoom } = await import('./room');
    wireRoom(
      {
        sessionId: 'local-session',
        state: { mobs: new Map(), players: new Map(), npcs: new Map() },
        onMessage: vi.fn(),
        send: vi.fn(),
      } as never,
      mockGame as never
    );

    expect(window.__GAME_STATE__.player.effects).toEqual(['Might']);
  });

  it('SKILL20-37: forwards useShot intent from inventory handlers', async () => {
    const send = vi.fn();
    mockOnAdd.mockImplementation(
      (
        collectionOrPlayer: string | Record<string, unknown>,
        handlerOrProperty: string | ((item: unknown, id: string) => void)
      ) => {
        if (collectionOrPlayer === 'players' && typeof handlerOrProperty === 'function') {
          handlerOrProperty(
            {
              x: 0,
              y: 0,
              z: 0,
              xp: 0,
              level: 1,
              hp: 100,
              maxHp: 100,
              mp: 50,
              maxMp: 50,
              adena: 1000,
              equippedWeaponItemId: 0,
              powerStrikeCooldownEndMs: 0,
              healingPotionCooldownEndMs: 0,
              knownSkillIds: [],
              skillCooldownEndMs: [],
              action: 0,
              actionSeq: 0,
              items: { entries: () => [] as const },
            },
            'local-session'
          );
        }
      }
    );

    const { wireRoom } = await import('./room');
    wireRoom(
      {
        sessionId: 'local-session',
        state: { mobs: new Map(), players: new Map(), npcs: new Map() },
        onMessage: vi.fn(),
        send,
      } as never,
      mockGame as never
    );

    window.__useShot__?.(1835);
    expect(send).toHaveBeenCalledWith('useShot', { itemId: 1835 });
  });
});
