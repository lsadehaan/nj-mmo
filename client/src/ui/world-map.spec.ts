import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountWorldMap, renderWorldMap } from './world-map';
import {
  bindGlobalHotkeys,
  initWindowManagerRegistry,
  isPanelOpen,
  registerPanel,
  unbindGlobalHotkeys,
} from './window-manager';
import { mountInventoryWindow } from './inventory-window';

function pressKey(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('world-map', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    unbindGlobalHotkeys();
  });

  it('UI28-44: world map shows 6 zone labels', () => {
    mountWorldMap();
    renderWorldMap(true);
    expect(document.querySelectorAll('[data-role="zone-label"]').length).toBe(6);
  });

  it('UI28-46: inventory hotkey works after world map closes', () => {
    initWindowManagerRegistry();
    registerPanel('inventory-window', { mount: mountInventoryWindow, hotkey: 'I' });
    registerPanel('world-map', { mount: mountWorldMap });
    bindGlobalHotkeys();
    pressKey('m');
    expect(isPanelOpen('world-map')).toBe(true);
    pressKey('m');
    expect(isPanelOpen('world-map')).toBe(false);
    pressKey('i');
    expect(isPanelOpen('inventory-window')).toBe(true);
  });
});
