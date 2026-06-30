import { describe, it, expect } from 'vitest';
import {
  applyTogglePvp,
  applyKarmaRelief,
  applyPkKarma,
  canAttackPlayer,
  tickPvpFlag,
  PVP_NORMAL_TIME_MS,
} from './pvp-rules';

describe('pvp-rules (PROG27-34, PROG27-35)', () => {
  it('PROG27-34: karma relief from mob XP', () => {
    expect(applyKarmaRelief(-720, 3000)).toBe(-710);
    expect(applyKarmaRelief(0, 3000)).toBe(0);
  });

  it('PROG27-35: peace zone rejects toggle', () => {
    const result = applyTogglePvp(1000, true);
    expect(result.ok).toBe(false);
    expect(result.pvpFlag).toBe(0);
  });

  it('toggle sets flag for 120s', () => {
    const result = applyTogglePvp(5000, false);
    expect(result.ok).toBe(true);
    expect(result.pvpFlag).toBe(1);
    expect(result.pvpFlagEndMs).toBe(5000 + PVP_NORMAL_TIME_MS);
  });

  it('tick clears expired flag', () => {
    expect(tickPvpFlag(120001, 1, 120000)).toBe(0);
    expect(tickPvpFlag(119999, 1, 120000)).toBe(1);
  });

  it('applyPkKarma decreases by 720', () => {
    expect(applyPkKarma(0)).toBe(-720);
  });

  it('canAttackPlayer rules', () => {
    expect(
      canAttackPlayer(
        { pvpFlag: 0, karma: 0 },
        { pvpFlag: 1, karma: 0, alive: true },
        false
      )
    ).toBe(true);
    expect(
      canAttackPlayer(
        { pvpFlag: 0, karma: 0 },
        { pvpFlag: 0, karma: 0, alive: true },
        false
      )
    ).toBe(false);
    expect(
      canAttackPlayer(
        { pvpFlag: 0, karma: -100 },
        { pvpFlag: 0, karma: 0, alive: true },
        false
      )
    ).toBe(true);
    expect(
      canAttackPlayer(
        { pvpFlag: 1, karma: 0 },
        { pvpFlag: 0, karma: 0, alive: true },
        true
      )
    ).toBe(false);
  });
});
