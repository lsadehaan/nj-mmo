import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getWeaponAttachment,
  GOBLIN_CLUB_ATTACHMENT,
  KAYKIT_RIGHT_HAND_BONE,
} from './weapon-manifest';
import { clearGltfTemplateCache, loadGltfTemplate } from './mesh-character';

describe('weapon-manifest', () => {
  afterEach(() => {
    clearGltfTemplateCache();
  });
  it('returns Squire Sword entry for item 2369', () => {
    const entry = getWeaponAttachment(2369);
    expect(entry).toEqual({
      model: '/models/props/SquiresSword.glb',
      bone: KAYKIT_RIGHT_HAND_BONE,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
    });
  });

  it('returns null for unmapped weapon ids', () => {
    expect(getWeaponAttachment(9999)).toBeNull();
  });

  it('exports Goblin club attachment on the KayKit hand bone', () => {
    expect(GOBLIN_CLUB_ATTACHMENT.model).toBe('/models/props/GoblinClub.glb');
    expect(GOBLIN_CLUB_ATTACHMENT.bone).toBe(KAYKIT_RIGHT_HAND_BONE);
  });

  it('prop GLB files exist beside optional LICENSE', () => {
    const publicRoot = resolve(__dirname, '../../../public');
    expect(existsSync(resolve(publicRoot, 'models/props/SquiresSword.glb'))).toBe(true);
    expect(existsSync(resolve(publicRoot, 'models/props/GoblinClub.glb'))).toBe(true);
    expect(existsSync(resolve(publicRoot, 'models/props/LICENSE.txt'))).toBe(true);
  });

  it('loads prop GLBs without error', async () => {
    const propScene = new THREE.Group();
    propScene.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1)));
    const load = vi.fn((_url: string, onLoad: (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void) => {
      onLoad({ scene: propScene, animations: [] });
    });
    const loader = { load } as unknown as import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;

    const sword = await loadGltfTemplate('/models/props/SquiresSword.glb', loader);
    const club = await loadGltfTemplate('/models/props/GoblinClub.glb', loader);
    expect(sword.scene).toBeDefined();
    expect(club.scene).toBeDefined();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
