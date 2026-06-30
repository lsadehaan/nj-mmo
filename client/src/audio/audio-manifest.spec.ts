import { describe, it, expect } from 'vitest';
import { resolveZoneAmbient, resolveZoneMusic } from './zone-music';
import { AUDIO_MANIFEST, getAudioUrl } from './audio-manifest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

describe('zone-music', () => {
  it('AUD29-09: ti_village maps to music_town', () => {
    expect(resolveZoneMusic('ti_village')).toBe('music_town');
  });

  it('AUD29-10: eastern_fields maps to music_field', () => {
    expect(resolveZoneMusic('eastern_fields')).toBe('music_field');
  });

  it('AUD29-11: harbor maps to music_harbor', () => {
    expect(resolveZoneMusic('harbor')).toBe('music_harbor');
  });

  it('AUD29-12: harbor_water maps to music_harbor', () => {
    expect(resolveZoneMusic('harbor_water')).toBe('music_harbor');
  });

  it('AUD29-16: wilderness maps to music_field', () => {
    expect(resolveZoneMusic('wilderness')).toBe('music_field');
  });

  it('AUD29-35: ti_village ambient is ambient_village', () => {
    expect(resolveZoneAmbient('ti_village')).toBe('ambient_village');
  });

  it('AUD29-36: harbor zones use ambient_waves', () => {
    expect(resolveZoneAmbient('harbor')).toBe('ambient_waves');
    expect(resolveZoneAmbient('harbor_water')).toBe('ambient_waves');
  });

  it('AUD29-37: field zones use ambient_wind', () => {
    for (const zone of ['eastern_fields', 'elven_ruins', 'obelisk', 'cave_of_souls']) {
      expect(resolveZoneAmbient(zone)).toBe('ambient_wind');
    }
  });
});

describe('audio-manifest', () => {
  it('AUD29-44: manifest ids use /audio/ public paths', () => {
    for (const [id, entry] of Object.entries(AUDIO_MANIFEST)) {
      expect(entry.url.startsWith('/audio/')).toBe(true);
      expect(getAudioUrl(id as keyof typeof AUDIO_MANIFEST)).toBe(entry.url);
    }
  });

  it('AUD29-47: every manifest id has a file on disk', () => {
    const publicRoot = join(import.meta.dirname, '../../public');
    for (const entry of Object.values(AUDIO_MANIFEST)) {
      const path = join(publicRoot, entry.url.replace(/^\//, ''));
      expect(existsSync(path), `missing asset ${entry.url}`).toBe(true);
    }
  });
});
