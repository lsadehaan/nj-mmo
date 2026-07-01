import { describe, it, expect, vi, beforeEach } from 'vitest';

const storage: Record<string, string> = {};

const { mockJoinOrCreate } = vi.hoisted(() => ({
  mockJoinOrCreate: vi.fn(),
}));

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = value;
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
});

vi.mock('@colyseus/sdk', () => ({
  Client: class MockClient {
    joinOrCreate = mockJoinOrCreate;
    constructor(_endpoint: string) {
      void _endpoint;
    }
  },
}));

vi.mock('../test-hook', () => ({
  setConnected: vi.fn(),
  setCharacterId: vi.fn(),
  setOthers: vi.fn(),
}));

describe('room connect', () => {
  beforeEach(() => {
    for (const key of Object.keys(storage)) {
      delete storage[key];
    }
    mockJoinOrCreate.mockReset();
    vi.resetModules();
  });

  it('passes stored characterId to joinOrCreate and persists server characterId message', async () => {
    storage['nj.characterId'] = 'stored-uuid';

    const handlers: Record<string, (payload: string) => void> = {};
    const mockRoom = {
      sessionId: 'local-session',
      onMessage: (type: string, handler: (payload: string) => void) => {
        handlers[type] = handler;
      },
      state: {
        players: new Map([['local-session', {}]]),
        mobs: new Map([['mob-1', { x: 0, z: 0 }]]),
      },
    };
    mockJoinOrCreate.mockResolvedValue(mockRoom);

    const { connect, CHARACTER_ID_STORAGE_KEY } = await import('./room');
    const room = await connect('http://test');

    expect(CHARACTER_ID_STORAGE_KEY).toBe('nj.characterId');
    expect(mockJoinOrCreate).toHaveBeenCalledWith('town', { characterId: 'stored-uuid' });
    expect(room).toBe(mockRoom);

    handlers['characterId']('server-issued-uuid');
    expect(storage['nj.characterId']).toBe('server-issued-uuid');
  });

  it('sends create options instead of a stale stored characterId when creating a new character', async () => {
    storage['nj.characterId'] = 'existing-character-uuid';

    const mockRoom = {
      sessionId: 'local-session',
      onMessage: vi.fn(),
      state: {
        players: new Map([['local-session', {}]]),
        mobs: new Map([['mob-1', { x: 0, z: 0 }]]),
      },
    };
    mockJoinOrCreate.mockResolvedValue(mockRoom);

    const { connect } = await import('./room');
    await connect('http://test', {
      create: { classId: 0, sex: 0, accountName: 'acct', name: 'SecondHero' },
    });

    expect(mockJoinOrCreate).toHaveBeenCalledWith('town', {
      create: { classId: 0, sex: 0, accountName: 'acct', name: 'SecondHero' },
    });
  });

  it('joins without characterId when localStorage is empty', async () => {
    const mockRoom = {
      sessionId: 'local-session',
      onMessage: vi.fn(),
      state: {
        players: new Map(),
        mobs: new Map([['mob-1', {}]]),
      },
    };
    mockJoinOrCreate.mockResolvedValue(mockRoom);

    const { connect } = await import('./room');
    await connect('http://test');

    expect(mockJoinOrCreate).toHaveBeenCalledWith('town', {});
  });

  it('waitForRoomState resolves when local player appears on state change', async () => {
    const listeners: Array<() => void> = [];
    const mockRoom = {
      sessionId: 'sess-1',
      state: {} as { players?: Map<string, unknown> },
      onStateChange: Object.assign((cb: () => void) => listeners.push(cb), {
        remove: (cb: () => void) => {
          const idx = listeners.indexOf(cb);
          if (idx >= 0) listeners.splice(idx, 1);
        },
      }),
    };

    const { waitForRoomState } = await import('./room');
    const pending = waitForRoomState(mockRoom as never, 100);
    mockRoom.state.players = new Map([['sess-1', { classId: 0 }]]);
    listeners.forEach((cb) => cb());
    await expect(pending).resolves.toBeUndefined();
  });
});
