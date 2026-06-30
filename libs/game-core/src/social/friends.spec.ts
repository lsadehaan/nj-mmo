import { describe, it, expect } from 'vitest';
import { canAddFriend, FRIENDS_MAX, canInvitePartyTarget } from './friends';

describe('canAddFriend (SOC26-33, SOC26-34, SOC26-41)', () => {
  it('SOC26-41: rejects self', () => {
    const result = canAddFriend(0, 'same-id', 'same-id', false);
    expect(result.ok).toBe(false);
  });

  it('SOC26-34: rejects duplicate friend', () => {
    const result = canAddFriend(1, 'friend-id', 'self-id', true);
    expect(result.ok).toBe(false);
  });

  it('SOC26-33: rejects when at cap', () => {
    const result = canAddFriend(FRIENDS_MAX, 'friend-id', 'self-id', false);
    expect(result.ok).toBe(false);
  });
});

describe('canInvitePartyTarget (SOC26-38)', () => {
  it('rejects self-invite', () => {
    expect(canInvitePartyTarget('sess-a', 'sess-a')).toBe(false);
  });

  it('allows invite to other session', () => {
    expect(canInvitePartyTarget('sess-a', 'sess-b')).toBe(true);
  });
});
