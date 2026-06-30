import { describe, it, expect } from 'vitest';
import {
  calcInventoryWeight,
  calcMaxLoad,
  countInventorySlots,
} from './inventory-weight';

describe('inventory-weight', () => {
  const weights: Record<number, number> = {
    2369: 1600,
    1060: 5,
    57: 0,
  };

  it('UI28-22: Squire\'s Sword ×1 weighs 1600', () => {
    expect(calcInventoryWeight({ 2369: 1 }, weights)).toBe(1600);
  });

  it('UI28-22: potion stacks add correctly', () => {
    expect(calcInventoryWeight({ 1060: 10 }, weights)).toBe(50);
  });

  it('UI28-22: CON 43 → maxLoad 2967', () => {
    expect(calcMaxLoad(43)).toBe(2967);
  });

  it('counts unique stack rows', () => {
    expect(countInventorySlots({ 1060: 3, 2369: 1 })).toBe(2);
    expect(countInventorySlots({ 1060: 0 })).toBe(0);
  });
});
