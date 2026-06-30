import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderPartyPanel, wirePartyPanel } from './party-panel';

describe('party-panel frames', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('UI28-35: renders member frames', () => {
    renderPartyPanel([
      { sessionId: 'a', name: 'A', hp: 100, maxHp: 100, mp: 50, maxMp: 50, isLeader: true },
      { sessionId: 'b', name: 'B', hp: 40, maxHp: 100, mp: 20, maxMp: 50, isLeader: false },
    ]);
    expect(document.querySelectorAll('[data-role="party-member"]').length).toBe(2);
  });

  it('UI28-36: HP fill at 40%', () => {
    renderPartyPanel([
      { sessionId: 'b', name: 'B', hp: 40, maxHp: 100, mp: 20, maxMp: 50, isLeader: false },
    ]);
    const fill = document.querySelector('[data-role="party-hp-fill"]') as HTMLElement;
    expect(parseFloat(fill.style.width)).toBeCloseTo(40, 0);
  });

  it('UI28-37: leader badge', () => {
    renderPartyPanel([
      { sessionId: 'a', name: 'A', hp: 100, maxHp: 100, mp: 50, maxMp: 50, isLeader: true },
    ]);
    expect(document.querySelector('[data-party-leader="true"]')).not.toBeNull();
  });

  it('UI28-39: no invite-target input', () => {
    wirePartyPanel({ sendPartyInvite: vi.fn(), sendPartyLeave: vi.fn() });
    expect(document.querySelector('[data-role="invite-target"]')).toBeNull();
  });

  it('UI28-40: leave fires handler', () => {
    const sendPartyLeave = vi.fn();
    wirePartyPanel({ sendPartyInvite: vi.fn(), sendPartyLeave });
    (document.querySelector('[data-role="leave"]') as HTMLButtonElement).click();
    expect(sendPartyLeave).toHaveBeenCalled();
  });
});
