import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { EntityAction, ACTION_DURATION_MS } from '@nj/game-core';
import {
  createRemotePlayerAvatar,
  MOVE_THRESHOLD,
  MOVE_COAST_MS,
} from './remote-player-avatar';
import type { MeshCharacter } from './creature/mesh-character';
import { syncWeaponVisual } from './creature/weapon-visual';

vi.mock('./creature/weapon-visual', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./creature/weapon-visual')>();
  return {
    ...actual,
    syncWeaponVisual: vi.fn(actual.syncWeaponVisual),
  };
});

function stubMesh(): MeshCharacter {
  return {
    object: new THREE.Group(),
    ready: Promise.resolve(),
    play: () => undefined,
    update: () => undefined,
    setTime: () => undefined,
  };
}

describe('createRemotePlayerAvatar', () => {
  it('enters move on a server step and coasts to idle after movement stops', () => {
    const avatar = createRemotePlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0 }, 0);
    expect(avatar.update(0.016, 0)).toBe('idle');

    avatar.sync({ x: MOVE_THRESHOLD + 0.01, y: 0, z: 0 }, 100);
    expect(avatar.update(0.016, 100)).toBe('move');
    expect(avatar.update(0.016, 100 + MOVE_COAST_MS)).toBe('move');
    expect(avatar.update(0.016, 100 + MOVE_COAST_MS + 1)).toBe('idle');
  });

  it('shows the player name above the head when provided in sync', () => {
    const avatar = createRemotePlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0, name: 'Borin' }, 0);
    const plates = avatar.group.children.filter((c) => c.name === 'nameplate');
    expect(plates.length).toBe(1);

    // Subsequent syncs (e.g. movement) keep a single label.
    avatar.sync({ x: 1, y: 0, z: 0, name: 'Borin' }, 16);
    expect(avatar.group.children.filter((c) => c.name === 'nameplate').length).toBe(1);
  });

  it('faces movement direction within ±5°', () => {
    const avatar = createRemotePlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0 }, 0);
    avatar.sync({ x: 0, y: 0, z: 1 }, 16);
    avatar.update(0.016, 16);
    const expected = Math.atan2(0, 1);
    expect(avatar.group.rotation.y).toBeCloseTo(expected, 1);
    expect(
      Math.abs(avatar.group.rotation.y - expected) * (180 / Math.PI)
    ).toBeLessThanOrEqual(5);
  });

  it('plays attack when actionSeq increases with Attack', () => {
    const avatar = createRemotePlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0, action: EntityAction.Attack, actionSeq: 1 }, 0);
    expect(avatar.update(0.016, 0)).toBe('attack');
    expect(avatar.update(0.016, ACTION_DURATION_MS[EntityAction.Attack] - 1)).toBe('attack');
  });

  it('plays cast when actionSeq increases with Cast', () => {
    const avatar = createRemotePlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0, action: EntityAction.Cast, actionSeq: 1 }, 0);
    expect(avatar.update(0.016, 0)).toBe('cast');
    expect(avatar.update(0.016, ACTION_DURATION_MS[EntityAction.Cast] - 1)).toBe('cast');
  });

  it('plays die when actionSeq increases with Die', () => {
    const avatar = createRemotePlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0, action: EntityAction.Die, actionSeq: 1 }, 0);
    expect(avatar.update(0.016, 0)).toBe('die');
    expect(avatar.update(0.016, ACTION_DURATION_MS[EntityAction.Die] - 1)).toBe('die');
  });

  it('keeps movement yaw during attack (no target facing)', () => {
    const avatar = createRemotePlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0 }, 0);
    avatar.sync({ x: 0, y: 0, z: 1 }, 16);
    avatar.update(0.016, 16);
    const moveYaw = avatar.group.rotation.y;

    avatar.sync({ x: 0, y: 0, z: 1, action: EntityAction.Attack, actionSeq: 1 }, 32);
    avatar.update(0.016, 32);
    expect(avatar.group.rotation.y).toBeCloseTo(moveYaw, 5);
  });

  it('syncs equipped sword on remote replicate', () => {
    const avatar = createRemotePlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0, equippedWeaponItemId: 2369 }, 0);
    expect(syncWeaponVisual).toHaveBeenCalledWith(expect.anything(), 2369, expect.any(Object));
  });

  it('detaches sword when equippedWeaponItemId becomes 0', () => {
    const avatar = createRemotePlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0, equippedWeaponItemId: 2369 }, 0);
    avatar.sync({ x: 0, y: 0, z: 0, equippedWeaponItemId: 0 }, 16);
    expect(syncWeaponVisual).toHaveBeenLastCalledWith(expect.anything(), 0, expect.any(Object));
  });
});
