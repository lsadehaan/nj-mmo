import { describe, it, expect } from 'vitest';
import {
  getWeaponAttachment,
  GOBLIN_CLUB_ATTACHMENT,
  KAYKIT_RIGHT_HAND_BONE,
} from './weapon-manifest';

describe('weapon-manifest', () => {
  it('returns Squire Sword entry for item 2369', () => {
    const entry = getWeaponAttachment(2369);
    expect(entry).toEqual({
      model: '/models/props/SquiresSword.glb',
      bone: KAYKIT_RIGHT_HAND_BONE,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
    });
  });

  it('returns null for unmapped weapon ids', () => {
    expect(getWeaponAttachment(9999)).toBeNull();
  });

  it('exports Goblin club attachment on the KayKit hand bone', () => {
    expect(GOBLIN_CLUB_ATTACHMENT.model).toBe('/models/props/GoblinClub.glb');
    expect(GOBLIN_CLUB_ATTACHMENT.bone).toBe(KAYKIT_RIGHT_HAND_BONE);
  });
});
