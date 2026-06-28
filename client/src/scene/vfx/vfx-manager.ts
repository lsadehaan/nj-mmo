import * as THREE from 'three';
import { EntityAction } from '@nj/game-core';
import type { GameStateVfx } from '../../test-hook';
import { countTaggedVfx, disposeObject3D, tickActiveVfx, type TimedVfxEntry } from './vfx-lifecycle';
import {
  countLevelUps,
  detectActionEdge,
  detectHpHit,
  detectLevelUp,
} from './vfx-triggers';

export interface VfxMobSnapshot {
  id: string;
  hp: number;
  x: number;
  y: number;
  z: number;
  action: EntityAction;
  actionSeq: number;
}

export interface VfxPlayerSnapshot {
  hp: number;
  level: number;
  action: EntityAction;
  actionSeq: number;
  x: number;
  y: number;
  z: number;
}

export interface VfxManager {
  syncPlayer: (snapshot: VfxPlayerSnapshot) => void;
  syncMob: (snapshot: VfxMobSnapshot) => void;
  setTargetMobId: (id: string | null, mobSnapshots?: Map<string, VfxMobSnapshot>) => void;
  attachMobDissolve: (mobId: string, root: THREE.Object3D, nowMs: number) => void;
  attachPlayerDissolve: (root: THREE.Object3D, nowMs: number) => void;
  tick: (nowMs: number) => void;
  dispose: () => void;
  getHookSnapshot: () => GameStateVfx;
  publishHook: (vfx: GameStateVfx) => void;
}

function emptyHook(): GameStateVfx {
  return {
    powerStrikeCount: 0,
    meleeHitCount: 0,
    levelUpCount: 0,
    targetRingVisible: false,
    activeEffectCount: 0,
  };
}

export function createVfxManager(scene: THREE.Scene): VfxManager {
  let playerPrev: VfxPlayerSnapshot | null = null;
  const mobPrev = new Map<string, VfxMobSnapshot>();
  let hook = emptyHook();
  let targetMobId: string | null = null;
  const timedEntries: TimedVfxEntry[] = [];

  const refreshActiveCount = (): void => {
    hook.activeEffectCount =
      countTaggedVfx(scene, 'powerStrike') +
      countTaggedVfx(scene, 'meleeHit') +
      countTaggedVfx(scene, 'levelUp');
  };

  return {
    syncPlayer(snapshot) {
      if (playerPrev) {
        if (detectHpHit(playerPrev.hp, snapshot.hp) && snapshot.hp > 0) {
          hook.meleeHitCount += 1;
        }
        if (detectLevelUp(playerPrev.level, snapshot.level)) {
          hook.levelUpCount += countLevelUps(playerPrev.level, snapshot.level);
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
          hook.powerStrikeCount += 1;
        }
      }
      playerPrev = { ...snapshot };
      refreshActiveCount();
    },

    syncMob(snapshot) {
      const prev = mobPrev.get(snapshot.id);
      if (prev && detectHpHit(prev.hp, snapshot.hp) && snapshot.hp > 0) {
        hook.meleeHitCount += 1;
      }
      mobPrev.set(snapshot.id, { ...snapshot });
      refreshActiveCount();
    },

    setTargetMobId(id) {
      targetMobId = id;
      hook.targetRingVisible = id !== null;
    },

    attachMobDissolve() {
      /* wired in T9/T10 */
    },

    attachPlayerDissolve() {
      /* wired in T9/T10 */
    },

    tick(nowMs) {
      const remaining = tickActiveVfx(scene, timedEntries, nowMs);
      timedEntries.length = 0;
      timedEntries.push(...remaining);
      refreshActiveCount();
      void targetMobId;
    },

    dispose() {
      for (const entry of timedEntries) {
        scene.remove(entry.root);
        disposeObject3D(entry.root);
      }
      timedEntries.length = 0;
      mobPrev.clear();
      playerPrev = null;
      hook = emptyHook();
    },

    getHookSnapshot() {
      return { ...hook };
    },

    publishHook(vfx) {
      Object.assign(vfx, hook);
    },
  };
}
