import { describe, it, expect } from 'vitest';
import { TI_ITEM_IDS } from './paths';

describe('TI_ITEM_IDS', () => {
  it('has at least 75 TI economy items including anchors (ITEM25-02)', () => {
    expect(TI_ITEM_IDS.length).toBeGreaterThanOrEqual(75);
    expect(TI_ITEM_IDS).toContain(3);
    expect(TI_ITEM_IDS).toContain(23);
    expect(TI_ITEM_IDS).toContain(1786);
    expect(TI_ITEM_IDS).toContain(955);
    expect(TI_ITEM_IDS).toContain(956);
  });
});
