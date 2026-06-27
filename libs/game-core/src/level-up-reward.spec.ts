import { describe, it, expect } from 'vitest';
import { applyLevelUpReward } from './level-up-reward';
import { resolvePlayerDeath } from './player-death';
import { SPAWN_X, SPAWN_Y, SPAWN_Z } from './world-constants';

describe('applyLevelUpReward', () => {
  it('raises max vitals and fully restores on level 1→2', () => {
    const result = applyLevelUpReward(1, 2, {
      maxHp: 100,
      maxMp: 50,
      hp: 40,
      mp: 20,
    });
    expect(result).toEqual({ maxHp: 112, maxMp: 55, hp: 112, mp: 55 });
  });

  it('applies +12 maxHp and +5 maxMp per level gained', () => {
    const result = applyLevelUpReward(1, 3, {
      maxHp: 100,
      maxMp: 50,
      hp: 30,
      mp: 10,
    });
    expect(result).toEqual({ maxHp: 124, maxMp: 60, hp: 124, mp: 60 });
  });

  it('returns unchanged vitals when level does not increase', () => {
    const vitals = { maxHp: 100, maxMp: 50, hp: 40, mp: 20 };
    expect(applyLevelUpReward(2, 2, vitals)).toEqual(vitals);
  });
});

describe('resolvePlayerDeath', () => {
  it('keeps xp unchanged for newbie levels 1–9', () => {
    const result = resolvePlayerDeath({ level: 1, xp: 44, maxHp: 100, maxMp: 50 });
    expect(result.xp).toBe(44);
  });

  it('teleports to town spawn coordinates', () => {
    const result = resolvePlayerDeath({ level: 1, xp: 0, maxHp: 100, maxMp: 50 });
    expect(result.x).toBe(SPAWN_X);
    expect(result.y).toBe(SPAWN_Y);
    expect(result.z).toBe(SPAWN_Z);
  });

  it('restores hp and mp to max on respawn', () => {
    const result = resolvePlayerDeath({ level: 2, xp: 88, maxHp: 112, maxMp: 55 });
    expect(result.hp).toBe(112);
    expect(result.mp).toBe(55);
  });
});
