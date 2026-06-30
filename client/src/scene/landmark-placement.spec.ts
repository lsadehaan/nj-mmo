import { describe, it, expect } from 'vitest';
import { listLandmarkEntries } from './landmark-manifest';

const DESIGN_ANCHORS: Record<string, { x: number; z: number }> = {
  Obelisk: { x: -155, z: 58 },
  ElvenRuins: { x: -281, z: 87 },
  RuinsArch: { x: -270, z: 90 },
  HarborDock: { x: -224, z: 287 },
  CaveEntrance: { x: -242, z: 254 },
  FieldShrine: { x: -110, z: 29 },
};

describe('landmark placement', () => {
  it('lists six canonical landmarks (TIW23-36)', () => {
    const names = listLandmarkEntries().map((e) => e.name);
    expect(names).toEqual([
      'Obelisk',
      'ElvenRuins',
      'RuinsArch',
      'HarborDock',
      'CaveEntrance',
      'FieldShrine',
    ]);
  });

  it('places each anchor within 15 m of design doc (TIW23-37)', () => {
    for (const entry of listLandmarkEntries()) {
      const anchor = DESIGN_ANCHORS[entry.name];
      const dist = Math.hypot(entry.x - anchor.x, entry.z - anchor.z);
      expect(dist).toBeLessThan(15);
    }
  });
});
