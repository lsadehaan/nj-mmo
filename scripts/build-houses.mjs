/**
 * Hand-authored low-poly buildings (Three.js → GLB), in the spirit of the
 * standalone Keltir model: every wall is solid geometry, so houses are complete
 * from all angles with no single-sided-mesh culling and no modular-kit math.
 *
 * Pack assets (trees, rocks, monsters, weapons, banner) still come from
 * scripts/import-pack-assets.mjs — only the buildings are authored here.
 *
 * Run: node scripts/build-houses.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

if (typeof globalThis.FileReader === 'undefined') {
  // Minimal FileReader for THREE's GLTFExporter, which reads the binary Blob via
  // `reader.onloadend` (NOT onload) — both are fired here to be safe.
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
const outDir = join(root, 'client/public/models/props/environment');
mkdirSync(outDir, { recursive: true });

const PALETTE = {
  stone: 0x8b8f98,
  stoneDark: 0x6f747d,
  timber: 0x5a4632,
  door: 0x6b4a2f,
  glass: 0x9ad7e8,
  shutter: 0x7a5a39,
};

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
    ...extra,
  });
}

function box(w, h, d, color, [x, y, z], extra) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Build one complete house. Origin is the base centre at ground level (y=0),
 * so the renderer can drop it straight onto the terrain.
 */
function buildHouse(opts) {
  const {
    w,
    d,
    wallH,
    wallColor,
    roofColor,
    roofH = 2.4,
    overhang = 0.6,
    chimney = false,
    roofType = 'gable', // 'gable' | 'pyramid'
    timberFrame = true,
  } = opts;

  const g = new THREE.Group();
  const baseH = 0.7;
  const wallTop = baseH + wallH;

  // Stone foundation course.
  g.add(box(w + 0.3, baseH, d + 0.3, PALETTE.stone, [0, baseH / 2, 0]));

  // Solid wall body (closed box — visible and complete from every side).
  g.add(box(w, wallH, d, wallColor, [0, baseH + wallH / 2, 0]));

  // Timber corner posts + top/mid beams.
  if (timberFrame) {
    for (const cx of [-w / 2, w / 2]) {
      for (const cz of [-d / 2, d / 2]) {
        g.add(box(0.28, wallH, 0.28, PALETTE.timber, [cx, baseH + wallH / 2, cz]));
      }
    }
    for (const by of [baseH + 0.15, wallTop - 0.15, baseH + wallH / 2]) {
      g.add(box(w + 0.04, 0.18, 0.18, PALETTE.timber, [0, by, d / 2]));
      g.add(box(w + 0.04, 0.18, 0.18, PALETTE.timber, [0, by, -d / 2]));
      g.add(box(0.18, 0.18, d + 0.04, PALETTE.timber, [w / 2, by, 0]));
      g.add(box(0.18, 0.18, d + 0.04, PALETTE.timber, [-w / 2, by, 0]));
    }
  }

  // Door on the +z face.
  g.add(box(1.2, 2.2, 0.22, PALETTE.timber, [0, baseH + 1.15, d / 2]));
  g.add(box(0.95, 1.95, 0.26, PALETTE.door, [0, baseH + 1.0, d / 2 + 0.02]));

  // Windows with shutters on the front and sides.
  const winY = baseH + wallH * 0.62;
  const addWindow = (x, z, faceZ) => {
    const depth = faceZ ? 0.16 : 0.16;
    const ww = 0.9;
    if (faceZ) {
      g.add(box(ww + 0.2, 1.1, 0.1, PALETTE.timber, [x, winY, z]));
      g.add(box(ww, 0.9, depth, PALETTE.glass, [x, winY, z + Math.sign(z) * 0.04], { emissive: 0x223344, roughness: 0.4 }));
      g.add(box(0.22, 1.0, 0.08, PALETTE.shutter, [x - ww / 2 - 0.16, winY, z]));
      g.add(box(0.22, 1.0, 0.08, PALETTE.shutter, [x + ww / 2 + 0.16, winY, z]));
    } else {
      g.add(box(0.1, 1.1, ww + 0.2, PALETTE.timber, [x, winY, z]));
      g.add(box(depth, 0.9, ww, PALETTE.glass, [x + Math.sign(x) * 0.04, winY, z], { emissive: 0x223344, roughness: 0.4 }));
      g.add(box(0.08, 1.0, 0.22, PALETTE.shutter, [x, winY, z - ww / 2 - 0.16]));
      g.add(box(0.08, 1.0, 0.22, PALETTE.shutter, [x, winY, z + ww / 2 + 0.16]));
    }
  };
  addWindow(-w * 0.3, d / 2, true);
  addWindow(w * 0.3, d / 2, true);
  addWindow(w / 2, 0, false);
  addWindow(-w / 2, 0, false);

  // Roof.
  if (roofType === 'pyramid') {
    const radius = Math.max(w, d) / 2 + overhang;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.18, roofH, 4), mat(roofColor));
    cone.rotation.y = Math.PI / 4;
    cone.position.y = wallTop + roofH / 2;
    cone.castShadow = true;
    g.add(cone);
  } else {
    const roofW = w + 2 * overhang;
    const halfDepth = d / 2 + overhang;
    const angle = Math.atan2(roofH, halfDepth);
    const slopeLen = Math.hypot(halfDepth, roofH);
    const thickness = 0.2;
    const planeZ = (sign) => {
      const m = box(roofW, thickness, slopeLen, roofColor, [0, wallTop + roofH / 2, sign * (halfDepth / 2)]);
      m.rotation.x = sign * angle;
      return m;
    };
    g.add(planeZ(1));
    g.add(planeZ(-1));

    // Triangular gable ends fill the wall-to-ridge gap on the ±x faces.
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0);
    shape.lineTo(d / 2, 0);
    shape.lineTo(0, roofH);
    shape.lineTo(-d / 2, 0);
    const gableGeo = new THREE.ShapeGeometry(shape);
    for (const sx of [-1, 1]) {
      const gm = new THREE.Mesh(gableGeo, mat(wallColor));
      gm.rotation.y = (sx * Math.PI) / 2;
      gm.position.set((sx * w) / 2, wallTop, 0);
      gm.castShadow = true;
      g.add(gm);
    }

    // Ridge beam.
    g.add(box(roofW, 0.18, 0.18, PALETTE.timber, [0, wallTop + roofH, 0]));
  }

  // Chimney.
  if (chimney) {
    const chH = roofH + 1.4;
    g.add(box(0.75, chH, 0.75, PALETTE.stoneDark, [w / 2 - 0.9, wallTop + chH / 2 - 0.4, -d / 2 + 0.9]));
  }

  return g;
}

