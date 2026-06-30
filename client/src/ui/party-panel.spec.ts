import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { wirePartyPanel } from './party-panel';

describe('party-panel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('invite button sends partyInvite', () => {
    const sendPartyInvite = vi.fn();
    wirePartyPanel({ sendPartyInvite, sendPartyLeave: vi.fn() });
    const input = document.querySelector('[data-role="invite-target"]') as HTMLInputElement;
    input.value = 'sess-b';
    (document.querySelector('[data-role="invite"]') as HTMLButtonElement).click();
    expect(sendPartyInvite).toHaveBeenCalledWith({ targetSessionId: 'sess-b' });
  });
});
