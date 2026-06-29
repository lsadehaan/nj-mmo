import { describe, it, expect } from 'vitest';
import { isValidMoveIntent } from './validate-move-intent';
import { WORLD_MIN, WORLD_MAX } from './world-constants';

describe('isValidMoveIntent', () => {
  it('accepts finite coordinates within world bounds', () => {
    expect(isValidMoveIntent(0, 0)).toBe(true);
    expect(isValidMoveIntent(WORLD_MIN, WORLD_MAX)).toBe(true);
    expect(isValidMoveIntent(WORLD_MAX, WORLD_MIN)).toBe(true);
  });

  it('rejects NaN coordinates', () => {
    expect(isValidMoveIntent(Number.NaN, 0)).toBe(false);
    expect(isValidMoveIntent(0, Number.NaN)).toBe(false);
  });

  it('rejects Infinity coordinates', () => {
    expect(isValidMoveIntent(Number.POSITIVE_INFINITY, 0)).toBe(false);
    expect(isValidMoveIntent(0, Number.NEGATIVE_INFINITY)).toBe(false);
  });

  it('rejects x outside world bounds', () => {
    expect(isValidMoveIntent(WORLD_MIN - 1, 0)).toBe(false);
    expect(isValidMoveIntent(WORLD_MAX + 1, 0)).toBe(false);
  });

  it('rejects z outside world bounds', () => {
    expect(isValidMoveIntent(0, WORLD_MIN - 1)).toBe(false);
    expect(isValidMoveIntent(0, WORLD_MAX + 1)).toBe(false);
  });

  it('accepts in-bounds intent at edge minus margin (TIW23-06)', () => {
    expect(isValidMoveIntent(300, 0)).toBe(true);
    expect(isValidMoveIntent(320, 0)).toBe(false);
  });
});
