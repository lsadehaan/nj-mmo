import * as THREE from 'three';

export function countTaggedVfx(scene: THREE.Scene, tag: string): number {
  let count = 0;
  scene.traverse((obj) => {
    if (obj.userData.vfxTag === tag) count += 1;
  });
  return count;
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
      obj.geometry?.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  });
}

export interface VfxPool<T> {
  readonly size: number;
  acquire(): T;
  release(item: T): void;
  activeCount(): number;
}

export function createPool<T>(size: number, factory: (index: number) => T): VfxPool<T> {
  const slots: Array<{ item: T; active: boolean; order: number }> = [];
  for (let i = 0; i < size; i++) {
    slots.push({ item: factory(i), active: false, order: 0 });
  }
  let seq = 0;

  return {
    size,
    acquire() {
      const idle = slots.find((s) => !s.active);
      const slot = idle ?? slots.reduce((a, b) => (a.order < b.order ? a : b));
      slot.active = true;
      slot.order = ++seq;
      return slot.item;
    },
    release(item: T) {
      const slot = slots.find((s) => s.item === item);
      if (slot) slot.active = false;
    },
    activeCount() {
      return slots.filter((s) => s.active).length;
    },
  };
}

export interface TimedVfxEntry {
  root: THREE.Object3D;
  spawnedAtMs: number;
  expiresAtMs: number;
  tag: string;
  onExpire?: () => void;
  tick?: (elapsedMs: number, nowMs: number) => void;
}

export function tickActiveVfx(
  scene: THREE.Scene,
  entries: TimedVfxEntry[],
  nowMs: number
): TimedVfxEntry[] {
  const remaining: TimedVfxEntry[] = [];
  for (const entry of entries) {
    if (entry.tick) {
      entry.tick(nowMs - entry.spawnedAtMs, nowMs);
    }
    if (nowMs >= entry.expiresAtMs) {
      scene.remove(entry.root);
      disposeObject3D(entry.root);
      entry.onExpire?.();
    } else {
      remaining.push(entry);
    }
  }
  return remaining;
}
