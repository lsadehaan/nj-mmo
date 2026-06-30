import { EntityAction } from '@nj/game-core';
import type { AudioBackend } from './audio-backend';
import { AUDIO_MANIFEST, getAudioUrl, type AudioClipId } from './audio-manifest';
import {
  type AudioSettings,
  DEFAULT_AUDIO_SETTINGS,
  saveAudioSettings,
} from './audio-settings';
import { resolveZoneAmbient, resolveZoneMusic } from './zone-music';
import {
  countLevelUps,
  detectActionEdge,
  detectHpHit,
  planarDistance,
  shouldPlayFootstep,
} from './audio-triggers';
import { shouldSoulshotGlint } from '../scene/vfx/soulshot-glint-vfx';
import { getGameState } from '../test-hook';

export const CROSSFADE_MS = 1500;
export const MELEE_HIT_THROTTLE_MS = 80;
export const AMBIENT_GAIN_FACTOR = 0.35;

export interface GameStateAudio {
  currentMusicId: string | null;
  ambientId: string | null;
  sfxCounts: Record<string, number>;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  inCombat: boolean;
}

export interface AudioPlayerSnapshot {
  hp: number;
  level: number;
  action: EntityAction;
  actionSeq: number;
  x: number;
  y: number;
  z: number;
  soulshotCount?: number;
}

export interface AudioMobSnapshot {
  id: string;
  hp: number;
}

export interface AudioManager {
  playLoop: (id: AudioClipId) => void;
  playOneShot: (id: AudioClipId) => void;
  stopLoop: (id: AudioClipId) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  applySettings: (settings: AudioSettings) => void;
  syncPlayer: (snapshot: AudioPlayerSnapshot) => void;
  syncMob: (snapshot: AudioMobSnapshot) => void;
  syncZone: (zoneId: string) => void;
  syncCombat: (targetMobId: string | null) => void;
  tickFootsteps: (
    pos: { x: number; z: number; zoneType: string },
    nowMs: number
  ) => void;
  playUiOpen: () => void;
  playUiClose: () => void;
  playUiClick: () => void;
  getHookSnapshot: () => GameStateAudio;
  publishHook: () => void;
  dispose: () => void;
}

function isFinitePos(pos: { x: number; y: number; z: number }): boolean {
  return Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z);
}

function emptyHook(settings: AudioSettings): GameStateAudio {
  return {
    currentMusicId: null,
    ambientId: null,
    sfxCounts: {},
    musicVolume: settings.musicVolume,
    sfxVolume: settings.sfxVolume,
    muted: settings.muted,
    inCombat: false,
  };
}

