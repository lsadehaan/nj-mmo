import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AnimationClip as ClipName } from '@nj/game-core';

/**
 * Maps our engine's clip vocabulary to the animation track names shared by the
 * KayKit "Adventurers" universal rig (every character GLB exposes the same 76
 * named clips). One map drives all humanoids — matching the game-core animation
 * state machine that decides *which* clip plays (AD-016/AD-017).
 */
export const KAYKIT_CLIP_MAP: Record<ClipName, string> = {
  idle: 'Idle',
  move: 'Walking_A',
  attack: '1H_Melee_Attack_Chop',
  cast: 'Spellcast_Shoot',
  die: 'Death_A',
};

const ONE_SHOT: ReadonlySet<ClipName> = new Set<ClipName>(['attack', 'cast', 'die']);
const CROSSFADE_S = 0.18;

export interface MeshCharacterOptions {
  clipMap?: Record<ClipName, string>;
  scale?: number;
  loader?: GLTFLoader;
}

export interface GLTFTemplate {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export interface MeshCharacter {
  /** Container added to the scene; the loaded model is attached when ready. */
  readonly object: THREE.Group;
  /** Resolves once the GLB is loaded and the first clip is playing. */
  readonly ready: Promise<void>;
  /** Select the clip to play (no-op if already active); crossfades smoothly. */
  play(clip: ClipName): void;
  /** Advance the animation mixer (seconds). */
  update(dt: number): void;
  /** Deterministic posing for screenshots/tests: jump the mixer to a time. */
  setTime(seconds: number): void;
}

const templateCache = new Map<string, Promise<GLTFTemplate>>();

export function clearGltfTemplateCache(): void {
  templateCache.clear();
}

export function loadGltfTemplate(
  url: string,
  loader: GLTFLoader = new GLTFLoader()
): Promise<GLTFTemplate> {
  const cached = templateCache.get(url);
  if (cached) return cached;

  const promise = new Promise<GLTFTemplate>((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        resolve({ scene: gltf.scene, animations: gltf.animations });
      },
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err)))
    );
  });
  templateCache.set(url, promise);
  return promise;
}

function buildMeshCharacterFromModel(
  model: THREE.Object3D,
  animations: THREE.AnimationClip[],
  clipMap: Record<ClipName, string>,
  scale: number
): MeshCharacter {
  const object = new THREE.Group();
  object.name = 'mesh-character';

  const scaled = model;
  scaled.scale.setScalar(scale);
  scaled.traverse((node) => {
    node.castShadow = true;
  });
  object.add(scaled);

  const actions = new Map<string, THREE.AnimationAction>();
  const mixer = new THREE.AnimationMixer(scaled);
  for (const clip of animations) {
    actions.set(clip.name, mixer.clipAction(clip));
  }

  let current: THREE.AnimationAction | null = null;
  let currentClip: ClipName | null = null;

  function play(clip: ClipName): void {
    if (clip === currentClip) return;
    const name = clipMap[clip];
    const next = actions.get(name);
    if (!next) return;

    const oneShot = ONE_SHOT.has(clip);
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = clip === 'die';

    if (current) {
      next.crossFadeFrom(current, CROSSFADE_S, false);
    }
    next.play();
    current = next;
    currentClip = clip;
  }

  play('idle');

  return {
    object,
    ready: Promise.resolve(),
    play,
    update: (dt: number) => mixer.update(dt),
    setTime: (seconds: number) => mixer.setTime(seconds),
  };
}

export function createMeshCharacterInstance(
  template: GLTFTemplate,
  options: MeshCharacterOptions = {}
): MeshCharacter {
  const clipMap = options.clipMap ?? KAYKIT_CLIP_MAP;
  const scale = options.scale ?? 1;
  const cloned = cloneSkeleton(template.scene);
  return buildMeshCharacterFromModel(cloned, template.animations, clipMap, scale);
}

export function createMeshCharacter(
  url: string,
  options: MeshCharacterOptions = {}
): MeshCharacter {
  const clipMap = options.clipMap ?? KAYKIT_CLIP_MAP;
  const scale = options.scale ?? 1;
  const object = new THREE.Group();
  object.name = 'mesh-character';

  const loader = options.loader ?? new GLTFLoader();
  let pending: ClipName | null = null;
  let inner: MeshCharacter | null = null;

  const ready = loadGltfTemplate(url, loader).then((template) => {
    inner = createMeshCharacterInstance(template, { clipMap, scale });
    object.add(inner.object);
    if (pending) inner.play(pending);
  });

  function play(clip: ClipName): void {
    if (!inner) {
      pending = clip;
      return;
    }
    inner.play(clip);
  }

  return {
    object,
    ready,
    play,
    update: (dt: number) => inner?.update(dt),
    setTime: (seconds: number) => inner?.setTime(seconds),
  };
}
