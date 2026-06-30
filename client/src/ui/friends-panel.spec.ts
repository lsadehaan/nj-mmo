import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { wireFriendsPanel } from './friends-panel';

describe('friends-panel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('add friend sends friendAdd', () => {
    const sendFriendAdd = vi.fn();
    wireFriendsPanel({ sendFriendAdd, sendFriendRemove: vi.fn() });
    const input = document.querySelector('[data-role="add-target"]') as HTMLInputElement;
    input.value = 'sess-x';
    (document.querySelector('[data-role="add"]') as HTMLButtonElement).click();
    expect(sendFriendAdd).toHaveBeenCalledWith({ targetSessionId: 'sess-x' });
  });
});
