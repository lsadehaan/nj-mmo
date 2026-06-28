import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { EntityAction, ACTION_DURATION_MS } from '@nj/game-core';
import { createNpcAvatar } from './npc-avatar';
import { KATERINA_CLIP_MAP } from './creature/npc-manifest';
import type { NpcEntry } from './creature/npc-manifest';
import type { MeshCharacter } from './creature/mesh-character';

const testEntry: NpcEntry = {
  model: '/models/characters/Mage.glb',
  clipMap: KATERINA_CLIP_MAP,
  scale: 1,
  feetOffsetY: 0.5,
  displayName: 'Katerina',
};

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

describe('createNpcAvatar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('plays idle continuously with no locomotion input', () => {
    const avatar = createNpcAvatar(testEntry, stubMesh());
    avatar.sync({ x: 0, y: 1, z: 0 });
    expect(avatar.update(0.016, 0)).toBe('idle');
    expect(avatar.update(0.016, 500)).toBe('idle');
  });

  it('positions mesh at y minus feetOffsetY', () => {
    const avatar = createNpcAvatar(testEntry, stubMesh());
    avatar.sync({ x: -6, y: 4.26, z: -8 });
    expect(avatar.group.position.x).toBe(-6);
    expect(avatar.group.position.y).toBeCloseTo(3.76, 5);
    expect(avatar.group.position.z).toBe(-8);
  });

  it('plays cast during greet then returns to idle', () => {
    const avatar = createNpcAvatar(testEntry, stubMesh());
    avatar.sync({ x: 0, y: 0, z: 0 });
    avatar.triggerGreet({ x: 1, z: 0 }, 1, 0);
    expect(avatar.update(0.016, 0)).toBe('cast');
    const afterMs = ACTION_DURATION_MS[EntityAction.Cast];
    expect(avatar.update(0.016, afterMs)).toBe('idle');
  });

  it('faces player yaw on greet', () => {
    const avatar = createNpcAvatar(testEntry, stubMesh());
    avatar.sync({ x: 0, y: 0, z: 0 });
    avatar.triggerGreet({ x: 0, z: 5 }, 1, 0);
    avatar.update(0.016, 0);
    const expected = Math.atan2(0, 5);
    expect(avatar.group.rotation.y).toBeCloseTo(expected, 5);
  });

  it('debounces greet for the same ui epoch and while cast is active', () => {
    const mesh = stubMesh();
    const playSpy = vi.spyOn(mesh, 'play');
    const avatar = createNpcAvatar(testEntry, mesh);
    avatar.sync({ x: 0, y: 0, z: 0 });

    avatar.triggerGreet({ x: 1, z: 0 }, 1, 0);
    avatar.triggerGreet({ x: 2, z: 0 }, 1, 0);
    expect(avatar.update(0.016, 0)).toBe('cast');
    expect(playSpy.mock.calls.filter(([clip]) => clip === 'cast')).toHaveLength(1);
    const yawAfterFirstGreet = avatar.group.rotation.y;
    expect(avatar.group.rotation.y).toBeCloseTo(Math.atan2(1, 0), 5);

    avatar.triggerGreet({ x: 2, z: 0 }, 1, 100);
    expect(avatar.group.rotation.y).toBeCloseTo(yawAfterFirstGreet, 5);
    expect(avatar.update(0.016, 100)).toBe('cast');

    avatar.triggerGreet({ x: 2, z: 0 }, 2, 100);
    expect(avatar.group.rotation.y).toBeCloseTo(yawAfterFirstGreet, 5);
    expect(avatar.update(0.016, 100)).toBe('cast');

    const afterMs = ACTION_DURATION_MS[EntityAction.Cast];
    expect(avatar.update(0.016, afterMs)).toBe('idle');
    const castPlaysBeforeReplay = playSpy.mock.calls.filter(([clip]) => clip === 'cast').length;

    avatar.triggerGreet({ x: 2, z: 0 }, 1, afterMs);
    expect(avatar.update(0.016, afterMs)).toBe('idle');
    expect(playSpy.mock.calls.filter(([clip]) => clip === 'cast')).toHaveLength(
      castPlaysBeforeReplay
    );
  });
});
