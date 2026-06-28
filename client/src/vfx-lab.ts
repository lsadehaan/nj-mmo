import * as THREE from 'three';
import { spawnPowerStrikeVfx, tickPowerStrikeVfx, POWER_STRIKE_DURATION_MS } from './scene/vfx/power-strike-vfx';
import {
  createMeleeHitPool,
  spawnMeleeHitVfx,
  tickMeleeHitSlot,
  MELEE_HIT_DURATION_MS,
} from './scene/vfx/melee-hit-vfx';
import {
  attachDeathDissolve,
  tickDissolve,
  DEATH_DISSOLVE_DURATION_MS,
} from './scene/vfx/death-dissolve-vfx';
import { spawnLevelUpVfx, tickLevelUpVfx, LEVEL_UP_DURATION_MS } from './scene/vfx/level-up-vfx';
import { createTargetRing } from './scene/vfx/target-ring-vfx';

const params = new URLSearchParams(location.search);
const effect = params.get('effect') ?? 'power-strike';
const t = Number(params.get('t') ?? '0.4');

const info = document.getElementById('info');
if (info) info.textContent = `effect=${effect} t=${t}`;

declare global {
  interface Window {
    __SHOT_READY__?: boolean;
  }
}

const canvas = document.getElementById('lab') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(720, 720);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a5a3a);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(3.5, 2.5, 4.5);
camera.lookAt(0, 0.8, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(4, 8, 5);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(6, 48),
  new THREE.MeshLambertMaterial({ color: 0x46683f })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const mockMob = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.4, 1, 4, 8),
  new THREE.MeshLambertMaterial({ color: 0x884422, flatShading: true })
);
mockMob.position.set(2, 0.9, 0);
scene.add(mockMob);

const mockPlayer = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
  new THREE.MeshLambertMaterial({ color: 0x3366aa, flatShading: true })
);
mockPlayer.position.set(-1, 0.85, 0);
scene.add(mockPlayer);

function poseEffect(): void {
  const nowMs = 0;
  switch (effect) {
    case 'power-strike': {
      const group = spawnPowerStrikeVfx(
        scene,
        { x: mockPlayer.position.x, y: mockPlayer.position.y, z: mockPlayer.position.z },
        { x: mockMob.position.x, y: mockMob.position.y, z: mockMob.position.z },
        nowMs
      );
      tickPowerStrikeVfx(group, t * POWER_STRIKE_DURATION_MS);
      break;
    }
    case 'melee-hit': {
      const pool = createMeleeHitPool(scene);
      const slot = spawnMeleeHitVfx(
        pool,
        scene,
        { x: mockMob.position.x, y: mockMob.position.y, z: mockMob.position.z },
        nowMs
      );
      tickMeleeHitSlot(slot, t * MELEE_HIT_DURATION_MS);
      break;
    }
    case 'death-dissolve': {
      const handle = attachDeathDissolve(mockMob, nowMs);
      tickDissolve(handle, t * DEATH_DISSOLVE_DURATION_MS);
      break;
    }
    case 'level-up': {
      const group = spawnLevelUpVfx(
        scene,
        { x: mockPlayer.position.x, y: mockPlayer.position.y, z: mockPlayer.position.z },
        nowMs
      );
      tickLevelUpVfx(group, t * LEVEL_UP_DURATION_MS);
      break;
    }
    case 'target-ring': {
      const ring = createTargetRing(scene);
      ring.showAt({ x: mockMob.position.x, y: mockMob.position.y, z: mockMob.position.z });
      break;
    }
    default:
      break;
  }
  renderer.render(scene, camera);
}

poseEffect();
requestAnimationFrame(() => {
  poseEffect();
  window.__SHOT_READY__ = true;
});
