import { describe, it, expect } from 'vitest';
import {
  getNpcEntry,
  KATERINA_CLIP_MAP,
  ROXXY_CLIP_MAP,
} from './npc-manifest';
import { KAYKIT_CLIP_MAP } from './mesh-character';

describe('npc-manifest', () => {
  it('returns Katerina entry with Mage model and display name', () => {
    const entry = getNpcEntry(30004);
    expect(entry).not.toBeNull();
    expect(entry?.displayName).toBe('Katerina');
    expect(entry?.model).toBe('/models/characters/Mage.glb');
    expect(entry?.clipMap).toBe(KATERINA_CLIP_MAP);
    expect(entry?.scale).toBeGreaterThan(0);
    expect(entry?.feetOffsetY).toBeGreaterThanOrEqual(0);
  });

  it('returns Roxxy entry with npc model path and display name', () => {
    const entry = getNpcEntry(30006);
    expect(entry).not.toBeNull();
    expect(entry?.displayName).toBe('Roxxy');
    expect(entry?.model).toBe('/models/npcs/Roxxy.glb');
    expect(entry?.clipMap).toBe(ROXXY_CLIP_MAP);
    expect(entry?.scale).toBeGreaterThan(0);
    expect(entry?.feetOffsetY).toBeGreaterThanOrEqual(0);
  });

  it('returns null for unknown npcId', () => {
    expect(getNpcEntry(99999)).toBeNull();
  });

  it('maps vocabulary keys to real KayKit and Quaternius track names', () => {
    expect(KATERINA_CLIP_MAP.idle).toBe(KAYKIT_CLIP_MAP.idle);
    expect(KATERINA_CLIP_MAP.cast).toBe('Interact');
    expect(ROXXY_CLIP_MAP.idle).toBe('CharacterArmature|Idle');
    expect(ROXXY_CLIP_MAP.cast).toBe('CharacterArmature|Interact');
    for (const map of [KATERINA_CLIP_MAP, ROXXY_CLIP_MAP]) {
      expect(Object.keys(map).sort()).toEqual(
        ['attack', 'cast', 'die', 'idle', 'move'].sort()
      );
    }
  });
});
