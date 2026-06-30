import { describe, it, expect, vi } from 'vitest';
import { handleChat } from './chat-handler';
import type { PlayerState } from '../schema/TownState';

describe('handleChat party routing (SOC26-04)', () => {
  it('sendTo each party member when channel is party', () => {
    const leader = { partyId: 1, characterName: 'Leader', x: 0, z: 0 } as PlayerState;
    const sent: string[] = [];
    handleChat(
      {
        getPlayer: () => leader,
        forEachPlayer: () => undefined,
        chatRateBySession: new Map(),
        nowMs: () => 1000,
        broadcastAll: vi.fn(),
        sendTo: (sessionId) => sent.push(sessionId),
        getPartyMemberSessionIds: () => ['leader-s', 'member-s'],
      },
      'leader-s',
      { channel: 'party', text: 'hello party' }
    );
    expect(sent).toEqual(['leader-s', 'member-s']);
  });
});
