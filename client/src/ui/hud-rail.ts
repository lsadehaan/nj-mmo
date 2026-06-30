const RAIL_ID = 'hud-right-rail';

/**
 * Shared top-right HUD column. The always-on right-side panels (PvP toggle,
 * party, target frame, stat allocation, friends) used to each `position:fixed`
 * with hand-picked top/right values and overlapped badly. They now flow inside
 * this flex column instead, so they stack without colliding and reflow as
 * transient panels (e.g. the target frame) appear and disappear. Visual order
 * is controlled per-panel via CSS `order`, decoupled from mount call order.
 */
export function mountHudRightRail(): HTMLElement {
  const existing = document.getElementById(RAIL_ID);
  if (existing) return existing;
  const rail = document.createElement('div');
  rail.id = RAIL_ID;
  rail.style.cssText =
    'position:fixed;top:8px;right:8px;display:flex;flex-direction:column;' +
    'align-items:flex-end;gap:8px;max-height:calc(100vh - 16px);' +
    'overflow-y:auto;pointer-events:none;z-index:50';
  document.body.appendChild(rail);
  return rail;
}

/** Place a panel in the right rail at the given visual order, enabling pointer events. */
export function attachToRightRail(panel: HTMLElement, order: number): void {
  const rail = mountHudRightRail();
  panel.style.order = String(order);
  panel.style.pointerEvents = 'auto';
  rail.appendChild(panel);
}

export const RIGHT_RAIL_ORDER = {
  pvp: 0,
  party: 1,
  target: 2,
  stats: 3,
  friends: 4,
} as const;
