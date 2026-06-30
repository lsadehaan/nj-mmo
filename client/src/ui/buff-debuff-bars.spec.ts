import { describe, it, expect, beforeEach } from 'vitest';
import { renderEffectBars } from './buff-debuff-bars';

describe('buff-debuff-bars', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('UI28-47: buff icon in buff bar', () => {
    renderEffectBars(
      [{ skillId: 1068, kind: 'buff_self', expiresAtMs: Date.now() + 60_000 }],
      Date.now()
    );
    expect(document.querySelector('#buff-bar [data-effect-id="1068"]')).not.toBeNull();
  });

  it('UI28-48: debuff in separate row', () => {
    renderEffectBars(
      [
        { skillId: 1068, kind: 'buff_self', expiresAtMs: Date.now() + 60_000 },
        { skillId: 1160, kind: 'debuff_enemy', expiresAtMs: Date.now() + 60_000 },
      ],
      Date.now()
    );
    expect(document.querySelector('#debuff-bar [data-effect-id="1160"]')).not.toBeNull();
  });

  it('UI28-49: timer shows 12 seconds', () => {
    const now = 1_000_000;
    renderEffectBars([{ skillId: 1068, kind: 'buff_self', expiresAtMs: now + 12_000 }], now);
    expect(document.querySelector('[data-role="effect-timer"]')?.textContent).toBe('12');
  });

  it('UI28-50: expired effect removed', () => {
    const now = 1_000_000;
    renderEffectBars([{ skillId: 1068, kind: 'buff_self', expiresAtMs: now - 1 }], now);
    expect(document.querySelector('#buff-bar [data-effect-id="1068"]')).toBeNull();
  });
});
