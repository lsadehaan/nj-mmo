import * as THREE from 'three';
import {
  createMeshCharacter,
  loadGltfTemplate,
  createMeshCharacterInstance,
  type MeshCharacter,
} from './scene/creature/mesh-character';
import { getCreatureEntry } from './scene/creature/creature-manifest';
import { getPlayerManifestEntry } from './scene/creature/player-manifest';
import { getNpcEntry } from './scene/creature/npc-manifest';
import type { AnimationClip } from '@nj/game-core';
import {
  createWeaponVisualState,
  syncWeaponVisual,
} from './scene/creature/weapon-visual';
import { GOBLIN_CLUB_ATTACHMENT } from './scene/creature/weapon-manifest';
import { attachToBone } from './scene/creature/attachment';

/**
 * Standalone visual gate. Renders a single rigged GLB character or mob playing a
 * chosen clip, with a fixed deterministic camera. Driven entirely by query params
 * so a screenshot harness (Playwright) can capture idle/move/attack/cast/die poses.
 *
 * Character: /character-lab.html?char=Rogue&clip=attack&t=0.4&angle=0.6&auto=0
 * Weapon:    /character-lab.html?char=Rogue&weapon=2369&clip=attack&t=0.45&auto=0
 * Dual:      /character-lab.html?dual=1&char=Rogue&weapon=2369&clip=idle&t=0.5&auto=0
 * Mob:       /character-lab.html?mob=20003&clip=attack&t=0.45&angle=0.6&auto=0
 */
const params = new URLSearchParams(location.search);
const classIdParam = params.get('classId');
const mobNpcId = params.get('mob');
const townNpcId = params.get('npc');
const modelPath = params.get('model');
const char = params.get('char') ?? 'Rogue';
const weaponId = Number(params.get('weapon') ?? '0');
const dual = params.get('dual') === '1';
const clip = (params.get('clip') ?? 'idle') as AnimationClip;
const t = Number(params.get('t') ?? '0.4');
const angle = Number(params.get('angle') ?? '0.6');
const auto = params.get('auto') === '1';

const canvas = document.getElementById('lab') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a5a3a);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
const target = new THREE.Vector3(dual ? 0.75 : 0, 1.0, 0);
const radius = dual ? 5.4 : 4.2;
camera.position.set(
  target.x + Math.sin(angle) * radius,
  1.7,
  target.z + Math.cos(angle) * radius
);
camera.lookAt(target);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(4, 8, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(6, 48),
  new THREE.MeshLambertMaterial({ color: 0x46683f })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const label = classIdParam
  ? `classId=${classIdParam}`
  : townNpcId
  ? `npc=${townNpcId}`
  : mobNpcId
  ? `mob=${mobNpcId}`
  : modelPath
    ? `model=${modelPath}`
    : dual
      ? `dual char=${char}`
      : `char=${char}`;
const info = document.getElementById('info');
if (info) {
  info.textContent = `${label} weapon=${weaponId || 'none'} clip=${clip} t=${t}`;
}

declare global {
  interface Window {
    __SHOT_READY__?: boolean;
  }
}

function resolveModel(): { url: string; scale: number; clipMap?: Record<AnimationClip, string> } {
  if (classIdParam) {
    const entry = getPlayerManifestEntry(Number(classIdParam));
    return { url: entry.model, scale: entry.scale, clipMap: entry.clipMap };
  }
  if (townNpcId) {
    const entry = getNpcEntry(Number(townNpcId));
    if (!entry) throw new Error(`Unknown town npcId ${townNpcId}`);
    return { url: entry.model, scale: entry.scale, clipMap: entry.clipMap };
  }
  if (mobNpcId) {
    const entry = getCreatureEntry(Number(mobNpcId));
    if (!entry) throw new Error(`Unknown mob npcId ${mobNpcId}`);
    return { url: entry.model, scale: entry.scale, clipMap: entry.clipMap };
  }
  if (modelPath) {
    return { url: `/models/${modelPath}.glb`, scale: 1 };
  }
  return { url: `/models/characters/${char}.glb`, scale: 1 };
}

function maybeAttachWeapon(actor: MeshCharacter, itemId: number): Promise<void> {
  if (itemId <= 0) return Promise.resolve();
  const state = createWeaponVisualState();
  syncWeaponVisual(actor.object, itemId, state);
  return state.loading ?? Promise.resolve();
}

function loadCharacterActor(offsetX = 0): Promise<MeshCharacter> {
  const resolved = resolveModel();
  const mesh = createMeshCharacter(resolved.url, {
    scale: resolved.scale,
    clipMap: resolved.clipMap,
  });
  mesh.object.position.x = offsetX;
  scene.add(mesh.object);
  return mesh.ready.then(() => maybeAttachWeapon(mesh, weaponId).then(() => mesh));
}

async function loadTownNpcActor(): Promise<MeshCharacter> {
  const resolved = resolveModel();
  const mesh = createMeshCharacter(resolved.url, {
    scale: resolved.scale,
    clipMap: resolved.clipMap,
  });
  scene.add(mesh.object);
  await mesh.ready;
  return mesh;
}

async function loadMobActor(): Promise<MeshCharacter> {
  const resolved = resolveModel();
  const template = await loadGltfTemplate(resolved.url);
  const entry = getCreatureEntry(Number(mobNpcId));
  if (!entry) throw new Error(`Unknown mob npcId ${mobNpcId}`);

  const mesh = createMeshCharacterInstance(template, {
    scale: resolved.scale,
    clipMap: resolved.clipMap,
  });
  scene.add(mesh.object);

  if (Number(mobNpcId) === 20003) {
    const clubTemplate = await loadGltfTemplate(GOBLIN_CLUB_ATTACHMENT.model);
    const club = clubTemplate.scene.clone(true);
    attachToBone(mesh.object, club, GOBLIN_CLUB_ATTACHMENT.bone, GOBLIN_CLUB_ATTACHMENT.transform);
  }

  return mesh;
}

function loadActors(): Promise<MeshCharacter[]> {
  if (townNpcId) {
    return loadTownNpcActor().then((actor) => [actor]);
  }
  if (mobNpcId || modelPath) {
    return loadMobActor().then((actor) => [actor]);
  }
  if (dual) {
    return Promise.all([loadCharacterActor(-1.1), loadCharacterActor(1.1)]);
  }
  return loadCharacterActor().then((actor) => [actor]);
}

function poseActorsForShot(actors: MeshCharacter[]): void {
  for (const actor of actors) {
    actor.object.updateMatrixWorld(true);
    actor.setTime(t);
    actor.object.updateMatrixWorld(true);
  }
  renderer.render(scene, camera);
}

loadActors()
  .then((actors) => {
    for (const actor of actors) {
      const box = new THREE.Box3().setFromObject(actor.object);
      const size = new THREE.Vector3();
      box.getSize(size);
      console.log(
        `MODEL ${label} size=${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)} minY=${box.min.y.toFixed(2)}`
      );
      actor.play(clip);
    }

    if (auto) {
      let last = performance.now();
      const loop = (now: number): void => {
        const dt = (now - last) / 1000;
        last = now;
        for (const actor of actors) actor.update(dt);
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } else {
      poseActorsForShot(actors);
      requestAnimationFrame(() => {
        poseActorsForShot(actors);
        window.__SHOT_READY__ = true;
      });
    }
  })
  .catch((err) => {
    if (info) info.textContent = `LOAD ERROR: ${String(err)}`;
    window.__SHOT_READY__ = true;
  });
