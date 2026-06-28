import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  clearGltfTemplateCache,
  createMeshCharacter,
  createMeshCharacterInstance,
  loadGltfTemplate,
  KAYKIT_CLIP_MAP,
  type GLTFTemplate,
} from './mesh-character';

function makeSkinnedTemplate(): GLTFTemplate {
  const bone = new THREE.Bone();
  bone.position.y = 1;
  const skinned = new THREE.SkinnedMesh(
    new THREE.BoxGeometry(0.5, 1, 0.5),
    new THREE.MeshBasicMaterial()
  );
  const skeleton = new THREE.Skeleton([bone]);
  skinned.add(bone);
  skinned.bind(skeleton);

  const scene = new THREE.Group();
  scene.add(skinned);

  const idleClip = new THREE.AnimationClip('Idle', 1, [
    new THREE.VectorKeyframeTrack('.bones[0].position', [0, 1], [0, 1, 0, 0, 2, 0]),
  ]);
  const attackClip = new THREE.AnimationClip('1H_Melee_Attack_Chop', 0.6, [
    new THREE.VectorKeyframeTrack('.bones[0].position', [0, 0.6], [0, 1, 0, 0, 0.5, 0]),
  ]);

  return { scene, animations: [idleClip, attackClip] };
}

describe('loadGltfTemplate', () => {
  afterEach(() => {
    clearGltfTemplateCache();
  });

  it('fetches and caches exactly one parsed template per URL', async () => {
    const load = vi.fn((_url: string, onLoad: (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void) => {
      onLoad(makeSkinnedTemplate());
    });
    const loader = { load } as unknown as import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;

    const [a, b] = await Promise.all([
      loadGltfTemplate('/models/test.glb', loader),
      loadGltfTemplate('/models/test.glb', loader),
    ]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a.scene).toBeInstanceOf(THREE.Group);
    expect(a.animations.length).toBeGreaterThan(0);
  });
});

describe('createMeshCharacterInstance', () => {
  afterEach(() => {
    clearGltfTemplateCache();
  });

  it('returns distinct roots and mixers for N instances from one template', () => {
    const template = makeSkinnedTemplate();
    const a = createMeshCharacterInstance(template);
    const b = createMeshCharacterInstance(template);

    expect(a.object).not.toBe(b.object);
    expect(a.object.children[0]).not.toBe(b.object.children[0]);
  });

function findSkinned(root: THREE.Object3D): THREE.SkinnedMesh {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) found = child;
  });
  if (!found) throw new Error('no skinned mesh');
  return found;
}

  it('plays different clips independently (not lock-step)', () => {
    const template = makeSkinnedTemplate();
    const a = createMeshCharacterInstance(template, { clipMap: KAYKIT_CLIP_MAP });
    const b = createMeshCharacterInstance(template, { clipMap: KAYKIT_CLIP_MAP });

    a.play('idle');
    b.play('idle');
    a.update(0.1);
    b.update(0.1);
    const boneBBefore = findSkinned(b.object).skeleton.bones[0].position.y;

    a.play('attack');
    a.update(0.45);

    const boneBAfter = findSkinned(b.object).skeleton.bones[0].position.y;
    expect(boneBAfter).toBeCloseTo(boneBBefore, 3);
  });
});

describe('createMeshCharacter regression', () => {
  afterEach(() => {
    clearGltfTemplateCache();
  });

  it('still loads a single character via URL', async () => {
    const template = makeSkinnedTemplate();
    const load = vi.fn((_url: string, onLoad: (gltf: GLTFTemplate) => void) => {
      onLoad(template);
    });
    const loader = { load } as unknown as import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;

    const character = createMeshCharacter('/models/characters/Mage.glb', { loader });
    await character.ready;
    expect(character.object.children.length).toBeGreaterThan(0);
    character.play('idle');
    character.update(0.016);
  });
});
