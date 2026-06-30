import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountPlayerVitalsHud, updatePlayerVitalsHud } from './player-vitals';

describe('player vitals HUD bars', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('UI28-59: mounts bar fills', () => {
    mountPlayerVitalsHud();
    expect(document.querySelector('[data-role="hp-fill"]')).not.toBeNull();
    expect(document.querySelector('[data-role="mp-fill"]')).not.toBeNull();
  });

  it('UI28-59: HP fill width matches ratio', () => {
    updatePlayerVitalsHud({ level: 2, hp: 80, maxHp: 100, mp: 40, maxMp: 50 });
    const fill = document.querySelector('[data-role="hp-fill"]') as HTMLElement;
    expect(parseFloat(fill.style.width)).toBe(80);
  });
});
