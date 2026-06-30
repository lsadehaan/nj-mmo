import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountPvpToggle, wirePvpToggle } from './pvp-toggle';

describe('pvp-toggle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('click sends togglePvp via handler', () => {
    let called = false;
    wirePvpToggle({ togglePvp: () => { called = true; } });
    const btn = mountPvpToggle().querySelector('[data-role="toggle"]') as HTMLButtonElement;
    btn.click();
    expect(called).toBe(true);
  });
});
