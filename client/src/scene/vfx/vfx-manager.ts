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
import {
  incrementPowerStrikeHook,
  POWER_STRIKE_DURATION_MS,
  spawnPowerStrikeVfx,
  tickPowerStrikeVfx,
} from './power-strike-vfx';
import {
  createMeleeHitPool,
  incrementMeleeHitHook,
  MELEE_HIT_DURATION_MS,
  retireMeleeHitSlot,
  spawnMeleeHitVfx,
  tickMeleeHitSlot,
  type MeleeHitSlot,
} from './melee-hit-vfx';
import {
  attachDeathDissolve,
  restoreOpacity,
  tickDissolve,
  type DissolveHandle,
} from './death-dissolve-vfx';
import {
  incrementLevelUpHook,
  LEVEL_UP_DURATION_MS,
  spawnLevelUpVfx,
  tickLevelUpVfx,
} from './level-up-vfx';
import { createTargetRing, type TargetRing } from './target-ring-vfx';
import {
  shouldSoulshotGlint,
  spawnSoulshotGlint,
  tickSoulshotGlint,
} from './soulshot-glint-vfx';
import { spawnLootPuffVfx, tickLootPuffVfx, LOOT_PUFF_DURATION_MS } from './loot-puff-vfx';

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
  soulshotCount?: number;
  weaponRoot?: THREE.Object3D | null;
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

function isFinitePos(pos: { x: number; y: number; z: number }): boolean {
  return Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z);
}

