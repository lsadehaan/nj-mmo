import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { EntityAction, ACTION_DURATION_MS } from '@nj/game-core';
import {
  computeMobFacingYaw,
  createMobAvatar,
  MOVE_COAST_MS,
  MOVE_THRESHOLD,
} from './mob-avatar';
import type { CreatureEntry } from './creature/creature-manifest';
import type { MeshCharacter } from './creature/mesh-character';
import { KAYKIT_CLIP_MAP } from './creature/mesh-character';

const testEntry: CreatureEntry = {
  model: '/models/monsters/Gremlin.glb',
  clipMap: KAYKIT_CLIP_MAP,
  scale: 1,
  feetOffsetY: 0.5,
  hpBarYOffset: 1.5,
};

const emptyTemplate = { scene: new THREE.Group(), animations: [] };

function stubMesh(): MeshCharacter {
  let current: string | null = null;
  return {
    object: new THREE.Group(),
    ready: Promise.resolve(),
    play: (clip) => {
      current = clip;
    },
    update: () => undefined,
    setTime: () => undefined,
    get currentClip() {
      return current;
    },
  } as MeshCharacter & { currentClip: string | null };
}

describe('createMobAvatar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('enters move on a server step and coasts to idle after movement stops', () => {
    const avatar = createMobAvatar({ entry: testEntry, template: emptyTemplate, mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0 }, 0);
    expect(avatar.update(0.016, 0)).toBe('idle');

    avatar.sync({ x: MOVE_THRESHOLD + 0.01, y: 0, z: 0 }, 100);
    expect(avatar.update(0.016, 100)).toBe('move');
    expect(avatar.update(0.016, 100 + MOVE_COAST_MS)).toBe('move');
    expect(avatar.update(0.016, 100 + MOVE_COAST_MS + 1)).toBe('idle');
  });

  it('plays attack when actionSeq increases with Attack', () => {
    const avatar = createMobAvatar({ entry: testEntry, template: emptyTemplate, mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0, action: EntityAction.Attack, actionSeq: 1 }, 0);
    expect(avatar.update(0.016, 0)).toBe('attack');
    expect(avatar.update(0.016, ACTION_DURATION_MS[EntityAction.Attack] - 1)).toBe('attack');
  });

  it('latches die on Die action and holds through latchDie on remove', () => {
    const avatar = createMobAvatar({ entry: testEntry, template: emptyTemplate, mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0, action: EntityAction.Die, actionSeq: 1 }, 0);
    expect(avatar.update(0.016, 0)).toBe('die');
    expect(avatar.isDiePlaying(0)).toBe(true);
    expect(avatar.isDiePlaying(ACTION_DURATION_MS[EntityAction.Die] - 1)).toBe(true);
    expect(avatar.isDiePlaying(ACTION_DURATION_MS[EntityAction.Die])).toBe(false);

    const fresh = createMobAvatar({ entry: testEntry, template: emptyTemplate, mesh: stubMesh() });
    fresh.sync({ x: 0, y: 0, z: 0 }, 0);
    fresh.latchDie(500);
    expect(fresh.update(0.016, 500)).toBe('die');
    expect(fresh.isDiePlaying(500)).toBe(true);
  });

  it('faces travel direction within ±15°', () => {
    const avatar = createMobAvatar({ entry: testEntry, template: emptyTemplate, mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0 }, 0);
    avatar.sync({ x: 0, y: 0, z: 1 }, 16);
    avatar.update(0.016, 16);
    const expected = Math.atan2(0, 1);
    expect(Math.abs(avatar.group.rotation.y - expected) * (180 / Math.PI)).toBeLessThanOrEqual(15);
  });
});

describe('computeMobFacingYaw', () => {
  it('prefers target facing when requested', () => {
    const velocityYaw = computeMobFacingYaw(1, 0);
    const targetYaw = computeMobFacingYaw(0, 0, 5, 5, true);
    expect(targetYaw).toBeCloseTo(Math.atan2(5, 5), 5);
    expect(targetYaw).not.toBeCloseTo(velocityYaw, 1);
  });
});
