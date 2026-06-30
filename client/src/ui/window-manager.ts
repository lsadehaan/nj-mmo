import { getGameState } from '../test-hook';
import { attachPanelChrome } from './panel-chrome';
import { mountUiShell } from './ui-shell';

export interface PanelRegistration {
  mount: () => HTMLElement;
  hotkey?: string;
  aliasHotkeys?: string[];
  onOpen?: () => void;
  onClose?: () => void;
}

const panels = new Map<string, PanelRegistration>();
let hotkeysBound = false;
let systemMenuOpen = false;

export function registerPanel(id: string, registration: PanelRegistration): void {
  panels.set(id, registration);
  const el = registration.mount();
  el.dataset['panelId'] = id;
  if (!el.querySelector('[data-role="panel-title"]')) {
    const title = el.querySelector('h2')?.textContent ?? id;
    attachPanelChrome(el, title, () => closePanel(id));
  }
}

export function getPanelElement(id: string): HTMLElement | null {
  return panels.get(id)?.mount() ?? document.getElementById(id);
}

export function isPanelOpen(id: string): boolean {
  const el = getPanelElement(id);
  return el !== null && !el.hidden;
}

export function openPanel(id: string): void {
  const reg = panels.get(id);
  const el = reg?.mount();
  if (!el || !reg) return;
  el.hidden = false;
  reg.onOpen?.();
  publishUiState();
}

export function closePanel(id: string): void {
  const reg = panels.get(id);
  const el = reg?.mount();
  if (!el || !reg) return;
  el.hidden = true;
  reg.onClose?.();
  publishUiState();
}

export function togglePanel(id: string): boolean {
  if (isPanelOpen(id)) {
    closePanel(id);
    return false;
  }
  openPanel(id);
  return true;
}

export function closeAllExcept(exceptId?: string): void {
  for (const id of panels.keys()) {
    if (id !== exceptId) closePanel(id);
  }
  if (exceptId !== 'system-menu') {
    systemMenuOpen = false;
    const menu = document.getElementById('system-menu');
    if (menu) menu.hidden = true;
  }
  publishUiState();
}

export function bindGlobalHotkeys(): void {
  if (hotkeysBound) return;
  hotkeysBound = true;
  window.addEventListener('keydown', onGlobalKeydown);
}

export function unbindGlobalHotkeys(): void {
  if (!hotkeysBound) return;
  hotkeysBound = false;
  window.removeEventListener('keydown', onGlobalKeydown);
}

function onGlobalKeydown(ev: KeyboardEvent): void {
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) {
    return;
  }
  const key = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;

  if (key === 'Escape') {
    ev.preventDefault();
    const menu = document.getElementById('system-menu');
    if (menu && !menu.hidden) {
      menu.hidden = true;
      systemMenuOpen = false;
    } else {
      const m = document.getElementById('system-menu');
      if (m) {
        m.hidden = false;
        systemMenuOpen = true;
      }
    }
    publishUiState();
    return;
  }

  if (key === 'M') {
    ev.preventDefault();
    togglePanel('world-map');
    return;
  }

  for (const [id, reg] of panels.entries()) {
    const keys = [reg.hotkey, ...(reg.aliasHotkeys ?? [])].filter(Boolean).map((k) =>
      k!.length === 1 ? k!.toUpperCase() : k!
    );
    if (keys.includes(key)) {
      ev.preventDefault();
      togglePanel(id);
      return;
    }
  }
}

export function publishUiState(): void {
  const state = getGameState();
  if (!state.ui) {
    state.ui = {
      inventoryOpen: false,
      skillWindowOpen: false,
      questLogOpen: false,
      systemMenuOpen: false,
      worldMapOpen: false,
    };
  }
  state.ui.inventoryOpen = isPanelOpen('inventory-window');
  state.ui.skillWindowOpen = isPanelOpen('skill-window');
  state.ui.questLogOpen = isPanelOpen('quest-log');
  state.ui.systemMenuOpen = systemMenuOpen || !(document.getElementById('system-menu')?.hidden ?? true);
  state.ui.worldMapOpen = isPanelOpen('world-map');
}

export function initWindowManagerRegistry(): void {
  mountUiShell();
}
