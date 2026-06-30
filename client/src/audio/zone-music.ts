import type { AudioClipId } from './audio-manifest';

const FIELD_ZONES = new Set([
  'eastern_fields',
  'elven_ruins',
  'obelisk',
  'cave_of_souls',
  'wilderness',
]);

const HARBOR_ZONES = new Set(['harbor', 'harbor_water']);

const WIND_AMBIENT_ZONES = new Set([
  'eastern_fields',
  'elven_ruins',
  'obelisk',
  'cave_of_souls',
]);

export function resolveZoneMusic(zoneId: string): AudioClipId {
  if (zoneId === 'ti_village') return 'music_town';
  if (HARBOR_ZONES.has(zoneId)) return 'music_harbor';
  if (FIELD_ZONES.has(zoneId)) return 'music_field';
  return 'music_field';
}

export function resolveZoneAmbient(zoneId: string): AudioClipId | null {
  if (zoneId === 'ti_village') return 'ambient_village';
  if (HARBOR_ZONES.has(zoneId)) return 'ambient_waves';
  if (WIND_AMBIENT_ZONES.has(zoneId)) return 'ambient_wind';
  return null;
}
