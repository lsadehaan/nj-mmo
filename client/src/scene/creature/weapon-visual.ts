import * as THREE from 'three';
import { attachToBone, detachProp } from './attachment';
import { getWeaponAttachment } from './weapon-manifest';
import { loadGltfTemplate } from './mesh-character';

export interface WeaponVisualState {
  equippedItemId: number;
  prop: THREE.Object3D | null;
  loading: Promise<void> | null;
}

export function createWeaponVisualState(): WeaponVisualState {
  return { equippedItemId: 0, prop: null, loading: null };
}

export function syncWeaponVisual(
  root: THREE.Object3D,
  itemId: number,
  state: WeaponVisualState
): void {
  if (itemId === state.equippedItemId) return;

  if (state.prop) {
    detachProp(state.prop);
    state.prop = null;
  }
  state.equippedItemId = itemId;

  const entry = itemId > 0 ? getWeaponAttachment(itemId) : null;
  if (!entry) return;

  state.loading = loadGltfTemplate(entry.model)
    .then((template) => {
      if (state.equippedItemId !== itemId) return;
      const prop = template.scene.clone(true);
      prop.name = `weapon-${itemId}`;
      if (!attachToBone(root, prop, entry.bone, entry.transform)) {
        detachProp(prop);
        return;
      }
      state.prop = prop;
    })
    .catch((err) => {
      console.warn(`weapon prop load failed for item ${itemId}:`, err);
    })
    .finally(() => {
      state.loading = null;
    });
}
