import { describe, it, expect, beforeEach } from 'vitest';
import {
  AUDIO_SETTINGS_KEY,
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  saveAudioSettings,
} from './audio-settings';

describe('audio-settings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('AUD29-34: defaults when key absent', () => {
    expect(loadAudioSettings()).toEqual({
      musicVolume: 0.7,
      sfxVolume: 0.8,
      muted: false,
    });
    expect(loadAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('AUD29-33: save persists musicVolume, sfxVolume, muted', () => {
    saveAudioSettings({ musicVolume: 0.5, sfxVolume: 0.4, muted: true });
    const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual({
      musicVolume: 0.5,
      sfxVolume: 0.4,
      muted: true,
    });
    expect(loadAudioSettings()).toEqual({
      musicVolume: 0.5,
      sfxVolume: 0.4,
      muted: true,
    });
  });
});
