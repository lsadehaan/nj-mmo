import { zoneBoundsFromTiZones } from './minimap-zones';

const ELEMENT_ID = 'world-map';

export function mountWorldMap(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const modal = document.createElement('div');
  modal.id = ELEMENT_ID;
  modal.hidden = true;
  modal.style.cssText =
    'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);z-index:90;pointer-events:auto';

  const card = document.createElement('div');
  card.dataset['role'] = 'world-map-card';
  card.style.cssText = 'padding:24px;background:#1a2030;color:#eee;border-radius:8px;min-width:320px';

  const zones = document.createElement('div');
  zones.dataset['role'] = 'zone-labels';
  card.appendChild(zones);

  modal.appendChild(card);
  document.body.appendChild(modal);
  return modal;
}

export function renderWorldMap(visible: boolean): void {
  const modal = mountWorldMap();
  modal.hidden = !visible;
  modal.style.display = visible ? 'flex' : 'none';
  const zones = modal.querySelector('[data-role="zone-labels"]');
  if (!zones) return;
  zones.innerHTML = '';
  for (const zone of zoneBoundsFromTiZones().filter((z) => z.id !== 'harbor_water')) {
    const label = document.createElement('div');
    label.dataset['role'] = 'zone-label';
    label.dataset['zoneId'] = zone.id;
    label.textContent = zone.displayName;
    zones.appendChild(label);
  }
}

export function isWorldMapVisible(): boolean {
  const el = document.getElementById(ELEMENT_ID);
  return el !== null && !el.hidden && el.style.display !== 'none';
}

export function setWorldMapVisible(visible: boolean): void {
  renderWorldMap(visible);
}
