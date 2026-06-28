import { describe, it, expect } from 'vitest';
import {
  getCreatureEntry,
  QUATERNIUS_DEER_CLIP_MAP,
  QUATERNIUS_WOLF_CLIP_MAP,
} from './creature-manifest';
import { KAYKIT_CLIP_MAP } from './mesh-character';
import type { AnimationClip } from '@nj/game-core';

const CLIP_KEYS: AnimationClip[] = ['idle', 'move', 'attack', 'cast', 'die'];
const SEEDED_NPC_IDS = [20001, 20003, 20120, 20481] as const;

describe('creature-manifest', () => {
  it.each(SEEDED_NPC_IDS)('returns a full entry for seeded npcId %i', (npcId) => {
    const entry = getCreatureEntry(npcId);
    expect(entry).not.toBeNull();
    if (!entry) return;

    expect(entry.model).toMatch(/^\/models\/monsters\/.+\.glb$/);
    expect(entry.scale).toBeGreaterThan(0);
    expect(entry.feetOffsetY).toBeGreaterThanOrEqual(0);
    expect(entry.hpBarYOffset).toBeGreaterThan(0);

    for (const key of CLIP_KEYS) {
      expect(entry.clipMap[key]).toBeTruthy();
    }
  });

  it('returns null for unknown npcId (capsule fallback)', () => {
    expect(getCreatureEntry(99999)).toBeNull();
  });

  it('maps bipeds to KayKit clip names and quadrupeds to Quaternius families', () => {
    expect(getCreatureEntry(20001)?.clipMap).toEqual(KAYKIT_CLIP_MAP);
    expect(getCreatureEntry(20003)?.clipMap).toEqual(KAYKIT_CLIP_MAP);
    expect(getCreatureEntry(20120)?.clipMap).toEqual(QUATERNIUS_WOLF_CLIP_MAP);
    expect(getCreatureEntry(20481)?.clipMap).toEqual(QUATERNIUS_DEER_CLIP_MAP);
  });
});
