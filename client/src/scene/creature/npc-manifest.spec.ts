import { describe, it, expect } from 'vitest';
import {
  getNpcEntry,
  KATERINA_CLIP_MAP,
  KAYKIT_NPC_CLIP_MAP,
  ROXXY_CLIP_MAP,
  WILFORD_CLIP_MAP,
  TI_NPC_MANIFEST_IDS,
  FOLK_TRAINER_NPC_IDS,
  TRAINER_NPC_IDS,
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

  it('returns entries for five new TI NPC ids (TINPC-15)', () => {
    for (const npcId of [30001, 30002, 30003, 30005, 30026]) {
      const entry = getNpcEntry(npcId);
      expect(entry).not.toBeNull();
      expect(entry?.model).toMatch(/^\/models\/npcs\/.+\.glb$/);
      expect(entry?.displayName.length).toBeGreaterThan(0);
      expect(entry?.scale).toBeGreaterThan(0);
    }
  });

  it('uses unique model paths for 26 TI NPCs with guard variant groups (TOWN24-12)', () => {
    const paths = TI_NPC_MANIFEST_IDS.map((id) => getNpcEntry(id)?.model);
    const unique = new Set(paths);
    expect(unique.size).toBeGreaterThanOrEqual(18);
    expect(TI_NPC_MANIFEST_IDS).toHaveLength(26);
  });

  it('maps vocabulary keys to real track names for all manifest clip maps (TINPC-18)', () => {
    const maps = [
      KATERINA_CLIP_MAP,
      KAYKIT_NPC_CLIP_MAP,
      ROXXY_CLIP_MAP,
      WILFORD_CLIP_MAP,
    ];
    for (const map of maps) {
      expect(Object.keys(map).sort()).toEqual(
        ['attack', 'cast', 'die', 'idle', 'move'].sort()
      );
      for (const track of Object.values(map)) {
        expect(track.length).toBeGreaterThan(0);
      }
    }
    expect(KATERINA_CLIP_MAP.idle).toBe(KAYKIT_CLIP_MAP.idle);
    expect(KATERINA_CLIP_MAP.cast).toBe('Interact');
    expect(ROXXY_CLIP_MAP.idle).toBe('CharacterArmature|Idle');
    expect(ROXXY_CLIP_MAP.cast).toBe('CharacterArmature|Interact');
  });

  it('returns Pinter blacksmith entry (ITEM25-15)', () => {
    expect(getNpcEntry(30298)?.displayName).toBe('Pinter');
  });

  it('returns null for unknown npcId', () => {
    expect(getNpcEntry(99999)).toBeNull();
  });

  it('TRAINER_NPC_IDS includes folk 30027–30036 except Biotin plus Bitz (TOWN24-17)', () => {
    const expectedFolk = [
      30027, 30028, 30029, 30030, 30032, 30033, 30034, 30035, 30036,
    ];
    expect(FOLK_TRAINER_NPC_IDS).toEqual(expectedFolk);
    expect(TRAINER_NPC_IDS).toEqual([30026, ...expectedFolk]);
    expect(TRAINER_NPC_IDS).not.toContain(30031);
    expect(TRAINER_NPC_IDS).toHaveLength(10);
  });
});
