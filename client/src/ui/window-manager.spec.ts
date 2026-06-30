import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  bindGlobalHotkeys,
  initWindowManagerRegistry,
  isPanelOpen,
  openPanel,
  registerPanel,
  togglePanel,
  unbindGlobalHotkeys,
  setUiAudioHooks,
} from './window-manager';
import { createMockAudioBackend } from '../audio/audio-backend';
import { createAudioManager } from '../audio/audio-manager';
import { mountInventoryWindow } from './inventory-window';
import { mountSkillWindow } from './skill-window';
import { mountQuestLog } from './quest-log';
import { mountSystemMenu } from './system-menu';

function pressKey(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('window-manager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    unbindGlobalHotkeys();
    initWindowManagerRegistry();
    registerPanel('inventory-window', { mount: mountInventoryWindow, hotkey: 'I' });
    registerPanel('skill-window', { mount: mountSkillWindow, hotkey: 'K' });
    registerPanel('quest-log', { mount: mountQuestLog, hotkey: 'L', aliasHotkeys: ['Q'] });
    mountSystemMenu({});
    bindGlobalHotkeys();
  });

  afterEach(() => {
    unbindGlobalHotkeys();
    document.body.innerHTML = '';
  });

  it('UI28-01: mountUiShell and panel registry with data-panel-id', () => {
    expect(document.getElementById('ui-shell')).not.toBeNull();
    expect(document.getElementById('inventory-window')?.dataset['panelId']).toBe(
      'inventory-window'
    );
  });

  it('UI28-02: I toggles inventory window', () => {
    pressKey('i');
    expect(isPanelOpen('inventory-window')).toBe(true);
    pressKey('i');
    expect(isPanelOpen('inventory-window')).toBe(false);
  });

  it('UI28-03: K toggles skill window', () => {
    pressKey('k');
    expect(isPanelOpen('skill-window')).toBe(true);
  });

  it('UI28-04: L and Q toggle quest log', () => {
    pressKey('l');
    expect(isPanelOpen('quest-log')).toBe(true);
    pressKey('l');
    pressKey('q');
    expect(isPanelOpen('quest-log')).toBe(true);
  });

  it('UI28-05: Escape opens and dismisses system menu', () => {
    pressKey('Escape');
    expect(document.getElementById('system-menu')?.hidden).toBe(false);
    pressKey('Escape');
    expect(document.getElementById('system-menu')?.hidden).toBe(true);
  });

  it('UI28-06: open panel has panel chrome', () => {
    openPanel('inventory-window');
    const panel = document.getElementById('inventory-window')!;
    expect(panel.querySelector('[data-role="panel-title"]')).not.toBeNull();
    expect(panel.querySelector('[data-role="panel-close"]')).not.toBeNull();
  });

  it('UI28-07: system menu does not block canvas pointer events', () => {
    const canvas = document.createElement('canvas');
    canvas.id = 'game';
    document.body.appendChild(canvas);
    pressKey('Escape');
    const menu = document.getElementById('system-menu')!;
    expect(getComputedStyle(menu).pointerEvents).not.toBe('all');
    expect(menu.style.pointerEvents).not.toBe('all');
  });

  it('AUD29-27: open panel plays sfx_ui_open', () => {
    const mock = createMockAudioBackend();
    const mgr = createAudioManager({ backend: mock.backend });
    setUiAudioHooks({ onOpen: () => mgr.playUiOpen(), onClose: () => mgr.playUiClose() });
    openPanel('inventory-window');
    expect(mock.calls.some((c) => c.kind === 'oneShot' && c.id === 'sfx_ui_open')).toBe(true);
  });

  it('AUD29-28: close panel plays sfx_ui_close', () => {
    const mock = createMockAudioBackend();
    const mgr = createAudioManager({ backend: mock.backend });
    setUiAudioHooks({ onOpen: () => mgr.playUiOpen(), onClose: () => mgr.playUiClose() });
    openPanel('inventory-window');
    togglePanel('inventory-window');
    expect(mock.calls.some((c) => c.kind === 'oneShot' && c.id === 'sfx_ui_close')).toBe(true);
  });
});
