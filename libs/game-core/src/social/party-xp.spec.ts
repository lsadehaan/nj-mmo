import { describe, it, expect } from 'vitest';
import { calcPartyXpGrants } from './party-xp';

describe('calcPartyXpGrants (SOC26-17, SOC26-19)', () => {
  it('SOC26-17: two L1 members in range each receive 28 XP from Gremlin (44 exp)', () => {
    const grants = calcPartyXpGrants(
      44,
      [
        { sessionId: 'a', level: 1, inRange: true },
        { sessionId: 'b', level: 1, inRange: true },
      ],
      1
    );
    expect(grants.get('a')).toBe(28);
    expect(grants.get('b')).toBe(28);
  });

  it('SOC26-19: member >20 levels below highest receives 0 XP', () => {
    const grants = calcPartyXpGrants(
      44,
      [
        { sessionId: 'killer', level: 25, inRange: true },
        { sessionId: 'low', level: 4, inRange: true },
      ],
      25
    );
    expect(grants.get('low')).toBe(0);
    expect((grants.get('killer') ?? 0) > 0).toBe(true);
  });

  it('out-of-range member receives 0 XP', () => {
    const grants = calcPartyXpGrants(
      44,
      [
        { sessionId: 'a', level: 1, inRange: true },
        { sessionId: 'b', level: 1, inRange: false },
      ],
      1
    );
    expect(grants.get('b')).toBe(0);
  });
});
