import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initGameState } from '../test-hook';

const mockSend = vi.fn();

vi.mock('@colyseus/sdk', () => ({
  Callbacks: {
    get: () => ({
      onAdd: vi.fn(),
      onChange: vi.fn(),
      onRemove: vi.fn(),
      listen: vi.fn(),
    }),
  },
}));

const mockGame = {
  syncLocalPlayer: vi.fn(),
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
  getCurrentAnimationClip: () => 'idle' as const,
};

describe('wireRoom e2e hooks', () => {
  beforeEach(() => {
    initGameState();
    mockSend.mockReset();
    vi.resetModules();
    vi.stubEnv('VITE_NJ_E2E', 'true');
  });

  it('sends e2eTeleport with x/z payload', async () => {
    const { wireRoom } = await import('./room');
    const room = {
      sessionId: 'sess-1',
      send: mockSend,
      state: { players: new Map(), mobs: new Map(), npcs: new Map() },
      onMessage: vi.fn(),
    };
    wireRoom(room as never, mockGame as never);
    window.__e2eTeleport__?.(30, -30);
    expect(mockSend).toHaveBeenCalledWith('e2eTeleport', { x: 30, z: -30 });
  });

  it('sends e2eDamage with amount payload', async () => {
    const { wireRoom } = await import('./room');
    const room = {
      sessionId: 'sess-1',
      send: mockSend,
      state: { players: new Map(), mobs: new Map(), npcs: new Map() },
      onMessage: vi.fn(),
    };
    wireRoom(room as never, mockGame as never);
    window.__e2eDamage__?.(25);
    expect(mockSend).toHaveBeenCalledWith('e2eDamage', { amount: 25 });
  });

  it('sends e2eFreezeMob with mobId payload', async () => {
    const { wireRoom } = await import('./room');
    const room = {
      sessionId: 'sess-1',
      send: mockSend,
      state: { players: new Map(), mobs: new Map(), npcs: new Map() },
      onMessage: vi.fn(),
    };
    wireRoom(room as never, mockGame as never);
    window.__e2eFreezeMob__?.('mob-abc');
    expect(mockSend).toHaveBeenCalledWith('e2eFreezeMob', { mobId: 'mob-abc' });
  });
});
