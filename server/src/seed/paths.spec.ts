import { describe, it, expect } from 'vitest';
import { TI_MOB_IDS } from './paths';

describe('TI_MOB_IDS', () => {
  it('contains exactly nine Talking Island mob npcIds in roster order', () => {
    expect([...TI_MOB_IDS]).toEqual([
      20001, 20481, 20120, 20003,
      20432, 20544, 20442, 20121, 20130,
    ]);
  });
});
