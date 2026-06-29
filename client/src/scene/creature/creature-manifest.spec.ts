import { describe, it, expect } from 'vitest';
import {
  getCreatureEntry,
  QUATERNIUS_DEER_CLIP_MAP,
  QUATERNIUS_FLYING_CLIP_MAP,
  QUATERNIUS_WOLF_CLIP_MAP,
  ULTIMATE_BIG_MONSTER_CLIP_MAP,
  ULTIMATE_MONSTER_CLIP_MAP,
} from './creature-manifest';
import type { AnimationClip } from '@nj/game-core';

const CLIP_KEYS: AnimationClip[] = ['idle', 'move', 'attack', 'cast', 'die'];
const SEEDED_NPC_IDS = [
  20001, 20003, 20120, 20481,
  20432, 20544, 20442, 20121, 20130,
  20131, 20006, 20326, 20132, 20343, 20093, 20096, 20098, 20342,
  20016, 20101, 20103, 20106, 20108,
] as const;

const PHASE16_NPC_IDS = [20432, 20544, 20442, 20121, 20130] as const;
const PHASE22_BIG_ORC_IDS = [20131, 20006, 20093, 20096, 20098, 20343, 20342] as const;
const PHASE22_FLYING_IDS = [20016, 20103, 20106, 20108] as const;

describe('creature-manifest', () => {
  it.each(SEEDED_NPC_IDS)('returns a full entry for seeded npcId %i (BEST22-23)', (npcId) => {
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

  it('returns null for unknown npcId (BEST22-24)', () => {
    expect(getCreatureEntry(99999)).toBeNull();
  });

  it('maps Ultimate Monsters bipeds to Ultimate clip map and quadrupeds to Quaternius families', () => {
    expect(getCreatureEntry(20001)?.clipMap).toEqual(ULTIMATE_MONSTER_CLIP_MAP);
    expect(getCreatureEntry(20003)?.clipMap).toEqual(ULTIMATE_MONSTER_CLIP_MAP);
    expect(getCreatureEntry(20120)?.clipMap).toEqual(QUATERNIUS_WOLF_CLIP_MAP);
    expect(getCreatureEntry(20481)?.clipMap).toEqual(QUATERNIUS_DEER_CLIP_MAP);
  });

  it('maps Phase 16 mobs to ULTIMATE_BIG_MONSTER_CLIP_MAP', () => {
    for (const npcId of PHASE16_NPC_IDS) {
      expect(getCreatureEntry(npcId)?.clipMap).toEqual(ULTIMATE_BIG_MONSTER_CLIP_MAP);
    }
  });

  it('maps Phase 22 orc-tier mobs to ULTIMATE_BIG_MONSTER_CLIP_MAP', () => {
    for (const npcId of PHASE22_BIG_ORC_IDS) {
      expect(getCreatureEntry(npcId)?.clipMap).toEqual(ULTIMATE_BIG_MONSTER_CLIP_MAP);
    }
  });

  it('maps Phase 22 flying mobs to QUATERNIUS_FLYING_CLIP_MAP', () => {
    for (const npcId of PHASE22_FLYING_IDS) {
      expect(getCreatureEntry(npcId)?.clipMap).toEqual(QUATERNIUS_FLYING_CLIP_MAP);
    }
  });

  it('assigns a unique model path per seeded npcId (BEST22-26)', () => {
    const models = SEEDED_NPC_IDS.map((id) => getCreatureEntry(id)?.model);
    expect(new Set(models).size).toBe(SEEDED_NPC_IDS.length);
  });
});
