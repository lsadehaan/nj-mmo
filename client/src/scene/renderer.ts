import * as THREE from 'three';
import { generateTerrain, createTerrainMesh } from './terrain';
import { buildVillage, type SceneObjectSpec } from './village';
import { scatterProps } from './scatter';
import {
  step,
  createInitialMoveState,
  type PlayerMoveState,
  type MovementIntent,
} from '../movement/movement-system';
import { applyTo, DEFAULT_CAMERA_OFFSET } from '../camera/follow-camera';
import { ndcFromPointer, toMovementIntent, type RaycastInput } from '../input/click-to-move';
import { setPlayer, setTarget } from '../test-hook';

const WORLD_SEED = 42;
const TERRAIN_OPTS = { size: 200, segments: 64, heightScale: 10, seed: WORLD_SEED };

export interface GameRenderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  terrainMesh: THREE.Mesh;
  playerState: PlayerMoveState;
  tick: (dt: number) => void;
  render: () => void;
  handleClick: (ev: RaycastInput) => void;
  dispose: () => void;
}

function addBox(spec: SceneObjectSpec): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(spec.width, spec.height, spec.depth);
  const material = new THREE.MeshLambertMaterial({
    color: spec.color,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(spec.x, spec.y, spec.z);
  return mesh;
}

function addTree(x: number, y: number, z: number, scale: number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2 * scale, 0.3 * scale, 2 * scale, 6),
    new THREE.MeshLambertMaterial({ color: 0x5c4033, flatShading: true })
  );
  trunk.position.y = y + scale;
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(1 * scale, 2.5 * scale, 6),
    new THREE.MeshLambertMaterial({ color: 0x228b22, flatShading: true })
  );
  foliage.position.y = y + 2.2 * scale;
  group.add(trunk, foliage);
  group.position.set(x, 0, z);
  return group;
}

function addRock(x: number, y: number, z: number, scale: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.8 * scale, 0),
    new THREE.MeshLambertMaterial({ color: 0x808080, flatShading: true })
  );
  mesh.position.set(x, y + 0.4 * scale, z);
  return mesh;
}

export function createRenderer(canvas: HTMLCanvasElement): GameRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  const terrainData = generateTerrain(WORLD_SEED, TERRAIN_OPTS);
  const terrainMesh = createTerrainMesh(THREE, terrainData);
  scene.add(terrainMesh);

  for (const spec of buildVillage({ seed: WORLD_SEED, sampleHeight: terrainData.sampleHeight })) {
    scene.add(addBox(spec));
  }

  for (const prop of scatterProps(WORLD_SEED, terrainData, {
    count: 80,
    fieldMin: -90,
    fieldMax: 90,
    villageRadius: 25,
  })) {
    scene.add(
      prop.kind === 'tree'
        ? addTree(prop.x, prop.y, prop.z, prop.scale)
        : addRock(prop.x, prop.y, prop.z, prop.scale)
    );
  }

  const playerMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1, 4, 8),
    new THREE.MeshLambertMaterial({ color: 0x3366cc, flatShading: true })
  );
  scene.add(playerMesh);

  const playerState = createInitialMoveState(0, terrainData.sampleHeight(0, 0) + 1, 0);
  let pendingIntent: MovementIntent | null = null;

  const raycaster = new THREE.Raycaster();

  const tick = (dt: number): void => {
    const next = step(playerState, pendingIntent, dt);
    pendingIntent = null;
    Object.assign(playerState, next);
    setTarget(playerState.targetX, playerState.targetZ);

    playerMesh.position.set(playerState.x, playerState.y, playerState.z);
    applyTo(
      {
        position: camera.position,
        lookAt: (target) => camera.lookAt(target.x, target.y, target.z),
      },
      { x: playerState.x, y: playerState.y, z: playerState.z },
      DEFAULT_CAMERA_OFFSET
    );
    setPlayer({ x: playerState.x, y: playerState.y, z: playerState.z });
  };

  const render = (): void => {
    renderer.render(scene, camera);
  };

  const handleClick = (ev: RaycastInput): void => {
    terrainMesh.updateMatrixWorld(true);
    const rect = canvas.getBoundingClientRect();
    const ndc = ndcFromPointer(
      { clientX: ev.clientX, clientY: ev.clientY },
      rect.width,
      rect.height,
      rect.left,
      rect.top
    );
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
    let hits = raycaster.intersectObject(terrainMesh, false);

    if (hits.length === 0) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -playerState.y);
      const fallback = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, fallback)) {
        hits = [{ point: fallback } as THREE.Intersection];
      }
    }

    pendingIntent = toMovementIntent(
      hits.length > 0 ? { x: hits[0].point.x, z: hits[0].point.z } : null
    );
    setTarget(pendingIntent?.targetX ?? null, pendingIntent?.targetZ ?? null);
  };

  const dispose = (): void => {
    renderer.dispose();
  };

  tick(0);

  return {
    scene,
    camera,
    renderer,
    terrainMesh,
    playerState,
    tick,
    render,
    handleClick,
    dispose,
  };
}

export function startRenderLoop(game: GameRenderer): () => void {
  let last = performance.now();
  let frameId = 0;

  const loop = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    game.tick(dt);
    game.render();
    frameId = requestAnimationFrame(loop);
  };

  frameId = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(frameId);
}
