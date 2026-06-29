import { describe, it, expect } from 'vitest';
import { TI_NPC_IDS } from './paths';

describe('TI_NPC_IDS', () => {
  it('exports seven sorted Talking Island NPC ids (TINPC-01)', () => {
    expect([...TI_NPC_IDS]).toEqual([
      30001, 30002, 30003, 30004, 30005, 30006, 30026,
    ]);
  });
});
