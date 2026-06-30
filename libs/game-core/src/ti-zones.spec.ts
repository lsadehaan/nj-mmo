import { describe, it, expect } from 'vitest';
import { getZoneAt, isWaterZone, listTiZones, HARBOR_WATER_SAMPLE } from './ti-zones';

describe('ti-zones', () => {
  it('returns ti_village peace at origin (TIW23-07)', () => {
    const hit = getZoneAt(0, 0);
    expect(hit.zoneId).toBe('ti_village');
    expect(hit.type).toBe('peace');
  });

  it('returns obelisk combat at anchor (TIW23-08)', () => {
    const hit = getZoneAt(-10, -120);
    expect(hit.zoneId).toBe('obelisk');
    expect(hit.type).toBe('combat');
  });

  it('returns elven_ruins at anchor (TIW23-09)', () => {
    expect(getZoneAt(-250, 0).zoneId).toBe('elven_ruins');
  });

  it('returns harbor at anchor (TIW23-10)', () => {
    expect(getZoneAt(-224, 287).zoneId).toBe('harbor');
  });

  it('returns cave_of_souls at anchor (TIW23-11)', () => {
    expect(getZoneAt(0, 240).zoneId).toBe('cave_of_souls');
  });

  it('returns eastern_fields combat at anchor (TIW23-12)', () => {
    const hit = getZoneAt(110, 0);
    expect(hit.zoneId).toBe('eastern_fields');
    expect(hit.type).toBe('combat');
  });

  it('returns valid zone metadata for polygon interior samples (TIW23-13)', () => {
    for (const zone of listTiZones()) {
      if (zone.id === 'harbor_water') continue;
      const cx =
        zone.polygon.reduce((s, p) => s + p.x, 0) / zone.polygon.length;
      const cz =
        zone.polygon.reduce((s, p) => s + p.z, 0) / zone.polygon.length;
      const hit = getZoneAt(cx, cz);
      expect(hit.zoneId.length).toBeGreaterThan(0);
      expect(['peace', 'combat', 'fishing', 'water']).toContain(hit.type);
    }
  });

  it('returns wilderness combat outside polygons (TIW23-14)', () => {
    const hit = getZoneAt(250, 250);
    expect(hit.zoneId).toBe('wilderness');
    expect(hit.type).toBe('combat');
  });

  it('prefers smallest-area zone on overlap', () => {
    const hit = getZoneAt(HARBOR_WATER_SAMPLE.x, HARBOR_WATER_SAMPLE.z);
    expect(hit.type).toBe('water');
    expect(hit.zoneId).toBe('harbor');
  });

  it('isWaterZone is true on harbour water sample (TIW23-16)', () => {
    expect(isWaterZone(HARBOR_WATER_SAMPLE.x, HARBOR_WATER_SAMPLE.z)).toBe(true);
    expect(isWaterZone(0, 0)).toBe(false);
  });
});
