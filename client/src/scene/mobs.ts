import * as THREE from 'three';

export interface MobVisualState {
  id: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
}

export type MobMeshMap = Map<string, THREE.Group>;

const MOB_BODY_COLOR = 0x884422;
const HP_BAR_WIDTH = 1.2;
const HP_BAR_HEIGHT = 0.12;
const HP_BAR_Y_OFFSET = 1.6;

export function mobStateToVisual(state: {
  id: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
}): MobVisualState {
  return {
    id: state.id,
    x: state.x,
    y: state.y,
    z: state.z,
    hp: state.hp,
    maxHp: state.maxHp,
  };
}

export function hpBarFillRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, hp / maxHp));
}

function createHpBar(): { group: THREE.Group; fill: THREE.Mesh } {
  const group = new THREE.Group();
  group.position.y = HP_BAR_Y_OFFSET;

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(HP_BAR_WIDTH, HP_BAR_HEIGHT),
    new THREE.MeshBasicMaterial({ color: 0x440000, side: THREE.DoubleSide })
  );
  group.add(bg);

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(HP_BAR_WIDTH, HP_BAR_HEIGHT),
    new THREE.MeshBasicMaterial({ color: 0x22cc22, side: THREE.DoubleSide })
  );
  fill.position.x = -HP_BAR_WIDTH / 2;
  fill.geometry.translate(HP_BAR_WIDTH / 2, 0, 0);
  group.add(fill);

  return { group, fill };
}

export function updateHpBarFill(fill: THREE.Mesh, hp: number, maxHp: number): void {
  const ratio = hpBarFillRatio(hp, maxHp);
  fill.scale.x = ratio;
  fill.visible = ratio > 0;
}

export function createMobGroup(mobId: string): THREE.Group {
  const group = new THREE.Group();
  group.userData.mobId = mobId;

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1, 4, 8),
    new THREE.MeshLambertMaterial({ color: MOB_BODY_COLOR, flatShading: true })
  );
  group.add(body);

  const { group: hpBar, fill } = createHpBar();
  hpBar.name = 'hpBar';
  fill.name = 'hpFill';
  group.add(hpBar);

  return group;
}

export function applyMobVisual(group: THREE.Group, state: MobVisualState): void {
  group.position.set(state.x, state.y, state.z);
  const fill = group.getObjectByName('hpFill') as THREE.Mesh | null;
  if (fill) {
    updateHpBarFill(fill, state.hp, state.maxHp);
  }
}

export function syncMobVisual(
  map: MobMeshMap,
  state: MobVisualState,
  scene: THREE.Scene
): THREE.Group {
  let group = map.get(state.id);
  if (!group) {
    group = createMobGroup(state.id);
    scene.add(group);
    map.set(state.id, group);
  }
  applyMobVisual(group, state);
  return group;
}

export function removeMob(map: MobMeshMap, mobId: string, scene: THREE.Scene): void {
  const group = map.get(mobId);
  if (!group) return;
  scene.remove(group);
  map.delete(mobId);
}

export function listMobMeshes(map: MobMeshMap): THREE.Group[] {
  return [...map.values()];
}

export function faceHpBarsToCamera(map: MobMeshMap, camera: THREE.Camera): void {
  for (const group of map.values()) {
    const hpBar = group.getObjectByName('hpBar');
    if (hpBar) {
      hpBar.quaternion.copy(camera.quaternion);
    }
  }
}
