import * as THREE from 'three';
import { generateTerrain, createTerrainMesh } from './scene/terrain';
import { buildEnvironmentScene } from './scene/environment-renderer';
import { TERRAIN_CONFIG } from '@nj/game-core';

declare global {
  interface Window {
    __SHOT_READY__?: boolean;
  }
}

const canvas = document.getElementById('lab') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(1280, 720);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const isMapOverview = new URLSearchParams(location.search).get('shot') === 'map-overview';

const camera = new THREE.PerspectiveCamera(
  isMapOverview ? 40 : 55,
  1280 / 720,
  0.1,
  isMapOverview ? 2000 : 500
);
if (isMapOverview) {
  camera.position.set(0, 520, 0);
  camera.lookAt(0, 0, 0);
} else {
  camera.position.set(0, 65, 55);
  camera.lookAt(0, 0, 0);
}

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(40, 80, 30);
scene.add(sun);

const terrainData = generateTerrain(TERRAIN_CONFIG.seed, TERRAIN_CONFIG);
scene.add(createTerrainMesh(THREE, terrainData));

await buildEnvironmentScene({ scene, terrainData });

function render(): void {
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

window.__SHOT_READY__ = true;
