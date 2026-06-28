import type { GripTransform } from './attachment';

export interface WeaponAttachmentEntry {
  model: string;
  bone: string;
  transform: GripTransform;
}

/**
 * KayKit Adventurers rig (Rogue.glb ingest): right-hand attachment slot.
 * GLB nodes are named `handslot.r`; Three.js GLTFLoader strips dots → `handslotr`.
 */
export const KAYKIT_RIGHT_HAND_BONE = 'handslotr';

const WEAPON_ATTACHMENTS: Record<number, WeaponAttachmentEntry> = {
  2369: {
    model: '/models/props/SquiresSword.glb',
    bone: KAYKIT_RIGHT_HAND_BONE,
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1,
    },
  },
};

export const GOBLIN_CLUB_ATTACHMENT: WeaponAttachmentEntry = {
  model: '/models/props/GoblinClub.glb',
  bone: KAYKIT_RIGHT_HAND_BONE,
  transform: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
  },
};

export function getWeaponAttachment(itemId: number): WeaponAttachmentEntry | null {
  return WEAPON_ATTACHMENTS[itemId] ?? null;
}
