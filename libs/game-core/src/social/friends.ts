export const FRIENDS_MAX = 50;

export type FriendAddResult =
  | { ok: true }
  | { ok: false; error: string };

export function canAddFriend(
  currentCount: number,
  targetCharacterId: string,
  selfCharacterId: string,
  alreadyFriend: boolean
): FriendAddResult {
  if (targetCharacterId === selfCharacterId) {
    return { ok: false, error: 'self' };
  }
  if (alreadyFriend) {
    return { ok: false, error: 'duplicate' };
  }
  if (currentCount >= FRIENDS_MAX) {
    return { ok: false, error: 'cap_exceeded' };
  }
  return { ok: true };
}

export function canInvitePartyTarget(
  inviterSessionId: string,
  targetSessionId: string
): boolean {
  return inviterSessionId !== targetSessionId;
}
