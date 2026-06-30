/**
 * A single shared hover tooltip used across the HUD (hotbar, skill window,
 * inventory). One floating element follows the cursor and is shown/hidden via
 * pointer events attached to any number of host elements.
 */

export interface TooltipContent {
  title: string;
  body?: string;
}

const TOOLTIP_ID = 'game-tooltip';
const CURSOR_OFFSET = 16;

export function mountTooltip(): HTMLElement {
  const existing = document.getElementById(TOOLTIP_ID);
  if (existing) return existing;

  const el = document.createElement('div');
  el.id = TOOLTIP_ID;
  el.setAttribute('role', 'tooltip');
  el.hidden = true;
  el.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'max-width:240px',
    'padding:8px 10px',
    'background:rgba(12,10,18,0.96)',
    'color:#e8e0f0',
    'border:1px solid #6b5b95',
    'border-radius:6px',
    'font-size:12px',
    'line-height:1.4',
    'box-shadow:0 4px 12px rgba(0,0,0,0.5)',
    // Never let the tooltip eat pointer events meant for the element under it.
    'pointer-events:none',
    'z-index:1000',
  ].join(';');
  document.body.appendChild(el);
  return el;
}

function renderContent(el: HTMLElement, content: TooltipContent): void {
  const title = document.createElement('div');
  title.dataset['role'] = 'tooltip-title';
  title.style.cssText = 'font-weight:bold;margin-bottom:2px;color:#fff';
  title.textContent = content.title;

  el.innerHTML = '';
  el.appendChild(title);

  if (content.body) {
    const body = document.createElement('div');
    body.dataset['role'] = 'tooltip-body';
    body.style.cssText = 'opacity:0.85;white-space:pre-line';
    body.textContent = content.body;
    el.appendChild(body);
  }
}

function positionTooltip(el: HTMLElement, clientX: number, clientY: number): void {
  const vw = window.innerWidth || 1024;
  const vh = window.innerHeight || 768;
  const rect = el.getBoundingClientRect();
  const width = rect.width || 240;
  const height = rect.height || 48;

  let x = clientX + CURSOR_OFFSET;
  let y = clientY + CURSOR_OFFSET;
  if (x + width > vw) x = Math.max(0, clientX - CURSOR_OFFSET - width);
  if (y + height > vh) y = Math.max(0, clientY - CURSOR_OFFSET - height);

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

export function showTooltip(content: TooltipContent, clientX: number, clientY: number): void {
  const el = mountTooltip();
  renderContent(el, content);
  el.hidden = false;
  positionTooltip(el, clientX, clientY);
}

export function hideTooltip(): void {
  const el = document.getElementById(TOOLTIP_ID);
  if (el) el.hidden = true;
}

/**
 * Wire a host element so hovering it shows a tooltip. `content` may be a static
 * object or a getter resolved on each hover (so live data, e.g. cooldowns, can
 * be reflected). Returning `null` from the getter suppresses the tooltip.
 */
export function attachTooltip(
  host: HTMLElement,
  content: TooltipContent | (() => TooltipContent | null)
): void {
  const resolve = (): TooltipContent | null =>
    typeof content === 'function' ? content() : content;

  host.addEventListener('mouseenter', (ev) => {
    const resolved = resolve();
    if (resolved) showTooltip(resolved, ev.clientX, ev.clientY);
  });
  host.addEventListener('mousemove', (ev) => {
    const el = document.getElementById(TOOLTIP_ID);
    if (el && !el.hidden) positionTooltip(el, ev.clientX, ev.clientY);
  });
  host.addEventListener('mouseleave', hideTooltip);
  // Clicking a slot (use skill / equip) or closing a window should not leave a
  // stale tooltip floating on screen.
  host.addEventListener('click', hideTooltip);
}
