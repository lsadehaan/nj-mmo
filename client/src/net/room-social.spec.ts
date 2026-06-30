import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initGameState,
  getGameState,
  appendChatLine,
  setParty,
  setTrade,
  setFriends,
} from '../test-hook';

const { mockCallbacksGet } = vi.hoisted(() => ({
  mockCallbacksGet: vi.fn(),
}));

vi.mock('@colyseus/sdk', () => ({
  Callbacks: {
    get: mockCallbacksGet,
  },
}));

import { wireRoom } from './room';
import type { GameRenderer } from '../scene/renderer';

describe('wireRoom social sync (unit)', () => {
  const messageHandlers = new Map<string, (payload: unknown) => void>();
  const mockRoom = {
    sessionId: 'local-1',
    send: vi.fn(),
    onMessage: (type: string, handler: (payload: unknown) => void) => {
      messageHandlers.set(type, handler);
    },
    state: {
      players: new Map([
        [
          'local-1',
          {
            x: 0,
            y: 0,
            z: 0,
            xp: 0,
            level: 1,
            hp: 100,
            mp: 50,
            maxHp: 100,
            maxMp: 50,
            adena: 1000,
            equippedWeaponItemId: 0,
            powerStrikeCooldownEndMs: 0,
            healingPotionCooldownEndMs: 0,
            items: { entries: () => [] },
            partyId: 1,
          },
        ],
      ]),
      parties: new Map([
        [
          '1',
          {
            leaderSessionId: 'local-1',
            memberSessionIds: ['local-1', 'remote-2'],
          },
        ],
      ]),
      mobs: new Map(),
      npcs: new Map(),
    },
  };

  const mockGame = {
    listRemotePlayers: () => [],
    getMobHookEntries: () => [],
    getNpcHookEntries: () => [],
    syncLocalPlayer: vi.fn(),
    setLocalPlayerName: vi.fn(),
    syncPlayerVfx: vi.fn(),
    getCurrentAnimationClip: () => 'idle' as const,
    setAfterTick: vi.fn(),
  } as unknown as GameRenderer;

  beforeEach(() => {
    initGameState();
    messageHandlers.clear();
    mockCallbacksGet.mockReturnValue({
      onAdd: vi.fn(),
      onChange: vi.fn(),
      onRemove: vi.fn(),
    });
    wireRoom(mockRoom as never, mockGame);
  });

  it('SOC26-08: chat broadcast appends to __GAME_STATE__.chat (max 20)', () => {
    const handler = messageHandlers.get('chat')!;
    for (let i = 0; i < 22; i++) {
      handler({
        channel: 'all',
        text: `m${i}`,
        senderSessionId: 's',
        senderName: 'A',
        timestampMs: i,
      });
    }
    expect(getGameState().chat).toHaveLength(20);
    expect(getGameState().chat[0]?.text).toBe('m2');
  });

  it('SOC26-16: partyId sync lists member session ids and leader', () => {
    setParty({
      partyId: 1,
      leaderSessionId: 'local-1',
      memberSessionIds: ['local-1', 'remote-2'],
    });
    expect(getGameState().party?.leaderSessionId).toBe('local-1');
    expect(getGameState().party?.memberSessionIds).toContain('remote-2');
  });

  it('SOC26-30: trade snapshot exposes offer and confirm flags', () => {
    setTrade({
      status: 'open',
      partnerSessionId: 'p-2',
      myOffer: { items: [{ itemId: 1835, count: 5 }], adena: 100 },
      partnerOffer: null,
      myConfirmed: true,
      partnerConfirmed: false,
    });
    expect(getGameState().trade?.myConfirmed).toBe(true);
    expect(getGameState().trade?.myOffer?.adena).toBe(100);
  });

  it('SOC26-36: friends list mirrors server snapshot', () => {
    const handler = messageHandlers.get('friendsList')!;
    handler({
      friends: [{ characterId: 'c-1', name: 'Adventurer', online: true }],
    });
    expect(getGameState().friends[0]?.online).toBe(true);
  });
});

describe('appendChatLine unit', () => {
  beforeEach(() => initGameState());

  it('retains at most 20 lines', () => {
    for (let i = 0; i < 25; i++) {
      appendChatLine({
        channel: 'all',
        text: `${i}`,
        senderSessionId: 's',
        senderName: 'n',
        timestampMs: i,
      });
    }
    expect(getGameState().chat).toHaveLength(20);
  });
});
