export const AUDIO_SETTINGS_KEY = 'nj.audioSettings';

export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  musicVolume: 0.7,
  sfxVolume: 0.8,
  muted: false,
};

export function loadAudioSettings(): AudioSettings {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
  const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      musicVolume:
        typeof parsed.musicVolume === 'number'
          ? parsed.musicVolume
          : DEFAULT_AUDIO_SETTINGS.musicVolume,
      sfxVolume:
        typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : DEFAULT_AUDIO_SETTINGS.sfxVolume,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_AUDIO_SETTINGS.muted,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
}
