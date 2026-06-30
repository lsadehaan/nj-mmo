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

  it('shows the mob level next to its name when known', () => {
    renderTargetFrame({
      mob: { id: 'm1', name: 'Gremlin', level: 1, hp: 50, maxHp: 100 },
    });
    const name = document.querySelector('[data-role="target-name"]')?.textContent ?? '';
    expect(name).toContain('Lv.1');
    expect(name).toContain('Gremlin');
  });

  it('omits the level chip when level is unknown', () => {
    renderTargetFrame({
      mob: { id: 'm1', name: 'Gremlin', hp: 50, maxHp: 100 },
    });
    expect(document.querySelector('[data-role="target-level"]')).toBeNull();
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

  it('UI28-57: player ToT shows mob name', () => {
    renderTargetFrame({
      player: {
        sessionId: 's1',
        name: 'Hunter',
        hp: 80,
        maxHp: 100,
        targetMobName: 'Gremlin',
      },
    });
    expect(document.getElementById('target-of-target')?.textContent).toContain('Gremlin');
  });

  it('UI28-38: context invite fires __partyInvite__', () => {
    const invited: string[] = [];
    window.__partyInvite__ = (targetSessionId) => invited.push(targetSessionId);
    renderTargetFrame({
      player: {
        sessionId: 'peer-1',
        name: 'Ally',
        hp: 100,
        maxHp: 100,
      },
    });
    document
      .querySelector('[data-action="invite"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(invited).toEqual(['peer-1']);
  });
});
