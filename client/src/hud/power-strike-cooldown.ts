import { createIconImg } from '../ui/icon-img';

/** Power Strike L1 reuse delay from seeded skill row — display ratio only (AD-001). */
export const POWER_STRIKE_REUSE_MS = 3_000;

const ELEMENT_ID = 'power-strike-cooldown';
const POWER_STRIKE_SKILL_ID = 3;

export function mountPowerStrikeCooldown(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const bar = document.createElement('div');
  bar.id = ELEMENT_ID;
  bar.setAttribute('data-remaining-ms', '0');
  bar.style.cssText = [
    'position:fixed',
    // Sit just right of the chat panel (chat is left:8px, width:320px) so the
    // cooldown is no longer hidden behind the chat bar.
    'left:336px',
    'bottom:16px',
    'width:48px',
    'height:48px',
    'border:2px solid rgba(255,255,255,0.85)',
    'border-radius:4px',
    'background:rgba(0,0,0,0.45)',
    'overflow:hidden',
    'pointer-events:none',
    'z-index:10',
  ].join(';');

  const icon = createIconImg({
    kind: 'skill',
    id: POWER_STRIKE_SKILL_ID,
    alt: 'Power Strike',
    sizePx: 48,
  });
  icon.style.cssText = [
    'position:absolute',
    'inset:0',
    'width:100%',
    'height:100%',
    'object-fit:contain',
    'z-index:0',
    'pointer-events:none',
  ].join(';');
  bar.appendChild(icon);

  const fill = document.createElement('div');
  fill.dataset['role'] = 'fill';
  fill.style.cssText = [
    'position:absolute',
    'left:0',
    'bottom:0',
    'width:100%',
    'height:0%',
    'background:rgba(120,180,255,0.75)',
    'transition:height 0.05s linear',
    'z-index:1',
  ].join(';');
  bar.appendChild(fill);

  document.body.appendChild(bar);
  return bar;
}

export function updatePowerStrikeCooldown(cooldownEndMs: number, nowMs = Date.now()): void {
  const bar = mountPowerStrikeCooldown();
  const remaining = Math.max(0, cooldownEndMs - nowMs);
  bar.setAttribute('data-remaining-ms', String(remaining));

  const fill = bar.querySelector<HTMLElement>('[data-role="fill"]');
  if (fill) {
    const ratio = Math.min(1, remaining / POWER_STRIKE_REUSE_MS);
    fill.style.height = `${ratio * 100}%`;
  }
}

let rafId = 0;

export function startPowerStrikeCooldownLoop(
  readCooldownEndMs: () => number,
  nowMs: () => number = Date.now
): () => void {
  const tick = (): void => {
    updatePowerStrikeCooldown(readCooldownEndMs(), nowMs());
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}
