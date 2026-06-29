const CAST_BAR_ID = 'cast-bar';

let trackedCastSkillId = 0;
let trackedCastStartMs = 0;

export function mountCastBar(): HTMLElement {
  const existing = document.getElementById(CAST_BAR_ID);
  if (existing) return existing;

  const bar = document.createElement('div');
  bar.id = CAST_BAR_ID;
  bar.hidden = true;
  bar.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:80px',
    'transform:translateX(-50%)',
    'width:200px',
    'height:12px',
    'border:1px solid rgba(255,255,255,0.7)',
    'border-radius:4px',
    'background:rgba(0,0,0,0.5)',
    'overflow:hidden',
    'z-index:12',
  ].join(';');

  const fill = document.createElement('div');
  fill.dataset['role'] = 'fill';
  fill.style.cssText = 'height:100%;width:0%;background:#64b5f6;transition:width 0.05s linear;';
  bar.appendChild(fill);
  document.body.appendChild(bar);
  return bar;
}

export function updateCastBar(options: {
  castingSkillId: number;
  castEndMs: number;
  nowMs?: number;
  castStartMs?: number;
}): void {
  const bar = mountCastBar();
  const now = options.nowMs ?? Date.now();

  if (!options.castingSkillId || options.castEndMs <= now) {
    trackedCastSkillId = 0;
    bar.hidden = true;
    return;
  }

  if (trackedCastSkillId !== options.castingSkillId) {
    trackedCastSkillId = options.castingSkillId;
    trackedCastStartMs = options.castStartMs ?? now;
  }

  bar.hidden = false;
  const duration = Math.max(1, options.castEndMs - trackedCastStartMs);
  const elapsed = Math.max(0, now - trackedCastStartMs);
  const ratio = Math.min(1, elapsed / duration);
  const fill = bar.querySelector<HTMLElement>('[data-role="fill"]');
  if (fill) {
    fill.style.width = `${ratio * 100}%`;
  }
}
