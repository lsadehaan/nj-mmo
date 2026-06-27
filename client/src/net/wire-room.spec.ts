import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initGameState } from '../test-hook';

const { mockOnAdd, mockOnChange, mockOnRemove } = vi.hoisted(() => ({
  mockOnAdd: vi.fn(),
  mockOnChange: vi.fn(),
  mockOnRemove: vi.fn(),
}));

vi.mock('@colyseus/sdk', () => ({
  Callbacks: {
    get: () => ({
      onAdd: mockOnAdd,
      onChange: mockOnChange,
      onRemove: mockOnRemove,
    }),
  },
}));

const mockSyncLocalPlayer = vi.fn();
const mockGame = {
  syncLocalPlayer: mockSyncLocalPlayer,
  syncRemotePlayer: vi.fn(),
  removeRemotePlayer: vi.fn(),
  syncMob: vi.fn(),
  removeMob: vi.fn(),
};

describe('wireRoom player combat sync', () => {
  beforeEach(() => {
    initGameState();
    mockOnAdd.mockReset();
    mockOnChange.mockReset();
    mockOnRemove.mockReset();
    mockSyncLocalPlayer.mockReset();
    vi.resetModules();
  });

  it('syncs mp and powerStrikeCooldownEndMs when local player is added', async () => {
    let localPlayer: Record<string, unknown> | null = null;
    let localOnChange: (() => void) | null = null;
    const cooldownEndMs = Date.now() + 3_000;

    mockOnAdd.mockImplementation((collection: string, handler: (item: unknown, id: string) => void) => {
      if (collection !== 'players') return;
      const player = {
        x: 1,
        y: 2,
        z: 3,
        xp: 10,
        level: 1,
        mp: 41,
        powerStrikeCooldownEndMs: cooldownEndMs,
      };
      localPlayer = player;
      handler(player, 'local-session');
    });

    mockOnChange.mockImplementation((target: unknown, handler: () => void) => {
      if (target === localPlayer) {
        localOnChange = handler;
      }
    });

    const { wireRoom } = await import('./room');
    const room = {
      sessionId: 'local-session',
      state: { mobs: new Map() },
    };
    wireRoom(room as never, mockGame as never);

    const state = window.__GAME_STATE__;
    expect(state.player.mp).toBe(41);
    expect(state.player.powerStrikeCooldownEndMs).toBe(cooldownEndMs);
    expect(state.player.powerStrikeCooldownRemainingMs).toBeGreaterThan(0);

    (localPlayer as { mp: number }).mp = 32;
    (localPlayer as { powerStrikeCooldownEndMs: number }).powerStrikeCooldownEndMs = 0;
    localOnChange?.();

    expect(window.__GAME_STATE__.player.mp).toBe(32);
    expect(window.__GAME_STATE__.player.powerStrikeCooldownEndMs).toBe(0);
    expect(window.__GAME_STATE__.player.powerStrikeCooldownRemainingMs).toBe(0);
  });
});
