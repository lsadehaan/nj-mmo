import * as THREE from 'three';
import {
  createMeshCharacter,
  loadGltfTemplate,
  createMeshCharacterInstance,
  type MeshCharacter,
} from './scene/creature/mesh-character';
import { getCreatureEntry } from './scene/creature/creature-manifest';
import type { AnimationClip } from '@nj/game-core';

/**
 * Standalone visual gate. Renders a single rigged GLB character or mob playing a
 * chosen clip, with a fixed deterministic camera. Driven entirely by query params
 * so a screenshot harness (Playwright) can capture idle/move/attack/cast/die poses.
 *
 * Character: /character-lab.html?char=Mage&clip=attack&t=0.4&angle=0.6&auto=0
 * Mob:       /character-lab.html?mob=20001&clip=attack&t=0.45&angle=0.6&auto=0
 * Model:     /character-lab.html?model=monsters/Wolf&clip=die&t=1.1&angle=0.6&auto=0
 */
const params = new URLSearchParams(location.search);
const mobNpcId = params.get('mob');
const modelPath = params.get('model');
const char = params.get('char') ?? 'Mage';
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
const target = new THREE.Vector3(0, 1.0, 0);
const radius = 4.2;
camera.position.set(Math.sin(angle) * radius, 1.7, Math.cos(angle) * radius);
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

const label = mobNpcId ? `mob=${mobNpcId}` : modelPath ? `model=${modelPath}` : `char=${char}`;
const info = document.getElementById('info');
if (info) info.textContent = `${label} clip=${clip} t=${t}`;

declare global {
  interface Window {
    __SHOT_READY__?: boolean;
  }
}

function resolveModel(): { url: string; scale: number; clipMap?: Record<AnimationClip, string> } {
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

function loadActor(): Promise<MeshCharacter> {
  const resolved = resolveModel();
  if (!mobNpcId && !modelPath) {
    const mesh = createMeshCharacter(resolved.url, {
      scale: resolved.scale,
      clipMap: resolved.clipMap,
    });
    scene.add(mesh.object);
    return mesh.ready.then(() => mesh);
  }
  return loadGltfTemplate(resolved.url).then((template) => {
    const mesh = createMeshCharacterInstance(template, {
      scale: resolved.scale,
      clipMap: resolved.clipMap,
    });
    scene.add(mesh.object);
    return mesh;
  });
}

loadActor()
  .then((actor) => {
    const box = new THREE.Box3().setFromObject(actor.object);
    const size = new THREE.Vector3();
    box.getSize(size);
    console.log(
      `MODEL ${label} size=${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)} minY=${box.min.y.toFixed(2)}`
    );
    actor.play(clip);
    if (auto) {
      let last = performance.now();
      const loop = (now: number): void => {
        const dt = (now - last) / 1000;
        last = now;
        actor.update(dt);
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } else {
      actor.setTime(t);
      renderer.render(scene, camera);
      requestAnimationFrame(() => {
        renderer.render(scene, camera);
        window.__SHOT_READY__ = true;
      });
    }
  })
  .catch((err) => {
    if (info) info.textContent = `LOAD ERROR: ${String(err)}`;
    window.__SHOT_READY__ = true;
  });
