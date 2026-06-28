import { describe, it, expect } from 'vitest';
import { EntityAction } from '@nj/game-core';
import {
  countLevelUps,
  detectActionEdge,
  detectHpHit,
  detectLevelUp,
} from './vfx-triggers';

describe('vfx-triggers', () => {
  it('detectHpHit fires once for [41,24,24] and on kill tick [41,0]', () => {
    expect(detectHpHit(41, 24)).toBe(true);
    expect(detectHpHit(24, 24)).toBe(false);
    expect(detectHpHit(41, 0)).toBe(true);
    expect(detectHpHit(0, 0)).toBe(false);
  });

  it('detectLevelUp is true only when level increases', () => {
    expect(detectLevelUp(1, 2)).toBe(true);
    expect(detectLevelUp(2, 2)).toBe(false);
    expect(countLevelUps(1, 3)).toBe(2);
  });

  it('detectActionEdge fires on cast seq bump only', () => {
    expect(
      detectActionEdge(EntityAction.None, 0, EntityAction.Cast, 1, 'cast')
    ).toBe(true);
    expect(
      detectActionEdge(EntityAction.Cast, 1, EntityAction.Cast, 1, 'cast')
    ).toBe(false);
    expect(
      detectActionEdge(EntityAction.None, 0, EntityAction.Attack, 1, 'cast')
    ).toBe(false);
  });
});
