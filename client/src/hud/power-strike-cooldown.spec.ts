import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mountPowerStrikeCooldown,
  updatePowerStrikeCooldown,
  POWER_STRIKE_REUSE_MS,
} from './power-strike-cooldown';

describe('power-strike-cooldown HUD', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts a DOM element with id power-strike-cooldown', () => {
    const el = mountPowerStrikeCooldown();
    expect(el.id).toBe('power-strike-cooldown');
    expect(document.getElementById('power-strike-cooldown')).toBe(el);
  });

  it('sets data-remaining-ms above zero while server cooldown is active', () => {
    const el = mountPowerStrikeCooldown();
    const now = 20_000;
    updatePowerStrikeCooldown(23_000, now);
    expect(Number(el.getAttribute('data-remaining-ms'))).toBeGreaterThan(0);
    expect(Number(el.getAttribute('data-remaining-ms'))).toBe(3_000);
  });

  it('sets data-remaining-ms to zero when cooldown has expired', () => {
    const el = mountPowerStrikeCooldown();
    updatePowerStrikeCooldown(5_000, 10_000);
    expect(el.getAttribute('data-remaining-ms')).toBe('0');
  });

  it('exports reuse duration for fill ratio', () => {
    expect(POWER_STRIKE_REUSE_MS).toBe(3_000);
  });
});
