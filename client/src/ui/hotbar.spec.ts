import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountHotbar, renderHotbar, getHotbarHotkeys } from './hotbar';

describe('skill hotbar DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('maps keys 2–4 to hotbar slots (SKILL20-47)', () => {
    expect(getHotbarHotkeys()).toEqual(['2', '3', '4']);
  });

  it('renders icons for knownSkillIds and wires click to useSkill (SKILL20-49)', () => {
    const onUseSkill = vi.fn();
    mountHotbar();
    renderHotbar({
      knownSkillIds: [3, 1177],
      skillCooldownEndMs: [0, 0],
      handlers: { onUseSkill },
    });

    const slots = document.querySelectorAll('#skill-hotbar [data-skill-id]');
    expect(slots.length).toBe(2);
    expect(slots[0]?.getAttribute('data-skill-id')).toBe('3');
    expect(slots[1]?.getAttribute('data-skill-id')).toBe('1177');
    expect(slots[0]?.querySelector('img[data-icon-skill-id="3"]')).not.toBeNull();

    (slots[0] as HTMLButtonElement).click();
    expect(onUseSkill).toHaveBeenCalledWith(3);
  });

  it('shows the skill name + description on hover (was blank before)', () => {
    mountHotbar();
    renderHotbar({
      knownSkillIds: [3],
      skillCooldownEndMs: [0],
      handlers: { onUseSkill: vi.fn() },
    });

    const slot = document.querySelector('#skill-hotbar [data-skill-id="3"]') as HTMLButtonElement;
    slot.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 50, clientY: 50 }));

    const tip = document.getElementById('game-tooltip');
    expect(tip?.hidden).toBe(false);
    expect(tip?.querySelector('[data-role="tooltip-title"]')?.textContent).toContain('Power Strike');
    expect(tip?.querySelector('[data-role="tooltip-body"]')?.textContent).toContain('melee');
  });

  it('shows cooldown overlay when skill reuse active (SKILL20-48)', () => {
    const now = 10_000;
    mountHotbar();
    renderHotbar({
      knownSkillIds: [3],
      skillCooldownEndMs: [13_000],
      nowMs: now,
      handlers: { onUseSkill: vi.fn() },
    });

    const slot = document.querySelector('#skill-hotbar [data-skill-id="3"]') as HTMLButtonElement;
    expect(slot.disabled).toBe(true);
    expect(slot.querySelector('[data-role="cooldown-fill"]')).not.toBeNull();
  });
});
