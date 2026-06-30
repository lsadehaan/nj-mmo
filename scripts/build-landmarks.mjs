/**
 * Hand-authored TI landmark GLBs (static meshes for visual gate).
 * Run: node scripts/build-landmarks.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    result = null;
    onload = null;
    onloadend = null;
    #done() {
      this.onload?.({ target: this });
      this.onloadend?.({ target: this });
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.#done();
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
        this.#done();
      });
    }
  };
}

const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'client/public/models/props/landmarks');
mkdirSync(outDir, { recursive: true });

function mat(color) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    side: THREE.DoubleSide,
    roughness: 0.9,
  });
}

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

function buildObelisk() {
  const g = new THREE.Group();
  g.add(box(1.2, 8, 1.2, 0xb8b8c0, 0, 4, 0));
  g.add(box(2.4, 0.6, 2.4, 0x8a8a92, 0, 0.3, 0));
  return g;
}

function buildElvenRuins() {
  const g = new THREE.Group();
  g.add(box(3, 5, 1, 0x8a8578, -2, 2.5, 0));
  g.add(box(3, 4, 1, 0x7a7568, 2, 2, 0));
  g.add(box(1, 3, 1, 0x6a6558, 0, 1.5, 2));
  return g;
}

function buildRuinsArch() {
  const g = new THREE.Group();
  g.add(box(1, 4, 1, 0x8a8578, -2, 2, 0));
  g.add(box(1, 4, 1, 0x8a8578, 2, 2, 0));
  g.add(box(4.2, 0.8, 1, 0x7a7568, 0, 3.8, 0));
  return g;
}

function buildHarborDock() {
  const g = new THREE.Group();
  g.add(box(8, 0.5, 3, 0x6b4a2f, 0, 0.25, 0));
  for (let i = -3; i <= 3; i += 3) {
    g.add(box(0.4, 2.5, 0.4, 0x5a3a22, i, 1.25, -1.2));
  }
  return g;
}

function buildCaveEntrance() {
  const g = new THREE.Group();
  g.add(box(6, 4, 1.5, 0x6a6860, 0, 2, -1));
  g.add(box(3, 2.5, 1, 0x2a2820, 0, 1.25, 0.2));
  return g;
}

function buildFieldShrine() {
  const g = new THREE.Group();
  g.add(box(1.5, 2.5, 1.5, 0x9a8f7a, 0, 1.25, 0));
  g.add(box(2.5, 0.4, 2.5, 0x7a7060, 0, 0.2, 0));
  return g;
}

const LANDMARKS = [
  ['Obelisk.glb', buildObelisk],
  ['ElvenRuins.glb', buildElvenRuins],
  ['RuinsArch.glb', buildRuinsArch],
  ['HarborDock.glb', buildHarborDock],
  ['CaveEntrance.glb', buildCaveEntrance],
  ['FieldShrine.glb', buildFieldShrine],
];

const exporter = new GLTFExporter();

for (const [name, build] of LANDMARKS) {
  const scene = new THREE.Scene();
  scene.add(build());
  const arrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error('expected binary GLB'));
      },
      reject,
      { binary: true }
    );
  });
  writeFileSync(join(outDir, name), Buffer.from(arrayBuffer));
  console.log('wrote', name);
}

writeFileSync(
  join(outDir, 'LICENSE.txt'),
  'Talking Island landmark props — hand-authored with Three.js for NJ Phase 23.\n'
);
