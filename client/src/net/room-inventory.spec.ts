import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initGameState } from '../test-hook';
import { wireRoom } from './room';
import type { GameRenderer } from '../scene/renderer';

const { mockCallbacksGet } = vi.hoisted(() => ({
  mockCallbacksGet: vi.fn(),
}));

vi.mock('@colyseus/sdk', () => ({
  Callbacks: {
    get: mockCallbacksGet,
  },
}));

describe('room inventory equip wiring', () => {
  const send = vi.fn();
  let localPlayer: Record<string, unknown>;
  let onLocalChange: (() => void) | undefined;

  const game = {
    syncLocalPlayer: vi.fn(),
    syncRemotePlayer: vi.fn(),
    removeRemotePlayer: vi.fn(),
    syncMob: vi.fn(),
    removeMob: vi.fn(),
    syncNpc: vi.fn(),
    removeNpc: vi.fn(),
    triggerSkillFlash: vi.fn(),
  } as unknown as GameRenderer;

  beforeEach(() => {
    document.body.innerHTML = '';
    initGameState();
    send.mockReset();
    onLocalChange = undefined;

    localPlayer = {
      x: 0,
      y: 4.26,
      z: 0,
      xp: 0,
      level: 1,
      mp: 50,
      hp: 100,
      maxHp: 100,
      maxMp: 50,
      adena: 1000,
      equippedWeaponItemId: 0,
      powerStrikeCooldownEndMs: 0,
      items: {
        entries: () => [['2369', { itemId: 2369, count: 1 }]] as const,
      },
    };

    mockCallbacksGet.mockReturnValue({
      onAdd: (path: string, cb: (entity: unknown, id: string) => void) => {
        if (path === 'players') {
          cb(localPlayer, 'local-session');
        }
      },
      onChange: (_state: unknown, cb: () => void) => {
        onLocalChange = cb;
      },
      onRemove: vi.fn(),
    });

    const room = {
      sessionId: 'local-session',
      send,
      state: {
        players: new Map([['local-session', localPlayer]]),
        mobs: new Map(),
        npcs: new Map(),
      },
      onMessage: vi.fn(),
    };

    wireRoom(room as never, game);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('__equipItem__ sends equip intent with itemId only (no local stat changes)', () => {
    window.__equipItem__?.(2369);
    expect(send).toHaveBeenCalledWith('equip', { itemId: 2369 });
    expect(window.__GAME_STATE__.player.level).toBe(1);
  });

  it('__openInventory__ reveals inventory window with owned items', () => {
    window.__openInventory__?.();

    const panel = document.getElementById('inventory-window');
    expect(panel?.hidden).toBe(false);
    expect(
      document.querySelector('#inventory-window [data-inventory-item-id="2369"]')
    ).not.toBeNull();
  });

  it('reflects server equippedWeaponItemId on inventory panel after state sync', () => {
    localPlayer.equippedWeaponItemId = 2369;
    onLocalChange?.();

    const equipped = document.querySelector('#inventory-window [data-equipped-weapon]');
    expect(equipped?.textContent).toMatch(/Squire's Sword/i);
  });
});
