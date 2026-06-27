import { describe, it, expect } from 'vitest';
import { PlayerState } from './TownState';

describe('PlayerState progression fields', () => {
  it('defaults max vitals and no equipped weapon (0 sentinel)', () => {
    const player = new PlayerState();
    expect(player.maxHp).toBe(100);
    expect(player.maxMp).toBe(50);
    expect(player.equippedWeaponItemId).toBe(0);
  });

  it('accepts equipped weapon id and max vitals from character row', () => {
    const player = new PlayerState();
    player.maxHp = 112;
    player.maxMp = 55;
    player.equippedWeaponItemId = 2369;
    expect(player.maxHp).toBe(112);
    expect(player.maxMp).toBe(55);
    expect(player.equippedWeaponItemId).toBe(2369);
  });
});
