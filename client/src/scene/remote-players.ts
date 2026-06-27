import * as THREE from 'three';

export type RemotePlayerMeshMap = Map<string, THREE.Mesh>;

const REMOTE_PLAYER_COLOR = 0xcc6633;

export function createRemotePlayerMesh(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1, 4, 8),
    new THREE.MeshLambertMaterial({ color: REMOTE_PLAYER_COLOR, flatShading: true })
  );
}

export function upsertRemotePlayer(
  map: RemotePlayerMeshMap,
  sessionId: string,
  x: number,
  y: number,
  z: number,
  scene: THREE.Scene
): THREE.Mesh {
  let mesh = map.get(sessionId);
  if (!mesh) {
    mesh = createRemotePlayerMesh();
    scene.add(mesh);
    map.set(sessionId, mesh);
  }
  mesh.position.set(x, y, z);
  return mesh;
}

export function removeRemotePlayer(
  map: RemotePlayerMeshMap,
  sessionId: string,
  scene: THREE.Scene
): void {
  const mesh = map.get(sessionId);
  if (!mesh) return;
  scene.remove(mesh);
  map.delete(sessionId);
}

export function listRemotePlayers(
  map: RemotePlayerMeshMap
): { id: string; x: number; y: number; z: number }[] {
  return [...map.entries()].map(([id, mesh]) => ({
    id,
    x: mesh.position.x,
    y: mesh.position.y,
    z: mesh.position.z,
  }));
}
