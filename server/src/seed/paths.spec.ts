import { describe, it, expect } from 'vitest';
import { TI_MOB_IDS, TI_NPC_IDS } from './paths';

describe('TI_NPC_IDS', () => {
  it('contains 25 sorted Talking Island town npcIds (TOWN24-01)', () => {
    expect(TI_NPC_IDS).toHaveLength(25);
    expect(TI_NPC_IDS).toContain(30031);
    expect(TI_NPC_IDS).toContain(30041);
    for (let i = 1; i < TI_NPC_IDS.length; i++) {
      expect(TI_NPC_IDS[i]).toBeGreaterThan(TI_NPC_IDS[i - 1]!);
    }
  });
});

describe('TI_MOB_IDS', () => {
  it('contains exactly 23 Talking Island mob npcIds (BEST22-01)', () => {
    expect(TI_MOB_IDS).toHaveLength(23);
    expect([...TI_MOB_IDS]).toEqual([
      20001, 20481, 20120, 20003,
      20432, 20544, 20442, 20121, 20130,
      20131, 20006, 20326, 20132, 20343, 20093, 20096, 20098, 20342,
      20016, 20101, 20103, 20106, 20108,
    ]);
  });
});
