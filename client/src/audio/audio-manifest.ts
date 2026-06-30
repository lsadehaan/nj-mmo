export type AudioClipId =
  | 'music_town'
  | 'music_field'
  | 'music_harbor'
  | 'ambient_village'
  | 'ambient_wind'
  | 'ambient_waves'
  | 'sfx_melee_hit'
  | 'sfx_melee_swing'
  | 'sfx_skill_cast'
  | 'sfx_level_up'
  | 'sfx_combat_stinger'
  | 'sfx_soulshot'
  | 'sfx_footstep'
  | 'sfx_ui_open'
  | 'sfx_ui_close'
  | 'sfx_ui_click';

export type AudioClipKind = 'music' | 'sfx' | 'ambient';

export interface AudioManifestEntry {
  url: string;
  kind: AudioClipKind;
}

export const AUDIO_MANIFEST: Record<AudioClipId, AudioManifestEntry> = {
  music_town: { url: '/audio/music/music_town.ogg', kind: 'music' },
  music_field: { url: '/audio/music/music_field.ogg', kind: 'music' },
  music_harbor: { url: '/audio/music/music_harbor.ogg', kind: 'music' },
  ambient_village: { url: '/audio/ambient/ambient_village.ogg', kind: 'ambient' },
  ambient_wind: { url: '/audio/ambient/ambient_wind.ogg', kind: 'ambient' },
  ambient_waves: { url: '/audio/ambient/ambient_waves.ogg', kind: 'ambient' },
  sfx_melee_hit: { url: '/audio/sfx/sfx_melee_hit.ogg', kind: 'sfx' },
  sfx_melee_swing: { url: '/audio/sfx/sfx_melee_swing.ogg', kind: 'sfx' },
  sfx_skill_cast: { url: '/audio/sfx/sfx_skill_cast.ogg', kind: 'sfx' },
  sfx_level_up: { url: '/audio/sfx/sfx_level_up.ogg', kind: 'sfx' },
  sfx_combat_stinger: { url: '/audio/sfx/sfx_combat_stinger.ogg', kind: 'sfx' },
  sfx_soulshot: { url: '/audio/sfx/sfx_soulshot.ogg', kind: 'sfx' },
  sfx_footstep: { url: '/audio/sfx/sfx_footstep.ogg', kind: 'sfx' },
  sfx_ui_open: { url: '/audio/sfx/sfx_ui_open.ogg', kind: 'sfx' },
  sfx_ui_close: { url: '/audio/sfx/sfx_ui_close.ogg', kind: 'sfx' },
  sfx_ui_click: { url: '/audio/sfx/sfx_ui_click.ogg', kind: 'sfx' },
};

export function getAudioUrl(id: AudioClipId): string {
  return AUDIO_MANIFEST[id].url;
}
