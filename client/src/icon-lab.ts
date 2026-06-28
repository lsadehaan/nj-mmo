import { P1_ICON_PATHS } from './ui/icon-manifest';

declare global {
  interface Window {
    __SHOT_READY__?: boolean;
  }
}

const LABELS: Record<string, string> = {
  '/icons/placeholder.png': 'placeholder',
  '/icons/skills/power-strike.png': 'power-strike',
  '/icons/items/adena.png': 'adena',
  '/icons/items/wooden-arrow.png': 'wooden-arrow',
  '/icons/items/healing-potion.png': 'healing-potion',
  '/icons/items/soulshot.png': 'soulshot',
  '/icons/items/squires-sword.png': 'squires-sword',
};

const sheet = document.getElementById('sheet');
if (!sheet) throw new Error('icon-lab missing #sheet');

let pending = P1_ICON_PATHS.length;

function markLoaded(): void {
  pending -= 1;
  if (pending <= 0) {
    window.__SHOT_READY__ = true;
  }
}

for (const path of P1_ICON_PATHS) {
  const cell = document.createElement('div');
  cell.className = 'icon-cell';

  const img = document.createElement('img');
  img.src = path;
  img.alt = LABELS[path] ?? path;
  img.addEventListener('load', markLoaded, { once: true });
  img.addEventListener('error', markLoaded, { once: true });

  const label = document.createElement('span');
  label.textContent = LABELS[path] ?? path;

  cell.appendChild(img);
  cell.appendChild(label);
  sheet.appendChild(cell);
}

if (pending === 0) {
  window.__SHOT_READY__ = true;
}
