import { describe, it, expect } from 'vitest';
import { getPlayerManifestEntry, PLAYER_MANIFEST } from './player-manifest';

describe('player-manifest', () => {
  it('CHAR19-27: classId 0 maps to Knight.glb', () => {
    expect(getPlayerManifestEntry(0).model).toBe('/models/characters/Knight.glb');
  });

  it('CHAR19-28: classId 10 maps to Mage.glb', () => {
    expect(getPlayerManifestEntry(10).model).toBe('/models/characters/Mage.glb');
  });

  it('CHAR19-29: classId 31 maps to Rogue_Hooded.glb', () => {
    expect(getPlayerManifestEntry(31).model).toBe('/models/characters/Rogue_Hooded.glb');
  });

  it('CHAR19-30: classId 44 maps to Barbarian.glb', () => {
    expect(getPlayerManifestEntry(44).model).toBe('/models/characters/Barbarian.glb');
  });

  it('CHAR19-31: nine starter classes each map to explicit manifest models', () => {
    expect(PLAYER_MANIFEST).toHaveLength(9);
    for (const entry of PLAYER_MANIFEST) {
      expect(getPlayerManifestEntry(entry.classId).model).toBe(entry.model);
    }
    const models = PLAYER_MANIFEST.map((entry) => entry.model);
    expect(new Set(models).size).toBeGreaterThanOrEqual(5);
  });
});
