import * as THREE from 'three';

export type NpcVisualRole = 'Merchant' | 'Helper';

export interface NpcVisualState {
  id: string;
  npcId: number;
  role: NpcVisualRole;
  x: number;
  y: number;
  z: number;
}

export type NpcMeshMap = Map<string, THREE.Group>;

const MERCHANT_BODY_COLOR = 0xcc8844;
const HELPER_BODY_COLOR = 0x44aa66;

export function npcRoleFromType(type: string, npcId: number): NpcVisualRole {
  if (type === 'Merchant' || npcId === 30004) return 'Merchant';
  return 'Helper';
}

export function npcStateToVisual(state: {
  id: string;
  npcId: number;
  type: string;
  x: number;
  y: number;
  z: number;
}): NpcVisualState {
  return {
    id: state.id,
    npcId: state.npcId,
    role: npcRoleFromType(state.type, state.npcId),
    x: state.x,
    y: state.y,
    z: state.z,
  };
}

export function buildNpcMesh(role: NpcVisualRole): THREE.Group {
  const group = new THREE.Group();
  const bodyColor = role === 'Merchant' ? MERCHANT_BODY_COLOR : HELPER_BODY_COLOR;

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
    new THREE.MeshLambertMaterial({ color: bodyColor, flatShading: true })
  );
  body.name = 'body';
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.35, 0.35),
    new THREE.MeshLambertMaterial({ color: 0xffddbb, flatShading: true })
  );
  head.position.y = 0.85;
  head.name = 'head';
  group.add(head);

  return group;
}

export function applyNpcVisual(group: THREE.Group, state: NpcVisualState): void {
  group.position.set(state.x, state.y, state.z);
  group.userData.npcId = state.npcId;
}

export function syncNpcVisual(
  map: NpcMeshMap,
  state: NpcVisualState,
  scene: THREE.Scene
): THREE.Group {
  let group = map.get(state.id);
  if (!group) {
    group = buildNpcMesh(state.role);
    group.userData.npcKey = state.id;
    scene.add(group);
    map.set(state.id, group);
  }
  applyNpcVisual(group, state);
  return group;
}

export function removeNpc(map: NpcMeshMap, npcKey: string, scene: THREE.Scene): void {
  const group = map.get(npcKey);
  if (!group) return;
  scene.remove(group);
  map.delete(npcKey);
}
