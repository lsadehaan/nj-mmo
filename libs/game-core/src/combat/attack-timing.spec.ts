import { describe, it, expect } from 'vitest';
import { calculateAttackIntervalMs } from './attack-timing';

describe('calculateAttackIntervalMs', () => {
  it('returns 1666 ms for attack speed 300', () => {
    expect(calculateAttackIntervalMs(300)).toBe(1666);
  });

  it('floors the division result per L2J integer math', () => {
    expect(calculateAttackIntervalMs(253)).toBe(1976);
  });

  it('enforces a 50 ms minimum interval', () => {
    expect(calculateAttackIntervalMs(100_000)).toBe(50);
  });
});
