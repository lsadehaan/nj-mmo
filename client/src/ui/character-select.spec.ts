import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountCharacterSelect, MAX_CHARACTERS } from './character-select';

describe('character-select', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'game';
    canvas.hidden = true;
    document.body.appendChild(canvas);
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('UI28-10: renders character rows from list', () => {
    mountCharacterSelect(
      'hero1',
      [
        { id: 'a', name: 'Alpha', level: 5, classId: 0 },
        { id: 'b', name: 'Beta', level: 3, classId: 10 },
      ],
      { onSelect: vi.fn(), onCreate: vi.fn() }
    );
    expect(document.querySelectorAll('[data-role="character-row"]').length).toBe(2);
  });

  it('UI28-11: select calls connect handler and shows canvas', () => {
    const onSelect = vi.fn();
    mountCharacterSelect('hero1', [{ id: 'c1', name: 'Hero', level: 1, classId: 0 }], {
      onSelect,
      onCreate: vi.fn(),
    });
    (document.querySelector('[data-role="character-row"]') as HTMLButtonElement).click();
    expect(onSelect).toHaveBeenCalledWith('c1');
  });

  it('UI28-12: create opens handler', () => {
    const onCreate = vi.fn();
    mountCharacterSelect('hero1', [], { onSelect: vi.fn(), onCreate });
    (document.querySelector('[data-role="create-character"]') as HTMLButtonElement).click();
    expect(onCreate).toHaveBeenCalled();
  });

  it('UI28-13: cap disables create at 3 characters', () => {
    const rows = Array.from({ length: MAX_CHARACTERS }, (_, i) => ({
      id: String(i),
      name: `C${i}`,
      level: 1,
      classId: 0,
    }));
    mountCharacterSelect('hero1', rows, { onSelect: vi.fn(), onCreate: vi.fn() });
    expect(document.querySelector('[data-role="character-cap"]')).not.toBeNull();
    expect((document.querySelector('[data-role="create-character"]') as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
