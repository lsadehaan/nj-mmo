import { describe, it, expect } from 'vitest';
import { resolvePlayerVsPlayerAttack } from './pvp-combat';

describe('resolvePlayerVsPlayerAttack (PROG27-37, PROG27-38)', () => {
  const attackerStats = { pAtk: 50, randomDamage: 10 };

  it('PROG27-37: flagged target outside peace zone takes damage', () => {
    const result = resolvePlayerVsPlayerAttack({
      attacker: { pvpFlag: 0, karma: 0, ...attackerStats },
      target: { pvpFlag: 1, karma: 0, pDef: 50, alive: true },
      zonePeace: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
  });

  it('PROG27-38: innocent without chaotic deals 0 damage', () => {
    const result = resolvePlayerVsPlayerAttack({
      attacker: { pvpFlag: 0, karma: 0, ...attackerStats },
      target: { pvpFlag: 0, karma: 0, pDef: 50, alive: true },
      zonePeace: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.damage).toBe(0);
  });
});
