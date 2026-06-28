import * as THREE from 'three';
import { REQUIRED_SOCKETS, validateRig, type Rig } from './rig-contract';

export interface HumanoidParams {
  size?: number;
  bodyColor?: number;
  headColor?: number;
  hasWeapon?: boolean;
}

const DEFAULT_BODY_COLOR = 0x3366cc;
const DEFAULT_HEAD_COLOR = 0xffddbb;

function mesh(
  geometry: THREE.BufferGeometry,
  color: number,
  name: string
): THREE.Mesh {
  const material = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const part = new THREE.Mesh(geometry, material);
  part.name = name;
  return part;
}

export function buildHumanoid(params: HumanoidParams = {}): Rig {
  const size = params.size ?? 1;
  const bodyColor = params.bodyColor ?? DEFAULT_BODY_COLOR;
  const headColor = params.headColor ?? DEFAULT_HEAD_COLOR;

  const root = new THREE.Group();
  root.name = 'humanoid-root';

  const sockets = {} as Rig['sockets'];
  for (const name of REQUIRED_SOCKETS) {
    sockets[name] = new THREE.Object3D();
    sockets[name].name = `socket-${name}`;
  }

  root.add(sockets.root);
  sockets.root.add(sockets.footL, sockets.footR);
  sockets.footL.position.set(-0.18 * size, 0, 0);
  sockets.footR.position.set(0.18 * size, 0, 0);

  const legHeight = 0.58 * size;
  const legRadius = 0.1 * size;
  const legGeo = new THREE.CapsuleGeometry(legRadius, legHeight, 4, 8);
  const leftLeg = mesh(legGeo, bodyColor, 'legL');
  leftLeg.position.y = legHeight / 2 + legRadius;
  sockets.footL.add(leftLeg);

  const rightLeg = mesh(legGeo, bodyColor, 'legR');
  rightLeg.position.y = legHeight / 2 + legRadius;
  sockets.footR.add(rightLeg);

  sockets.root.add(sockets.spine);
  sockets.spine.position.y = legHeight + legRadius * 2;

  const torso = mesh(new THREE.BoxGeometry(0.45 * size, 0.62 * size, 0.28 * size), bodyColor, 'torso');
  torso.position.y = 0.31 * size;
  sockets.spine.add(torso);

  sockets.spine.add(sockets.head);
  sockets.head.position.y = 0.68 * size;
  const head = mesh(new THREE.BoxGeometry(0.3 * size, 0.3 * size, 0.3 * size), headColor, 'head');
  head.position.y = 0.14 * size;
  sockets.head.add(head);

  sockets.spine.add(sockets.handL, sockets.handR);
  sockets.handL.position.set(-0.34 * size, 0.45 * size, 0);
  sockets.handR.position.set(0.34 * size, 0.45 * size, 0);

  const armGeo = new THREE.CapsuleGeometry(0.08 * size, 0.35 * size, 4, 8);
  const leftArm = mesh(armGeo, bodyColor, 'armL');
  leftArm.position.y = -0.2 * size;
  sockets.handL.add(leftArm);

  const rightArm = mesh(armGeo, bodyColor, 'armR');
  rightArm.position.y = -0.2 * size;
  sockets.handR.add(rightArm);

  if (params.hasWeapon) {
    const weapon = mesh(new THREE.BoxGeometry(0.06 * size, 0.5 * size, 0.06 * size), 0xaaaaaa, 'weapon');
    weapon.position.set(0, -0.35 * size, 0.08 * size);
    sockets.handR.add(weapon);
  }

  root.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(root);

  const rig: Rig = { root, sockets, bbox };
  const validation = validateRig(rig);
  if (!validation.ok) {
    throw new Error(`humanoid rig missing sockets: ${validation.missing.join(', ')}`);
  }

  return rig;
}
