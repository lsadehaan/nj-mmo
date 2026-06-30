import {
  validateChatMessage,
  createChatRateState,
  isInChatRange,
  type ChatChannel,
  type ChatRateState,
} from '@nj/game-core';
import type { PlayerState } from '../schema/TownState';

export interface ChatBroadcastPayload {
  channel: ChatChannel;
  text: string;
  senderSessionId: string;
  senderName: string;
  timestampMs: number;
}

export interface ChatHandlerDeps {
  getPlayer: (sessionId: string) => PlayerState | undefined;
  forEachPlayer: (fn: (sessionId: string, player: PlayerState) => void) => void;
  chatRateBySession: Map<string, ChatRateState>;
  nowMs: () => number;
  broadcastAll: (payload: ChatBroadcastPayload) => void;
  sendTo: (sessionId: string, payload: ChatBroadcastPayload) => void;
  getPartyMemberSessionIds: (partyId: number) => string[];
}

export function handleChat(
  deps: ChatHandlerDeps,
  sessionId: string,
  message: { channel: string; text: string }
): void {
  const player = deps.getPlayer(sessionId);
  if (!player) return;

  let rateState = deps.chatRateBySession.get(sessionId);
  if (!rateState) {
    rateState = createChatRateState();
    deps.chatRateBySession.set(sessionId, rateState);
  }

  const validated = validateChatMessage(message, rateState, deps.nowMs());
  if (!validated.ok) return;

  const payload: ChatBroadcastPayload = {
    channel: validated.channel,
    text: validated.text,
    senderSessionId: sessionId,
    senderName: player.characterName,
    timestampMs: deps.nowMs(),
  };

  switch (validated.channel) {
    case 'all':
    case 'trade':
      deps.broadcastAll(payload);
      break;
    case 'party': {
      if (player.partyId === 0) return;
      const senderPartyId = player.partyId;
      const targets = new Set(deps.getPartyMemberSessionIds(senderPartyId));
      deps.forEachPlayer((memberId, member) => {
        if (member.partyId === senderPartyId) targets.add(memberId);
      });
      for (const memberId of targets) {
        deps.sendTo(memberId, payload);
      }
      break;
    }
    case 'local':
      deps.sendTo(sessionId, payload);
      deps.forEachPlayer((otherId, other) => {
        if (otherId === sessionId) return;
        if (isInChatRange(player.x, player.z, other.x, other.z)) {
          deps.sendTo(otherId, payload);
        }
      });
      break;
  }
}

export { createChatRateState, type ChatRateState };
