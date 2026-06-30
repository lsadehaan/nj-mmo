import { describe, it, expect } from 'vitest';
import { calcPartySpGrants, canAffordSkill, grantSp } from './skill-points';

describe('skill-points (PROG27-20)', () => {
  it('PROG27-20: party SP split mirrors XP bonus table', () => {
    const members = [
      { sessionId: 'a', level: 1, inRange: true },
      { sessionId: 'b', level: 1, inRange: true },
    ];
    const grants = calcPartySpGrants(7, members, 1);
    expect(grants.get('a')).toBe(4);
    expect(grants.get('b')).toBe(4);
  });

  it('grantSp adds mob SP', () => {
    expect(grantSp(0, 7)).toBe(7);
  });

  it('canAffordSkill checks SP threshold', () => {
    expect(canAffordSkill(50, 100)).toBe(false);
    expect(canAffordSkill(100, 50)).toBe(true);
  });
});
