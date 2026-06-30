import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountSystemMenu } from './system-menu';
import { hideCharacterSelect, mountCharacterSelect } from './character-select';

describe('system-menu', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('UI28-52: menu has required action buttons', () => {
    mountSystemMenu({});
    expect(document.querySelector('[data-action="inventory"]')).not.toBeNull();
    expect(document.querySelector('[data-action="skills"]')).not.toBeNull();
    expect(document.querySelector('[data-action="quest-log"]')).not.toBeNull();
    expect(document.querySelector('[data-action="world-map"]')).not.toBeNull();
    expect(document.querySelector('[data-action="logout"]')).not.toBeNull();
  });

  it('UI28-53: logout returns to character select', () => {
    const canvas = document.createElement('canvas');
    canvas.id = 'game';
    document.body.appendChild(canvas);
    mountCharacterSelect('hero1', [], { onSelect: vi.fn(), onCreate: vi.fn() });
    document.getElementById('character-select-screen')!.hidden = true;

    mountSystemMenu({
      onLogout: () => {
        hideCharacterSelect();
        mountCharacterSelect('hero1', [], { onSelect: vi.fn(), onCreate: vi.fn() });
        canvas.hidden = true;
      },
    });
    (document.querySelector('[data-action="logout"]') as HTMLButtonElement).click();
    expect(document.getElementById('character-select-screen')).not.toBeNull();
    expect(canvas.hidden).toBe(true);
  });
});
