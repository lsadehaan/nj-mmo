import { describe, it, expect } from 'vitest';
import { getSkillInfo, getItemInfo } from './game-catalog';

describe('game-catalog', () => {
  it('returns real names + descriptions for known skills (hover info)', () => {
    const power = getSkillInfo(3);
    expect(power.name).toBe('Power Strike');
    expect(power.description.length).toBeGreaterThan(0);

    expect(getSkillInfo(1177).name).toBe('Wind Strike');
    expect(getSkillInfo(1068).name).toBe('Might');
  });

  it('returns real names + descriptions for known items (hover info)', () => {
    expect(getItemInfo(2369).name).toBe("Squire's Sword");
    expect(getItemInfo(1060).name).toBe('Healing Potion');
    expect(getItemInfo(57).name).toBe('Adena');
    expect(getItemInfo(2369).description.length).toBeGreaterThan(0);
  });

  it('falls back to a generic label so a tooltip always has content', () => {
    const skill = getSkillInfo(999999);
    expect(skill.name).toBe('Skill 999999');
    expect(skill.description.length).toBeGreaterThan(0);

    const item = getItemInfo(888888);
    expect(item.name).toBe('Item 888888');
    expect(item.description.length).toBeGreaterThan(0);
  });
});
