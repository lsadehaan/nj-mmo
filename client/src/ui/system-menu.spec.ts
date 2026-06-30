import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountSystemMenu } from './system-menu';
import { hideCharacterSelect, mountCharacterSelect } from './character-select';
import { createMockAudioBackend, isOneShotCall } from '../audio/audio-backend';
import { createAudioManager } from '../audio/audio-manager';

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

  it('AUD29-30: music volume slider exists 0-100', () => {
    mountSystemMenu({});
    const slider = document.querySelector('[data-role="music-volume"]') as HTMLInputElement;
    expect(slider).not.toBeNull();
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('100');
  });

  it('AUD29-32: sfx volume and mute controls exist', () => {
    mountSystemMenu({});
    expect(document.querySelector('[data-role="sfx-volume"]')).not.toBeNull();
    expect(document.querySelector('[data-role="audio-mute"]')).not.toBeNull();
  });

  it('AUD29-31: music slider at 50 calls setMusicVolume 0.5', () => {
    const mock = createMockAudioBackend();
    const mgr = createAudioManager({ backend: mock.backend });
    const setMusicSpy = vi.spyOn(mgr, 'setMusicVolume');
    mountSystemMenu({
      onAudioSettingsChange: (settings) => mgr.applySettings(settings),
    });
    const slider = document.querySelector('[data-role="music-volume"]') as HTMLInputElement;
    slider.value = '50';
    slider.dispatchEvent(new Event('input'));
    expect(setMusicSpy).toHaveBeenCalledWith(0.5);
  });

  it('AUD29-29: menu action click plays ui click before handler', () => {
    const mock = createMockAudioBackend();
    const mgr = createAudioManager({ backend: mock.backend });
    const order: string[] = [];
    mountSystemMenu({
      onUiClick: () => {
        order.push('click');
        mgr.playUiClick();
      },
      onInventory: () => order.push('handler'),
    });
    (document.querySelector('[data-action="inventory"]') as HTMLButtonElement).click();
    expect(mock.calls.some((c) => isOneShotCall(c) && c.id === 'sfx_ui_click')).toBe(true);
    expect(order).toEqual(['click', 'handler']);
  });
});
