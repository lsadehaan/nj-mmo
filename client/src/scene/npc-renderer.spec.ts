import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  buildNpcMesh,
  createNpcInstanceMap,
  npcRoleFromType,
  npcStateToVisual,
  removeNpc,
  syncNpcVisual,
  tickNpcVisuals,
  triggerNpcGreet,
  type NpcVisualRole,
} from './npc-renderer';
import { createNpcAvatar } from './npc-avatar';
import { KATERINA_CLIP_MAP } from './creature/npc-manifest';
import type { MeshCharacter } from './creature/mesh-character';

vi.mock('./npc-avatar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./npc-avatar')>();
  return {
    ...actual,
    createNpcAvatar: vi.fn(actual.createNpcAvatar),
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

describe('npc-renderer', () => {
  it('buildNpcMesh returns a THREE.Group with at least one mesh', () => {
    const group = buildNpcMesh('Merchant');
    expect(group).toBeInstanceOf(THREE.Group);
    let meshCount = 0;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) meshCount += 1;
    });
    expect(meshCount).toBeGreaterThanOrEqual(1);
    expect(group.userData.renderKind).toBe('capsule');
  });

  it('uses distinct body colors for Merchant vs Helper capsule fallback', () => {
    const merchantColor = readBodyColor(buildNpcMesh('Merchant'));
    const helperColor = readBodyColor(buildNpcMesh('Helper'));
    expect(merchantColor).not.toBe(helperColor);
    expect(merchantColor).toBe(0xcc8844);
    expect(helperColor).toBe(0x44aa66);
  });

  it('maps server npc state to visual snapshot without mutating source', () => {
    const server = {
      id: 'npc-30004',
      npcId: 30004,
      name: 'Katerina',
      type: 'Merchant',
      x: -6,
      y: 4.26,
      z: -8,
    };
    const visual = npcStateToVisual(server);
    expect(visual).toEqual({
      id: 'npc-30004',
      npcId: 30004,
      role: 'Merchant' as NpcVisualRole,
      x: -6,
      y: 4.26,
      z: -8,
    });
    expect(visual).not.toBe(server);
    server.x = 0;
    expect(visual.x).toBe(-6);
  });

  it('maps Roxxy teleporter type to Helper role for MVP dialog UX', () => {
    expect(npcRoleFromType('Teleporter', 30006)).toBe('Helper');
    expect(npcRoleFromType('Merchant', 30004)).toBe('Merchant');
  });

  it('creates mesh-backed groups for mapped npcIds', () => {
    const scene = new THREE.Scene();
    const map = new Map<string, THREE.Group>();
    const instances = createNpcInstanceMap();
    const group = syncNpcVisual(
      map,
      instances,
      npcStateToVisual({
        id: 'npc-30004',
        npcId: 30004,
        type: 'Merchant',
        x: -6,
        y: 4.26,
        z: -8,
      }),
      scene
    );
    expect(group.userData.renderKind).toBe('mesh');
    expect(instances.get('npc-30004')?.usesCapsule).toBe(false);
  });

  it('creates mesh-backed group for Lector weapon merchant (30001)', () => {
    const scene = new THREE.Scene();
    const map = new Map<string, THREE.Group>();
    const instances = createNpcInstanceMap();
    const group = syncNpcVisual(
      map,
      instances,
      npcStateToVisual({
        id: 'npc-30001',
        npcId: 30001,
        type: 'Merchant',
        x: -14,
        y: 4.26,
        z: -2,
      }),
      scene
    );
    expect(group.userData.renderKind).toBe('mesh');
    expect(instances.get('npc-30001')?.usesCapsule).toBe(false);
  });

  it('keeps capsule fallback for unmapped npcId', () => {
    const scene = new THREE.Scene();
    const map = new Map<string, THREE.Group>();
    const instances = createNpcInstanceMap();
    const group = syncNpcVisual(
      map,
      instances,
      npcStateToVisual({
        id: 'npc-unknown',
        npcId: 99999,
        type: 'Merchant',
        x: 0,
        y: 0,
        z: 0,
      }),
      scene
    );
    expect(group.userData.renderKind).toBe('capsule');
    expect(group.getObjectByName('body')).not.toBeNull();
  });

  it('removeNpc cleans scene and instance map', () => {
    const scene = new THREE.Scene();
    const map = new Map<string, THREE.Group>();
    const instances = createNpcInstanceMap();
    syncNpcVisual(
      map,
      instances,
      npcStateToVisual({
        id: 'npc-30006',
        npcId: 30006,
        type: 'Teleporter',
        x: 4,
        y: 4.3,
        z: 10,
      }),
      scene
    );
    removeNpc(map, instances, 'npc-30006', scene);
    expect(map.has('npc-30006')).toBe(false);
    expect(instances.has('npc-30006')).toBe(false);
    expect(scene.children).toHaveLength(0);
  });

  it('falls back to capsule when GLB load fails', async () => {
    const ready = Promise.reject(new Error('GLB load failed'));
    vi.mocked(createNpcAvatar).mockReturnValueOnce({
      group: new THREE.Group(),
      sync: () => undefined,
      update: () => 'idle',
      triggerGreet: () => undefined,
      ready,
    });

    const scene = new THREE.Scene();
    const map = new Map<string, THREE.Group>();
    const instances = createNpcInstanceMap();
    const group = syncNpcVisual(
      map,
      instances,
      npcStateToVisual({
        id: 'npc-30004',
        npcId: 30004,
        type: 'Merchant',
        x: -6,
        y: 4.26,
        z: -8,
      }),
      scene
    );

    await ready.catch(() => undefined);

    const instance = instances.get('npc-30004');
    expect(instance?.usesCapsule).toBe(true);
    expect(group.userData.renderKind).toBe('capsule');
    expect(group.getObjectByName('body')).not.toBeNull();

    let meshCount = 0;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) meshCount += 1;
    });
    expect(meshCount).toBeGreaterThanOrEqual(1);
  });

  it('tickNpcVisuals invokes avatar update each tick', () => {
    const update = vi.fn(() => 'idle' as const);
    const instances = createNpcInstanceMap();
    const group = new THREE.Group();
    instances.set('npc-30004', {
      group,
      avatar: {
        group,
        sync: () => undefined,
        update,
        triggerGreet: () => undefined,
        ready: Promise.resolve(),
      },
      usesCapsule: false,
      npcId: 30004,
      currentClip: 'idle',
    });

    const clips = tickNpcVisuals(instances, 0.016, 100);
    expect(update).toHaveBeenCalledWith(0.016, 100);
    expect(clips.get('npc-30004')).toBe('idle');
  });

  it('ticks mesh avatars and triggers greet by npcId', () => {
    const instances = createNpcInstanceMap();
    const avatar = createNpcAvatar(
      {
        model: '/models/characters/Mage.glb',
        clipMap: KATERINA_CLIP_MAP,
        scale: 1,
        feetOffsetY: 0.5,
        displayName: 'Katerina',
      },
      stubMesh()
    );
    const group = new THREE.Group();
    group.add(avatar.group);
    instances.set('npc-30004', {
      group,
      avatar,
      usesCapsule: false,
      npcId: 30004,
      currentClip: 'idle',
    });

    const clips = tickNpcVisuals(instances, 0.016, 0);
    expect(clips.get('npc-30004')).toBe('idle');

    triggerNpcGreet(instances, 30004, { x: 1, z: 0 }, 1, 0);
    const greetClips = tickNpcVisuals(instances, 0.016, 0);
    expect(greetClips.get('npc-30004')).toBe('cast');
  });
});

function readBodyColor(group: THREE.Group): number {
  const body = group.getObjectByName('body') as THREE.Mesh | null;
  expect(body).not.toBeNull();
  if (!body) return 0;
  const material = body.material as THREE.MeshLambertMaterial;
  return material.color.getHex();
}
