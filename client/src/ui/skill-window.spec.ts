import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountSkillWindow, renderSkillWindow } from './skill-window';

describe('skill-window', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('UI28-24: renders known skills with icons', () => {
    mountSkillWindow();
    renderSkillWindow({ knownSkillIds: [3, 1177], skillCooldownEndMs: [0, 0], sp: 0, visible: true });
    expect(document.querySelectorAll('[data-skill-id]').length).toBe(2);
    expect(document.querySelector('[data-skill-id="3"] img')).not.toBeNull();
  });

  it('UI28-25: shows SP balance', () => {
    renderSkillWindow({ knownSkillIds: [], skillCooldownEndMs: [], sp: 120, visible: true });
    expect(document.querySelector('[data-role="sp-balance"]')?.textContent).toBe('SP: 120');
  });

  it('UI28-26: cooldown overlay when remaining > 0', () => {
    renderSkillWindow({
      knownSkillIds: [3],
      skillCooldownEndMs: [15_000],
      sp: 0,
      nowMs: 10_000,
      visible: true,
    });
    expect(document.querySelector('[data-role="skill-cooldown"]')).not.toBeNull();
  });

  it('UI28-27: click invokes useSkill hook', () => {
    const onUseSkill = vi.fn();
    renderSkillWindow({
      knownSkillIds: [3],
      skillCooldownEndMs: [0],
      sp: 0,
      onUseSkill,
      visible: true,
    });
    (document.querySelector('[data-skill-id="3"]') as HTMLButtonElement).click();
    expect(onUseSkill).toHaveBeenCalledWith(3);
  });

  it('UI28-28: empty state', () => {
    renderSkillWindow({ knownSkillIds: [], skillCooldownEndMs: [], sp: 0, visible: true });
    expect(document.querySelector('[data-role="skills-empty"]')).not.toBeNull();
  });
});
