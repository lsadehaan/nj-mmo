import type { AppDatabase } from '../db/client';
import {
  addFriend,
  loadFriends,
  removeFriend,
} from '../db/friends-repository';

export interface FriendListEntry {
  characterId: string;
  name: string;
  online: boolean;
}

export interface FriendHandlerDeps {
  db: AppDatabase;
  characterIds: Map<string, string>;
  sessionByCharacterId: Map<string, string>;
  connectedSessions: Set<string>;
  nowMs: () => number;
  sendTo: (sessionId: string, type: string, payload: unknown) => void;
}

function buildFriendList(deps: FriendHandlerDeps, sessionId: string): FriendListEntry[] {
  const characterId = deps.characterIds.get(sessionId);
  if (!characterId) return [];

  return loadFriends(deps.db, characterId).map((f) => ({
    characterId: f.characterId,
    name: f.name,
    online: deps.sessionByCharacterId.has(f.characterId) && deps.connectedSessions.has(
      deps.sessionByCharacterId.get(f.characterId)!
    ),
  }));
}

export function syncFriendsToPlayer(deps: FriendHandlerDeps, sessionId: string): void {
  deps.sendTo(sessionId, 'friendsList', { friends: buildFriendList(deps, sessionId) });
}

export function broadcastFriendsToWatchers(deps: FriendHandlerDeps, characterId: string): void {
  for (const [sessionId, cid] of deps.characterIds.entries()) {
    if (!deps.connectedSessions.has(sessionId)) continue;
    const list = buildFriendList(deps, sessionId);
    if (list.some((f) => f.characterId === characterId)) {
      deps.sendTo(sessionId, 'friendsList', { friends: list });
    }
  }
}

export function handleFriendAdd(
  deps: FriendHandlerDeps,
  sessionId: string,
  target: { targetSessionId?: string; targetCharacterId?: string }
): void {
  const selfCharacterId = deps.characterIds.get(sessionId);
  if (!selfCharacterId) return;

  let targetCharacterId = target.targetCharacterId;
  if (target.targetSessionId) {
    targetCharacterId = deps.characterIds.get(target.targetSessionId);
  }
  if (!targetCharacterId) return;

  const result = addFriend(deps.db, selfCharacterId, targetCharacterId, deps.nowMs());
  if (!result.ok) return;

  syncFriendsToPlayer(deps, sessionId);
  const targetSession = deps.sessionByCharacterId.get(targetCharacterId);
  if (targetSession) syncFriendsToPlayer(deps, targetSession);
}

export function handleFriendRemove(
  deps: FriendHandlerDeps,
  sessionId: string,
  friendCharacterId: string
): void {
  const selfCharacterId = deps.characterIds.get(sessionId);
  if (!selfCharacterId) return;

  removeFriend(deps.db, selfCharacterId, friendCharacterId);
  syncFriendsToPlayer(deps, sessionId);
  const targetSession = deps.sessionByCharacterId.get(friendCharacterId);
  if (targetSession) syncFriendsToPlayer(deps, targetSession);
}

export function registerCharacterSession(
  deps: FriendHandlerDeps,
  sessionId: string,
  characterId: string
): void {
  deps.sessionByCharacterId.set(characterId, sessionId);
  broadcastFriendsToWatchers(deps, characterId);
}

export function unregisterCharacterSession(
  deps: FriendHandlerDeps,
  sessionId: string,
  characterId: string
): void {
  const current = deps.sessionByCharacterId.get(characterId);
  if (current === sessionId) {
    deps.sessionByCharacterId.delete(characterId);
  }
  broadcastFriendsToWatchers(deps, characterId);
}