export function createVfxManager(scene: THREE.Scene): VfxManager {
  let playerPrev: VfxPlayerSnapshot | null = null;
  const mobPrev = new Map<string, VfxMobSnapshot>();
  let hook = emptyHook();
  let targetMobId: string | null = null;
  const timedEntries: TimedVfxEntry[] = [];
  const meleePool = createMeleeHitPool(scene);
  const activeMelee = new Map<MeleeHitSlot, number>();
  const dissolves = new Map<string, DissolveHandle>();
  const targetRing: TargetRing = createTargetRing(scene);

  const refreshActiveCount = (): void => {
    hook.activeEffectCount =
      countTaggedVfx(scene, 'powerStrike') +
      activeMelee.size +
      countTaggedVfx(scene, 'levelUp');
  };

  const spawnMeleeAt = (pos: { x: number; y: number; z: number }, nowMs: number): void => {
    if (!isFinitePos(pos)) return;
    const slot = spawnMeleeHitVfx(meleePool, scene, pos, nowMs);
    activeMelee.set(slot, nowMs);
    incrementMeleeHitHook(hook);
    refreshActiveCount();
  };

  const addTimed = (
    root: THREE.Object3D,
    tag: string,
    spawnedAtMs: number,
    durationMs: number,
    tick?: TimedVfxEntry['tick']
  ): void => {
    timedEntries.push({
      root,
      spawnedAtMs,
      expiresAtMs: spawnedAtMs + durationMs,
      tag,
      tick,
    });
  };

  return {
    syncPlayer(snapshot) {
      const nowMs = performance.now();
      if (playerPrev) {
        if (detectHpHit(playerPrev.hp, snapshot.hp)) {
          spawnMeleeAt(snapshot, nowMs);
        }
        const levelSteps = countLevelUps(playerPrev.level, snapshot.level);
        for (let i = 0; i < levelSteps; i++) {
          const group = spawnLevelUpVfx(scene, snapshot, nowMs + i);
          incrementLevelUpHook(hook);
          addTimed(group, 'levelUp', nowMs + i, LEVEL_UP_DURATION_MS, (elapsed) =>
            tickLevelUpVfx(group, elapsed)
          );
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
          const mob = targetMobId ? mobPrev.get(targetMobId) : undefined;
          if (mob && isFinitePos(mob) && isFinitePos(snapshot)) {
            const group = spawnPowerStrikeVfx(scene, snapshot, mob, nowMs);
            incrementPowerStrikeHook(hook);
            addTimed(group, 'powerStrike', nowMs, POWER_STRIKE_DURATION_MS, (elapsed) =>
              tickPowerStrikeVfx(group, elapsed)
            );
          }
        }
        if (
          detectActionEdge(
            playerPrev.action,
            playerPrev.actionSeq,
            snapshot.action,
            snapshot.actionSeq,
            'die'
          )
        ) {
          /* dissolve attached via renderer player avatar root */
        }
        if (
          shouldSoulshotGlint(
            snapshot.soulshotCount ?? 0,
            playerPrev.action,
            playerPrev.actionSeq,
            snapshot.action,
            snapshot.actionSeq
          ) &&
          snapshot.weaponRoot
        ) {
          const glint = spawnSoulshotGlint(scene, snapshot.weaponRoot, nowMs);
          addTimed(glint, 'soulshotGlint', nowMs, 300, (elapsed) => {
            if (tickSoulshotGlint(glint, elapsed)) glint.parent?.remove(glint);
          });
        }
      }
      playerPrev = { ...snapshot };
      refreshActiveCount();
    },

    syncMob(snapshot) {
      const nowMs = performance.now();
      const prev = mobPrev.get(snapshot.id);
      if (prev && detectHpHit(prev.hp, snapshot.hp)) {
        spawnMeleeAt(snapshot, nowMs);
      }
      if (
        prev &&
        detectActionEdge(
          prev.action,
          prev.actionSeq,
          snapshot.action,
          snapshot.actionSeq,
          'die'
        )
      ) {
        const group = spawnLootPuffVfx(scene, snapshot, nowMs);
        addTimed(group, 'lootPuff', nowMs, LOOT_PUFF_DURATION_MS, (elapsed) =>
          tickLootPuffVfx(group, elapsed)
        );
      }
      mobPrev.set(snapshot.id, { ...snapshot });

      if (targetMobId === snapshot.id) {
        if (snapshot.hp <= 0) {
          targetRing.hide();
          hook.targetRingVisible = false;
        } else {
          targetRing.follow(snapshot);
        }
      }
      refreshActiveCount();
    },

    setTargetMobId(id, mobSnapshots) {
      targetMobId = id;
      if (!id) {
        targetRing.hide();
        hook.targetRingVisible = false;
        return;
      }
      const mob = mobSnapshots?.get(id) ?? mobPrev.get(id);
      if (!mob || mob.hp <= 0) {
        targetRing.hide();
        hook.targetRingVisible = false;
        return;
      }
      targetRing.showAt(mob);
      hook.targetRingVisible = true;
    },

    attachMobDissolve(mobId, root, nowMs) {
      if (dissolves.has(mobId)) return;
      dissolves.set(mobId, attachDeathDissolve(root, nowMs));
    },

    attachPlayerDissolve(root, nowMs) {
      if (dissolves.has('player')) return;
      dissolves.set('player', attachDeathDissolve(root, nowMs));
    },

    tick(nowMs) {
      for (const [slot, spawnedAt] of [...activeMelee.entries()]) {
        const elapsed = nowMs - spawnedAt;
        if (tickMeleeHitSlot(slot, elapsed)) {
          retireMeleeHitSlot(meleePool, slot);
          activeMelee.delete(slot);
        }
      }

      const remaining = tickActiveVfx(scene, timedEntries, nowMs);
      timedEntries.length = 0;
      timedEntries.push(...remaining);

      for (const [key, handle] of [...dissolves.entries()]) {
        if (tickDissolve(handle, nowMs)) {
          if (key === 'player') restoreOpacity(handle);
          dissolves.delete(key);
        }
      }

      if (targetMobId) {
        const mob = mobPrev.get(targetMobId);
        if (mob && mob.hp > 0) targetRing.follow(mob);
      }

      refreshActiveCount();
    },

    dispose() {
      for (const entry of timedEntries) {
        scene.remove(entry.root);
        disposeObject3D(entry.root);
      }
      timedEntries.length = 0;
      for (const [, handle] of dissolves) restoreOpacity(handle);
      dissolves.clear();
      targetRing.hide();
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
