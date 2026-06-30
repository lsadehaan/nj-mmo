import { describe, it, expect, beforeEach } from 'vitest';
import { mountTargetFrame, renderTargetFrame } from './target-frame';

describe('target-frame', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('UI28-54: mob target shows name and HP bar', () => {
    renderTargetFrame({
      mob: { id: 'm1', name: 'Gremlin', hp: 50, maxHp: 100 },
    });
    expect(document.getElementById('target-frame')?.hidden).toBe(false);
    expect(document.querySelector('[data-role="target-name"]')?.textContent).toContain('Gremlin');
    expect(document.querySelector('[data-role="target-hp-bar"]')).not.toBeNull();
  });

  it('UI28-55: mob ToT shows player name', () => {
    renderTargetFrame({
      mob: {
        id: 'm1',
        name: 'Gremlin',
        hp: 50,
        maxHp: 100,
        aggroTargetName: 'Hero',
      },
    });
    expect(document.getElementById('target-of-target')?.textContent).toContain('Hero');
  });

  it('UI28-56: player target shows pvp flag', () => {
    renderTargetFrame({
      player: {
        sessionId: 's1',
        name: 'Rival',
        hp: 80,
        maxHp: 100,
        pvpFlag: 1,
        karma: 0,
      },
    });
    expect(document.querySelector('[data-pvp-flag]')).not.toBeNull();
  });
});
