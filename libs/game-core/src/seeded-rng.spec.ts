import { describe, it, expect } from 'vitest';
import { createSeededRng } from './seeded-rng';

describe('createSeededRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const seqA = [a.nextFloat(), a.nextFloat(), a.nextFloat()];
    const seqB = [b.nextFloat(), b.nextFloat(), b.nextFloat()];
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(a.nextFloat()).not.toBe(b.nextFloat());
  });

  it('nextFloat returns values in [0, 1)', () => {
    const rng = createSeededRng(99);
    for (let i = 0; i < 100; i++) {
      const value = rng.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('nextInt returns inclusive bounds', () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 200; i++) {
      const value = rng.nextInt(13, 30);
      expect(value).toBeGreaterThanOrEqual(13);
      expect(value).toBeLessThanOrEqual(30);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('nextDamageOffset stays within ±randomDamage', () => {
    const rng = createSeededRng(12345);
    for (let i = 0; i < 200; i++) {
      const offset = rng.nextDamageOffset(10);
      expect(offset).toBeGreaterThanOrEqual(-10);
      expect(offset).toBeLessThanOrEqual(10);
      expect(Number.isInteger(offset)).toBe(true);
    }
  });

  it('advances state across mixed calls deterministically', () => {
    const rng = createSeededRng(2024);
    const snapshot = [
      rng.nextFloat(),
      rng.nextInt(1, 6),
      rng.nextDamageOffset(10),
      rng.nextFloat(),
    ];
    const replay = createSeededRng(2024);
    expect([
      replay.nextFloat(),
      replay.nextInt(1, 6),
      replay.nextDamageOffset(10),
      replay.nextFloat(),
    ]).toEqual(snapshot);
  });
});
