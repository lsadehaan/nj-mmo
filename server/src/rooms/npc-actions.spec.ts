import { describe, it, expect } from 'vitest';
import { canInteract, applyHeal, applyStarterKit } from './npc-actions';

describe('npc-actions', () => {
  it('allows interaction at exactly 3.0 m and rejects at 3.1 m', () => {
    expect(
      canInteract({ playerX: -6, playerZ: -8 }, { npcX: -6, npcZ: -5 })
    ).toBe(true);
    expect(
      canInteract({ playerX: -6, playerZ: -8 }, { npcX: -6, npcZ: -4.9 })
    ).toBe(false);
  });

  it('applyHeal restores hp to maxHp', () => {
    const result = applyHeal({ hp: 40, maxHp: 80 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hp).toBe(80);
    }
  });

  it('applyStarterKit grants 3× item 1060 on first call', () => {
    const result = applyStarterKit({
      starterKitGranted: false,
      itemCounts: {},
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.starterKitGranted).toBe(true);
      expect(result.itemCounts[1060]).toBe(3);
    }
  });

  it('applyStarterKit grants 1× Squire\'s Sword (2369) with potions', () => {
    const result = applyStarterKit({
      starterKitGranted: false,
      itemCounts: {},
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.itemCounts[1060]).toBe(3);
      expect(result.itemCounts[2369]).toBe(1);
    }
  });

  it('applyStarterKit does not grant sword again when already granted', () => {
    const result = applyStarterKit({
      starterKitGranted: true,
      itemCounts: { 1060: 3, 2369: 1 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.itemCounts[1060]).toBe(3);
      expect(result.itemCounts[2369]).toBe(1);
    }
  });

  it('applyStarterKit is a no-op when already granted', () => {
    const result = applyStarterKit({
      starterKitGranted: true,
      itemCounts: { 1060: 5 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.starterKitGranted).toBe(true);
      expect(result.itemCounts[1060]).toBe(5);
    }
  });

  it('applyStarterKit adds to existing potion count and grants sword', () => {
    const result = applyStarterKit({
      starterKitGranted: false,
      itemCounts: { 1060: 1 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.itemCounts[1060]).toBe(4);
      expect(result.itemCounts[2369]).toBe(1);
    }
  });
});
