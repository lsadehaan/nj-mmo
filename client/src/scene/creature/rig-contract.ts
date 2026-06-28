import * as THREE from 'three';

export type Socket =
  | 'root'
  | 'spine'
  | 'head'
  | 'handL'
  | 'handR'
  | 'footL'
  | 'footR';

export const REQUIRED_SOCKETS: Socket[] = [
  'root',
  'spine',
  'head',
  'handL',
  'handR',
  'footL',
  'footR',
];

export interface Rig {
  root: THREE.Group;
  sockets: Record<Socket, THREE.Object3D>;
  bbox: THREE.Box3;
}

export function validateRig(rig: Rig): { ok: boolean; missing: Socket[] } {
  const missing = REQUIRED_SOCKETS.filter((name) => !rig.sockets[name]);
  return { ok: missing.length === 0, missing };
}
