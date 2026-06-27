import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountPlayerVitalsHud, updatePlayerVitalsHud } from './player-vitals';

describe('player vitals HUD', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts #player-vitals-hud with level, hp, and mp rows', () => {
    mountPlayerVitalsHud();
    const hud = document.getElementById('player-vitals-hud');
    expect(hud).not.toBeNull();
    expect(hud?.querySelector('[data-role="level"]')).not.toBeNull();
    expect(hud?.querySelector('[data-role="hp"]')).not.toBeNull();
    expect(hud?.querySelector('[data-role="mp"]')).not.toBeNull();
  });

  it('shows Lv.2 after server level sync', () => {
    updatePlayerVitalsHud({ level: 2, hp: 112, maxHp: 112, mp: 55, maxMp: 55 });
    const levelText = document.querySelector('#player-vitals-hud [data-role="level"]')?.textContent;
    expect(levelText).toBe('Lv.2');
  });

  it('shows hp and mp as current/max from server snapshots', () => {
    updatePlayerVitalsHud({ level: 2, hp: 80, maxHp: 112, mp: 40, maxMp: 55 });
    expect(document.querySelector('#player-vitals-hud [data-role="hp"]')?.textContent).toBe(
      'HP 80/112'
    );
    expect(document.querySelector('#player-vitals-hud [data-role="mp"]')?.textContent).toBe(
      'MP 40/55'
    );
  });
});