function exportGlb(name, object) {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      object,
      (result) => {
        const buf = Buffer.from(result);
        writeFileSync(join(outDir, `${name}.glb`), buf);
        console.log(`wrote ${name}.glb (${(buf.length / 1024).toFixed(0)} KB)`);
        resolve();
      },
      (err) => reject(err),
      { binary: true },
    );
  });
}

const HOUSES = {
  Building_0: { w: 6, d: 5, wallH: 3.2, wallColor: 0xd8c9a8, roofColor: 0xb0492f, chimney: true },
  Building_1: { w: 5, d: 6, wallH: 3.2, wallColor: 0xc9b48f, roofColor: 0x9c4530 },
  Building_2: { w: 7, d: 4, wallH: 3.0, wallColor: 0xcdbfa0, roofColor: 0xa84a35, chimney: true },
  Building_3: { w: 5, d: 5, wallH: 3.4, wallColor: 0xd2c4a0, roofColor: 0x8f4a3a, chimney: true },
  Building_4: { w: 4, d: 4, wallH: 6.5, wallColor: 0xb9bcc2, roofColor: 0x8a3f30, roofType: 'pyramid', roofH: 3.4 },
};

async function main() {
  for (const [name, opts] of Object.entries(HOUSES)) {
    await exportGlb(name, buildHouse(opts));
  }

  writeFileSync(
    join(outDir, 'BUILDINGS_LICENSE.txt'),
    `Building_0.glb – Building_4.glb — hand-authored low-poly Three.js geometry
(scripts/build-houses.mjs). Solid walls, gabled/pyramid roofs, timber frame,
door, shuttered windows, chimney. CC0 / authored for this project.
Building_4 is a 2-storey watchtower with a pyramidal roof.
`,
  );
  console.log('\nHouses built. Run: node scripts/visual-gate.mjs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