export function createAudioManager(opts: {
  backend: AudioBackend;
  settings?: AudioSettings;
}): AudioManager {
  const backend = opts.backend;
  let settings: AudioSettings = { ...(opts.settings ?? DEFAULT_AUDIO_SETTINGS) };
  let hook = emptyHook(settings);

  const activeLoops = new Set<AudioClipId>();
  let currentMusicId: AudioClipId | null = null;
  let currentAmbientId: AudioClipId | null = null;
  let playerPrev: AudioPlayerSnapshot | null = null;
  const mobPrevHp = new Map<string, number>();
  let combatTargetId: string | null = null;
  let combatStingerArmed = true;
  let lastMeleeHitMs = -Infinity;
  let lastFootstepMs = 0;
  let lastFootstepX = 0;
  let lastFootstepZ = 0;
  let footstepInitialized = false;

  const effectiveMusicVolume = (): number =>
    settings.muted ? 0 : settings.musicVolume;

  const effectiveSfxVolume = (): number => (settings.muted ? 0 : settings.sfxVolume);

  const effectiveAmbientVolume = (): number =>
    effectiveSfxVolume() * AMBIENT_GAIN_FACTOR;

  const bumpSfxCount = (id: AudioClipId): void => {
    hook.sfxCounts[id] = (hook.sfxCounts[id] ?? 0) + 1;
  };

  const playLoopInternal = (
    id: AudioClipId,
    volume: number,
    options?: { fadeMs?: number }
  ): void => {
    if (activeLoops.has(id)) return;
    activeLoops.add(id);
    backend.playLoop(id, getAudioUrl(id), volume, options);
    if (AUDIO_MANIFEST[id].kind === 'music') {
      currentMusicId = id;
      hook.currentMusicId = id;
    }
    if (AUDIO_MANIFEST[id].kind === 'ambient') {
      currentAmbientId = id;
      hook.ambientId = id;
    }
  };

  const stopLoopInternal = (id: AudioClipId, options?: { fadeMs?: number }): void => {
    if (!activeLoops.has(id)) return;
    backend.stopLoop(id, options);
    activeLoops.delete(id);
    if (currentMusicId === id) {
      currentMusicId = null;
      hook.currentMusicId = null;
    }
    if (currentAmbientId === id) {
      currentAmbientId = null;
      hook.ambientId = null;
    }
  };

  const playOneShotInternal = (id: AudioClipId, nowMs = performance.now()): void => {
    if (id === 'sfx_melee_hit') {
      if (nowMs - lastMeleeHitMs < MELEE_HIT_THROTTLE_MS) return;
      lastMeleeHitMs = nowMs;
    }
    backend.playOneShot(id, getAudioUrl(id), effectiveSfxVolume());
    bumpSfxCount(id);
  };

  const refreshAmbientForZone = (zoneId: string): void => {
    const nextAmbient = resolveZoneAmbient(zoneId);
    if (currentAmbientId && currentAmbientId !== nextAmbient) {
      stopLoopInternal(currentAmbientId);
    }
    if (!nextAmbient) return;
    if (currentAmbientId === nextAmbient) return;
    playLoopInternal(nextAmbient, effectiveAmbientVolume());
  };

  return {
    playLoop(id) {
      const kind = AUDIO_MANIFEST[id].kind;
      const volume = kind === 'ambient' ? effectiveAmbientVolume() : effectiveMusicVolume();
      playLoopInternal(id, volume);
    },

    playOneShot(id) {
      playOneShotInternal(id);
    },

    stopLoop(id) {
      stopLoopInternal(id);
    },

    setMusicVolume(volume) {
      settings.musicVolume = volume;
      hook.musicVolume = volume;
      if (currentMusicId) {
        backend.playLoop(
          currentMusicId,
          getAudioUrl(currentMusicId),
          effectiveMusicVolume()
        );
      }
    },

    setSfxVolume(volume) {
      settings.sfxVolume = volume;
      hook.sfxVolume = volume;
      if (currentAmbientId) {
        backend.playLoop(
          currentAmbientId,
          getAudioUrl(currentAmbientId),
          effectiveAmbientVolume()
        );
      }
    },

    setMuted(muted) {
      settings.muted = muted;
      hook.muted = muted;
      if (currentMusicId) {
        backend.playLoop(
          currentMusicId,
          getAudioUrl(currentMusicId),
          effectiveMusicVolume()
        );
      }
      if (currentAmbientId) {
        backend.playLoop(
          currentAmbientId,
          getAudioUrl(currentAmbientId),
          effectiveAmbientVolume()
        );
      }
    },

    applySettings(next) {
      settings = { ...next };
      hook.musicVolume = settings.musicVolume;
      hook.sfxVolume = settings.sfxVolume;
      hook.muted = settings.muted;
      saveAudioSettings(settings);
      this.setMusicVolume(settings.musicVolume);
      this.setSfxVolume(settings.sfxVolume);
      this.setMuted(settings.muted);
    },

    syncZone(zoneId) {
      const nextMusic = resolveZoneMusic(zoneId);
      if (currentMusicId === nextMusic) {
        refreshAmbientForZone(zoneId);
        return;
      }
      if (currentMusicId) {
        stopLoopInternal(currentMusicId, { fadeMs: CROSSFADE_MS });
      }
      playLoopInternal(nextMusic, effectiveMusicVolume(), { fadeMs: CROSSFADE_MS });
      refreshAmbientForZone(zoneId);
    },

    syncPlayer(snapshot) {
      const nowMs = performance.now();
      if (!isFinitePos(snapshot)) {
        playerPrev = { ...snapshot };
        return;
      }
      if (playerPrev) {
        if (detectHpHit(playerPrev.hp, snapshot.hp)) {
          playOneShotInternal('sfx_melee_hit', nowMs);
        }
        const levelSteps = countLevelUps(playerPrev.level, snapshot.level);
        for (let i = 0; i < levelSteps; i++) {
          playOneShotInternal('sfx_level_up', nowMs + i);
        }
        if (
          detectActionEdge(
            playerPrev.action,
            playerPrev.actionSeq,
            snapshot.action,
            snapshot.actionSeq,
            'cast'
          )
        ) {
          playOneShotInternal('sfx_skill_cast', nowMs);
        }
        if (
          detectActionEdge(
            playerPrev.action,
            playerPrev.actionSeq,
            snapshot.action,
            snapshot.actionSeq,
            'attack'
          )
        ) {
          playOneShotInternal('sfx_melee_swing', nowMs);
        }
        if (
          shouldSoulshotGlint(
            snapshot.soulshotCount ?? 0,
            playerPrev.action,
            playerPrev.actionSeq,
            snapshot.action,
            snapshot.actionSeq
          )
        ) {
          playOneShotInternal('sfx_soulshot', nowMs);
        }
      }
      playerPrev = { ...snapshot };
    },

    syncMob(snapshot) {
      const nowMs = performance.now();
      const prevHp = mobPrevHp.get(snapshot.id);
      if (prevHp !== undefined && detectHpHit(prevHp, snapshot.hp)) {
        playOneShotInternal('sfx_melee_hit', nowMs);
      }
      mobPrevHp.set(snapshot.id, snapshot.hp);
    },

    syncCombat(targetMobId) {
      const prev = combatTargetId;
      combatTargetId = targetMobId;
      hook.inCombat = targetMobId !== null;

      if (prev === null && targetMobId !== null && combatStingerArmed) {
        playOneShotInternal('sfx_combat_stinger');
        combatStingerArmed = false;
      }
      if (targetMobId === null) {
        combatStingerArmed = true;
      }
    },

    tickFootsteps(pos, nowMs) {
      if (!footstepInitialized) {
        footstepInitialized = true;
        lastFootstepX = pos.x;
        lastFootstepZ = pos.z;
        lastFootstepMs = nowMs;
        return;
      }
      const dist = planarDistance(lastFootstepX, lastFootstepZ, pos.x, pos.z);
      const elapsed = nowMs - lastFootstepMs;
      if (!shouldPlayFootstep(dist, elapsed, pos.zoneType)) return;
      playOneShotInternal('sfx_footstep', nowMs);
      lastFootstepX = pos.x;
      lastFootstepZ = pos.z;
      lastFootstepMs = nowMs;
    },

    playUiOpen() {
      playOneShotInternal('sfx_ui_open');
    },

    playUiClose() {
      playOneShotInternal('sfx_ui_close');
    },

    playUiClick() {
      playOneShotInternal('sfx_ui_click');
    },

    getHookSnapshot() {
      return {
        ...hook,
        sfxCounts: { ...hook.sfxCounts },
        currentMusicId: hook.currentMusicId,
        ambientId: hook.ambientId,
        inCombat: hook.inCombat,
      };
    },

    publishHook() {
      const state = getGameState();
      const snapshot = this.getHookSnapshot();
      if (!('audio' in state) || !state.audio) {
        (state as typeof state & { audio: GameStateAudio }).audio = snapshot;
      } else {
        Object.assign(state.audio, snapshot);
      }
    },

    dispose() {
      for (const id of [...activeLoops]) {
        stopLoopInternal(id);
      }
      backend.dispose();
      hook = emptyHook(settings);
      playerPrev = null;
      mobPrevHp.clear();
      combatTargetId = null;
    },
  };
}
