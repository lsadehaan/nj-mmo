import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSkillIconPath } from '../ui/icon-manifest';
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

  it('includes Power Strike skill icon with data-icon-skill-id 3', () => {
    mountPowerStrikeCooldown();
    const img = document.querySelector(
      '#power-strike-cooldown img[data-icon-skill-id="3"]'
    ) as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.alt).toBe('Power Strike');
    expect(img?.src).toContain(getSkillIconPath(3));
  });

  it('keeps cooldown fill overlay above the icon and updates height ratio', () => {
    const el = mountPowerStrikeCooldown();
    const fill = el.querySelector<HTMLElement>('[data-role="fill"]');
    const img = el.querySelector('img');
    expect(fill).not.toBeNull();
    expect(img).not.toBeNull();
    expect(Number(fill?.style.zIndex)).toBeGreaterThan(Number(img?.style.zIndex));

    updatePowerStrikeCooldown(23_000, 20_000);
    expect(fill?.style.height).toBe('100%');
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

  it('does not duplicate skill icon on second mount', () => {
    mountPowerStrikeCooldown();
    mountPowerStrikeCooldown();
    const icons = document.querySelectorAll('#power-strike-cooldown img[data-icon-skill-id="3"]');
    expect(icons.length).toBe(1);
  });

  it('exports reuse duration for fill ratio', () => {
    expect(POWER_STRIKE_REUSE_MS).toBe(3_000);
  });
});
