import { describe, it, expect } from 'vitest';
import { canNpcInteract } from './npc-interact';

describe('npc-interact', () => {
  it('rejects Guard type interaction (TOWN24-15 server rule)', () => {
    expect(
      canNpcInteract({ playerX: 0, playerZ: 0 }, { npcX: 0, npcZ: 0 }, 'Guard')
    ).toBe(false);
  });

  it('allows Folk within radius', () => {
    expect(
      canNpcInteract({ playerX: 0, playerZ: 0 }, { npcX: 2, npcZ: 0 }, 'Folk')
    ).toBe(true);
  });
});
