import { normalizeWorldToMinimap } from './minimap-zones';

const ELEMENT_ID = 'minimap';
const SIZE_PX = 120;

export interface MinimapRenderOptions {
  playerX: number;
  playerZ: number;
  zoneDisplayName: string;
  partyPositions?: { sessionId: string; x: number; z: number }[];
}

export function mountMinimap(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const map = document.createElement('div');
  map.id = ELEMENT_ID;
  map.style.cssText = `position:fixed;bottom:16px;right:16px;width:${SIZE_PX}px;height:${SIZE_PX}px;background:rgba(0,0,0,0.6);border:1px solid #666;border-radius:4px;z-index:12;pointer-events:none`;

  const label = document.createElement('div');
  label.dataset['role'] = 'minimap-zone-label';
  label.style.cssText = 'position:absolute;top:-18px;left:0;font:11px system-ui;color:#ddd;white-space:nowrap';
  map.appendChild(label);

  const dot = document.createElement('div');
  dot.dataset['role'] = 'player-dot';
  dot.style.cssText = 'position:absolute;width:6px;height:6px;background:#4af;border-radius:50%;transform:translate(-50%,-50%)';
  map.appendChild(dot);

  document.body.appendChild(map);
  return map;
}

export function renderMinimap(options: MinimapRenderOptions): void {
  const map = mountMinimap();
  const label = map.querySelector('[data-role="minimap-zone-label"]');
  if (label) label.textContent = options.zoneDisplayName;

  const { leftPx, topPx } = normalizeWorldToMinimap(options.playerX, options.playerZ, SIZE_PX);
  const dot = map.querySelector('[data-role="player-dot"]') as HTMLElement;
  dot.style.left = `${leftPx}px`;
  dot.style.top = `${topPx}px`;

  map.querySelectorAll('[data-role="party-dot"]').forEach((el) => el.remove());
  for (const member of options.partyPositions ?? []) {
    const pos = normalizeWorldToMinimap(member.x, member.z, SIZE_PX);
    const partyDot = document.createElement('div');
    partyDot.dataset['role'] = 'party-dot';
    partyDot.dataset['sessionId'] = member.sessionId;
    partyDot.style.cssText =
      'position:absolute;width:5px;height:5px;background:#4f4;border-radius:50%;transform:translate(-50%,-50%)';
    partyDot.style.left = `${pos.leftPx}px`;
    partyDot.style.top = `${pos.topPx}px`;
    map.appendChild(partyDot);
  }
}
